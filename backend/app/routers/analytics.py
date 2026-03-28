"""
流程探勘 & 分析 API

利用 visit_status_history 事件日誌，提供：
  1. 流程發現（Process Discovery）：自動重建診療流程
  2. 流程統計：各狀態轉換頻率、平均停留時間
  3. 合規偏差：偏離標準路徑的案件
"""
from datetime import datetime
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from pydantic import BaseModel

from app.database import get_db
from app.dependencies import get_clinic_id, get_current_user, get_token_data
from app.models.analytics import InsightDismissal
from app.models.foundation import User

router = APIRouter(prefix="/analytics", tags=["分析 & 報表"])


@router.get("/process-mining")
def get_process_mining(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    """流程探勘：從 visit_status_history 重建診療流程"""
    clinic_id = get_clinic_id(token_data)

    # 取得事件日誌（只看當前分院的 visits）
    rows = db.execute(text("""
        SELECT h.visit_id, h.from_status, h.to_status, h.changed_at
        FROM visit_status_history h
        JOIN visits v ON v.id = h.visit_id
        WHERE v.clinic_id = :clinic_id
        ORDER BY h.visit_id, h.changed_at
    """), {"clinic_id": clinic_id}).fetchall()

    if not rows:
        return {
            "total_cases": 0,
            "total_events": 0,
            "transitions": [],
            "cases": [],
            "status_stats": {},
            "variant_stats": [],
        }

    # ── 1. 轉換頻率（Transition Frequency）────────────────────
    transition_counts: dict[tuple[str, str], int] = defaultdict(int)
    for r in rows:
        from_s = r[1] or "START"
        to_s = r[2]
        transition_counts[(from_s, to_s)] += 1

    transitions = [
        {"from": f, "to": t, "count": c}
        for (f, t), c in sorted(transition_counts.items(), key=lambda x: -x[1])
    ]

    # ── 2. 各 case 的完整路徑 ──────────────────────────────────
    cases: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        cases[r[0]].append({
            "from": r[1] or "START",
            "to": r[2],
            "at": r[3].isoformat() if r[3] else None,
        })

    # ── 3. 各狀態平均停留時間 ──────────────────────────────────
    status_durations: dict[str, list[float]] = defaultdict(list)
    for visit_id, events in cases.items():
        for i, ev in enumerate(events):
            if i + 1 < len(events):
                current_status = ev["to"]
                next_at = datetime.fromisoformat(events[i + 1]["at"])
                current_at = datetime.fromisoformat(ev["at"])
                duration_min = (next_at - current_at).total_seconds() / 60
                if duration_min >= 0:
                    status_durations[current_status].append(duration_min)

    # 人員定義的 SOP 標準（demo 用 hardcode；未來改為 catalog/設定表）
    sop_thresholds: dict[str, float] = {
        "registered": 15.0,       # 候診不超過 15 分鐘
        "triaged": 30.0,          # 初診後 30 分鐘內看診
        "in_consultation": 60.0,  # 看診不超過 60 分鐘
        "pending_results": 1440.0,  # 檢驗結果 24 小時內回報
    }
    # 終態 / 無意義統計的狀態排除
    _SKIP_STATUSES = {"completed", "cancelled"}

    def _iqr_filtered_avg(values: list[float]) -> float:
        """IQR 法去偏離值後的平均"""
        if len(values) < 4:
            return round(sum(values) / len(values), 1) if values else 0
        sorted_v = sorted(values)
        n = len(sorted_v)
        q1 = sorted_v[n // 4]
        q3 = sorted_v[3 * n // 4]
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        filtered = [v for v in sorted_v if lower <= v <= upper]
        return round(sum(filtered) / len(filtered), 1) if filtered else round(sum(values) / len(values), 1)

    status_stats = {}
    for status, durations in status_durations.items():
        if durations and status not in _SKIP_STATUSES:
            raw_avg = round(sum(durations) / len(durations), 1)
            filtered_avg = _iqr_filtered_avg(durations)
            sop = sop_thresholds.get(status)
            ok_count = len([d for d in durations if sop and d <= sop]) if sop else len(durations)
            exceeded_count = len([d for d in durations if sop and d > sop]) if sop else 0
            status_stats[status] = {
                "avg_minutes": raw_avg,
                "filtered_avg_minutes": filtered_avg,
                "min_minutes": round(min(durations), 1),
                "max_minutes": round(max(durations), 1),
                "count": len(durations),
                "ok_count": ok_count,
                "exceeded_count": exceeded_count,
                "sop_threshold_minutes": sop,
                "sop_status": (
                    "ok" if sop and filtered_avg <= sop
                    else "warning" if sop and filtered_avg <= sop * 1.2
                    else "exceeded" if sop
                    else None
                ),
            }

    # ── 4. 路徑變體分析（Variant Analysis）────────────────────
    variant_counts: dict[str, int] = defaultdict(int)
    variant_cases: dict[str, list[int]] = defaultdict(list)
    for visit_id, events in cases.items():
        path = " → ".join([events[0]["from"]] + [e["to"] for e in events])
        variant_counts[path] += 1
        variant_cases[path].append(visit_id)

    variant_stats = [
        {"path": path, "count": count, "visit_ids": variant_cases[path]}
        for path, count in sorted(variant_counts.items(), key=lambda x: -x[1])
    ]

    # ── 5. PM4Py 流程發現（如果可用）──────────────────────────
    process_model = None
    fitness = None
    try:
        import pandas as pd
        import pm4py

        # 建立 event log DataFrame
        event_data = []
        for r in rows:
            event_data.append({
                "case:concept:name": str(r[0]),
                "concept:name": r[2],  # to_status 作為 activity
                "time:timestamp": r[3],
            })

        df = pd.DataFrame(event_data)
        df["time:timestamp"] = pd.to_datetime(df["time:timestamp"], utc=True)
        df = pm4py.format_dataframe(
            df,
            case_id="case:concept:name",
            activity_key="concept:name",
            timestamp_key="time:timestamp",
        )

        # Inductive Miner 流程發現
        net, im, fm = pm4py.discover_petri_net_inductive(df)

        # Fitness 評估
        fitness_result = pm4py.fitness_token_based_replay(df, net, im, fm)
        fitness = round(fitness_result.get("average_trace_fitness", 0), 3)

        # 取得 DFG（Directly-Follows Graph）用於前端視覺化
        dfg, start_activities, end_activities = pm4py.discover_dfg(df)
        process_model = {
            "dfg": [{"from": k[0], "to": k[1], "count": v} for k, v in dfg.items()],
            "start_activities": dict(start_activities),
            "end_activities": dict(end_activities),
            "fitness": fitness,
        }
    except Exception as e:
        process_model = {"error": str(e)}

    # ── 6. 異常洞察（Insights）────────────────────────────────
    # 標準流程中預期的步驟順序
    _EXPECTED_STEPS = ["registered", "triaged", "in_consultation"]
    # 逆向轉換（不應出現的方向）
    _STATUS_ORDER = {
        "registered": 0, "triaged": 1, "in_consultation": 2,
        "pending_results": 3, "admitted": 4, "completed": 5,
    }

    insights: list[dict] = []

    for visit_id, events in cases.items():
        visit_label = f"V-{str(visit_id).zfill(6)}"

        # 檢查 1：跳過預期步驟
        visited_statuses = {e["to"] for e in events}
        for step in _EXPECTED_STEPS:
            if step not in visited_statuses:
                insights.append({
                    "key": f"skipped_step:{visit_id}:{step}",
                    "level": "warning",
                    "visit_id": visit_id,
                    "type": "skipped_step",
                    "message": f"{visit_label} 跳過了「{step}」步驟",
                    "detail": "預期流程應經過此步驟，但此就診紀錄中未出現。可能原因：緊急處理跳過分流、操作遺漏、或流程簡化。",
                })

        # 檢查 2：逆向轉換（狀態倒退）
        for ev in events:
            from_order = _STATUS_ORDER.get(ev["from"], -1)
            to_order = _STATUS_ORDER.get(ev["to"], -1)
            if from_order >= 0 and to_order >= 0 and to_order < from_order:
                # 排除合理的逆向（pending_results ↔ in_consultation 是正常的來回）
                if not (ev["from"] == "pending_results" and ev["to"] == "in_consultation"):
                    insights.append({
                        "key": f"backward:{visit_id}:{ev['from']}>{ev['to']}",
                        "level": "info",
                        "visit_id": visit_id,
                        "type": "backward_transition",
                        "message": f"{visit_label} 出現逆向轉換：{ev['from']} → {ev['to']}",
                        "detail": "狀態從較後的階段退回較前的階段。可能原因：誤操作後修正、重新評估、或測試資料。",
                    })

        # 檢查 3：過多狀態轉換（異常頻繁操作）
        if len(events) > 10:
            insights.append({
                "key": f"excessive:{visit_id}",
                "level": "warning",
                "visit_id": visit_id,
                "type": "excessive_transitions",
                "message": f"{visit_label} 有 {len(events)} 次狀態轉換（異常偏多）",
                "detail": "正常就診通常在 3-6 次轉換內完成。過多轉換可能代表：操作錯誤頻繁、流程不熟悉、或系統測試資料。",
            })

    # 檢查 4：SOP 超標的狀態
    for status, stat in status_stats.items():
        if stat.get("exceeded_count", 0) > 0:
            total = stat["count"]
            exceeded = stat["exceeded_count"]
            pct = round(exceeded / total * 100)
            insights.append({
                "key": f"sop_exceeded:{status}",
                "level": "warning" if pct > 20 else "info",
                "visit_id": None,
                "type": "sop_exceeded",
                "message": f"「{status}」階段有 {exceeded}/{total} 筆（{pct}%）超過 SOP 標準時間",
                "detail": f"SOP 標準為 {stat.get('sop_threshold_minutes', 0)} 分鐘。可能原因：人力不足導致等候、檢驗流程延遲、或 SOP 標準需要調整。",
            })

    # 依嚴重度排序：warning > info
    insights.sort(key=lambda x: (0 if x["level"] == "warning" else 1, x.get("visit_id") or 0))

    # 過濾已 dismiss 的 insights
    dismissed_keys: set[str] = set()
    dismissed_rows = db.execute(select(InsightDismissal)).scalars().all()
    for d in dismissed_rows:
        dismissed_keys.add(d.insight_key)

    for ins in insights:
        ins["dismissed"] = ins["key"] in dismissed_keys

    return {
        "total_cases": len(cases),
        "total_events": len(rows),
        "transitions": transitions,
        "cases": [
            {"visit_id": vid, "events": evts}
            for vid, evts in cases.items()
        ],
        "status_stats": status_stats,
        "variant_stats": variant_stats,
        "process_model": process_model,
        "insights": insights,
    }


class DismissRequest(BaseModel):
    key: str


@router.post("/analytics/insights/dismiss")
def dismiss_insight(
    body: DismissRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """標記 insight 為已知"""
    existing = db.execute(
        select(InsightDismissal).where(InsightDismissal.insight_key == body.key)
    ).scalar_one_or_none()
    if not existing:
        db.add(InsightDismissal(insight_key=body.key))
        db.commit()
    return {"ok": True}


@router.delete("/analytics/insights/dismiss")
def undismiss_insight(
    body: DismissRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """取消已知標記"""
    existing = db.execute(
        select(InsightDismissal).where(InsightDismissal.insight_key == body.key)
    ).scalar_one_or_none()
    if existing:
        db.delete(existing)
        db.commit()
    return {"ok": True}
