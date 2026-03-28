import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart2, Eye, EyeOff } from "lucide-react";
import { analyticsApi, type ProcessMiningResult, type StatusStat, type Insight } from "@/api/analytics";
import { STATUS_LABELS } from "@/api/visits";
import { Badge } from "@/components/ui/badge";

// ── 工具函式 ──────────────────────────────────────────────────

function fmtMinutes(min: number): string {
  if (min < 1) return "< 1 分";
  if (min < 60) return `${Math.round(min)} 分`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h} 時 ${m} 分` : `${h} 時`;
}

function statusLabel(status: string): string {
  return (STATUS_LABELS as Record<string, string>)[status] ?? status;
}

// ── 轉換頻率圖（Directly-Follows Graph）──────────────────────

function TransitionGraph({ data }: { data: ProcessMiningResult }) {
  const transitions = data.process_model?.dfg ?? data.transitions;
  if (!transitions.length) return null;

  const maxCount = Math.max(...transitions.map((t) => t.count));

  return (
    <section className="space-y-3">
      <div className="border-b-2 border-foreground/10 pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          狀態轉換頻率
        </h2>
      </div>
      <div className="space-y-1.5">
        {transitions.map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-20 text-right font-medium truncate">{statusLabel(t.from)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="w-20 font-medium truncate">{statusLabel(t.to)}</span>
            <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/60 rounded-full transition-all"
                style={{ width: `${(t.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right text-muted-foreground text-xs">{t.count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── 各狀態平均停留時間 ────────────────────────────────────────

function StatusDurations({ stats }: { stats: Record<string, StatusStat> }) {
  const entries = Object.entries(stats).sort((a, b) => b[1].filtered_avg_minutes - a[1].filtered_avg_minutes);
  if (!entries.length) return null;

  // 統一刻度：取所有狀態中 max_minutes 和 sop_threshold 的最大值
  const maxVal = Math.max(
    ...entries.map(([, s]) => Math.max(s.max_minutes, s.sop_threshold_minutes ?? 0))
  );

  return (
    <section className="space-y-3">
      <div className="border-b-2 border-foreground/10 pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          各狀態平均停留時間
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          系統建議值（去偏離值）vs SOP 標準
        </p>
      </div>
      <div className="space-y-3">
        {entries.map(([status, s]) => (
          <div key={status} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{statusLabel(status)}</span>
              <div className="flex items-center gap-3 text-xs">
                {s.sop_threshold_minutes != null ? (
                  <>
                    <span className="text-emerald-600">正常 {s.ok_count}</span>
                    {s.exceeded_count > 0 && (
                      <span className="text-red-600">超標 {s.exceeded_count}</span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">{s.count} 次</span>
                )}
              </div>
            </div>

            {/* 進度條 + SOP 標記 */}
            <div className="relative">
              {/* SOP 標準標記（進度條上方） */}
              {s.sop_threshold_minutes != null && (
                <div
                  className="absolute -top-4 text-[10px] text-muted-foreground whitespace-nowrap"
                  style={{ left: `${Math.min((s.sop_threshold_minutes / maxVal) * 100, 100)}%` }}
                >
                  SOP {fmtMinutes(s.sop_threshold_minutes)}
                </div>
              )}

              <div className="relative h-7 bg-muted rounded-md overflow-hidden mt-4">
                {/* SOP 標準線 */}
                {s.sop_threshold_minutes != null && (
                  <div
                    className="absolute top-0 bottom-0 border-r-2 border-dashed border-foreground/30 z-10"
                    style={{ left: `${Math.min((s.sop_threshold_minutes / maxVal) * 100, 100)}%` }}
                  />
                )}

                {/* 系統建議值（去偏離）*/}
                <div
                  className={`h-full rounded-md ${
                    s.sop_status === "exceeded" ? "bg-red-400/60"
                      : s.sop_status === "warning" ? "bg-amber-400/60"
                      : "bg-emerald-400/60"
                  }`}
                  style={{ width: `${Math.min((s.filtered_avg_minutes / maxVal) * 100, 100)}%` }}
                />

                {/* 數值文字 */}
                <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                  {fmtMinutes(s.filtered_avg_minutes)}
                </span>
              </div>
            </div>

            {/* 詳細數值 */}
            <div className="flex gap-4 text-[11px] text-muted-foreground">
              <span>原始平均 {fmtMinutes(s.avg_minutes)}</span>
              <span>最短 {fmtMinutes(s.min_minutes)}</span>
              <span>最長 {fmtMinutes(s.max_minutes)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── 路徑變體分析 ──────────────────────────────────────────────

function VariantAnalysis({ variants }: { variants: ProcessMiningResult["variant_stats"] }) {
  if (!variants.length) return null;

  return (
    <section className="space-y-3">
      <div className="border-b-2 border-foreground/10 pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          路徑變體分析
        </h2>
      </div>
      <div className="space-y-2">
        {variants.map((v, i) => (
          <div key={i} className="rounded-md border p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <Badge variant={i === 0 ? "default" : "secondary"} className="text-xs">
                {v.count} 筆
              </Badge>
              <span className="text-xs">
                {v.visit_ids.map((id, j) => (
                  <span key={id}>
                    {j > 0 && ", "}
                    <Link
                      to={`/medical-records/${id}`}
                      className="text-primary hover:underline"
                    >
                      V-{String(id).padStart(6, "0")}
                    </Link>
                  </span>
                ))}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 items-center">
              {v.path.split(" → ").map((step, j, arr) => (
                <span key={j} className="flex items-center gap-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">
                    {statusLabel(step)}
                  </span>
                  {j < arr.length - 1 && (
                    <span className="text-muted-foreground text-xs">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── 異常洞察 ──────────────────────────────────────────────────

function InsightsSection({ insights }: { insights: Insight[] }) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  const dismissMutation = useMutation({
    mutationFn: (key: string) => analyticsApi.dismissInsight(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["process-mining"] }),
  });

  const undismissMutation = useMutation({
    mutationFn: (key: string) => analyticsApi.undismissInsight(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["process-mining"] }),
  });

  const activeInsights = showAll ? insights : insights.filter((i) => !i.dismissed);
  const dismissedCount = insights.filter((i) => i.dismissed).length;
  const warnings = activeInsights.filter((i) => i.level === "warning" && !i.dismissed);
  const infos = activeInsights.filter((i) => i.level === "info" && !i.dismissed);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b-2 border-foreground/10 pb-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            系統評估
          </h2>
          {insights.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {warnings.length} 項警告、{infos.length} 項提示
              {dismissedCount > 0 && `、${dismissedCount} 項已知`}
            </p>
          )}
        </div>
        {dismissedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAll ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showAll ? "隱藏已知" : "顯示全部"}
          </button>
        )}
      </div>

      {activeInsights.length === 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {dismissedCount > 0
            ? `所有 ${dismissedCount} 項評估均已標記為已知。`
            : "未發現異常，所有流程運行正常。"}
        </div>
      ) : (
        <div className="space-y-2">
          {activeInsights.map((insight) => (
            <div
              key={insight.key}
              className={`rounded-md border p-3 space-y-1 ${
                insight.dismissed
                  ? "border-muted bg-muted/30 opacity-60"
                  : insight.level === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : "border-blue-200 bg-blue-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm font-medium ${
                  insight.dismissed
                    ? "text-muted-foreground"
                    : insight.level === "warning" ? "text-amber-800" : "text-blue-800"
                }`}>
                  {insight.message}
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {insight.visit_id && (
                    <Link
                      to={`/medical-records/${insight.visit_id}`}
                      className="text-xs text-primary hover:underline whitespace-nowrap"
                    >
                      查看病歷
                    </Link>
                  )}
                  {insight.dismissed ? (
                    <button
                      type="button"
                      onClick={() => undismissMutation.mutate(insight.key)}
                      className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
                    >
                      恢復
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => dismissMutation.mutate(insight.key)}
                      className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
                    >
                      已知
                    </button>
                  )}
                </div>
              </div>
              <p className={`text-xs ${
                insight.dismissed
                  ? "text-muted-foreground"
                  : insight.level === "warning" ? "text-amber-700" : "text-blue-700"
              }`}>
                {insight.detail}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────

export default function ProcessMiningPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["process-mining"],
    queryFn: analyticsApi.getProcessMining,
  });

  if (isLoading) {
    return (
      <div className="w-full px-6 py-6">
        <p className="text-sm text-muted-foreground">分析中…</p>
      </div>
    );
  }

  if (!data || data.total_cases === 0) {
    return (
      <div className="w-full px-6 py-6 space-y-4">
        <h1 className="text-xl font-semibold">流程探勘</h1>
        <p className="text-sm text-muted-foreground py-8 text-center">尚無足夠的診療紀錄進行分析</p>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-6 max-w-4xl space-y-8">
      {/* 標題 */}
      <div>
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">流程探勘</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          基於 {data.total_events} 筆狀態轉換事件，分析 {data.total_cases} 筆就診紀錄
        </p>
      </div>

      {/* 摘要指標 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">就診數</p>
          <p className="text-2xl font-semibold mt-1">{data.total_cases}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">事件數</p>
          <p className="text-2xl font-semibold mt-1">{data.total_events}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">路徑變體</p>
          <p className="text-2xl font-semibold mt-1">{data.variant_stats.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">模型適合度</p>
          <p className="text-2xl font-semibold mt-1">
            {data.process_model?.fitness != null
              ? `${(data.process_model.fitness * 100).toFixed(0)}%`
              : "—"}
          </p>
        </div>
      </div>

      {/* 系統評估 */}
      <InsightsSection insights={data.insights ?? []} />

      {/* 轉換頻率 */}
      <TransitionGraph data={data} />

      {/* 停留時間 */}
      <StatusDurations stats={data.status_stats} />

      {/* 路徑變體 */}
      <VariantAnalysis variants={data.variant_stats} />
    </div>
  );
}
