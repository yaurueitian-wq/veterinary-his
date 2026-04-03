"""
住院管理 Service 層

業務邏輯集中於此，router 只負責 HTTP 層（參數解析、權限檢查、回應格式）。
三個核心流程：入院、出院、轉床 — 均涉及跨多表的原子操作。
"""
from datetime import date as date_type, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import VisitStatus as VS
from app.models.hospitalization import (
    Admission, AdmissionEquipment, Bed, BedTransfer, DailyRound,
    DischargeRecord, InpatientOrder, Ward,
)
from app.models.visits import Visit, VisitStatusHistory


class AdmissionConflictError(Exception):
    """此掛號已有住院紀錄"""


class BedUnavailableError(Exception):
    """病床不存在、已占用、或不屬於當前分院"""


class AdmissionNotActiveError(Exception):
    """住院紀錄已結束"""


class InvalidPostDischargeStatusError(Exception):
    """出院後狀態不合法"""


class VisitNotFoundError(Exception):
    """掛號紀錄不存在"""


# ── 入院 ──────────────────────────────────────────────────────

def admit(
    *,
    visit_id: int,
    clinic_id: int,
    bed_id: int,
    admission_reason_id: int,
    reason_notes: str | None,
    attending_vet_id: int,
    equipment_item_ids: list[int],
    organization_id: int,
    user_id: int,
    db: Session,
) -> Admission:
    """
    建立住院紀錄：
    1. 驗證 visit 存在且屬於當前分院
    2. 檢查無重複住院
    3. 驗證床位可用且屬於當前分院
    4. 建立 Admission + AdmissionEquipment
    5. 床位 → occupied
    6. Visit 狀態 → admitted
    """
    # 驗證 visit
    visit = db.execute(
        select(Visit).where(Visit.id == visit_id, Visit.clinic_id == clinic_id)
    ).scalar_one_or_none()
    if not visit:
        raise VisitNotFoundError("掛號紀錄不存在")

    # 檢查重複住院
    existing = db.execute(
        select(Admission).where(Admission.visit_id == visit_id)
    ).scalar_one_or_none()
    if existing:
        raise AdmissionConflictError("此掛號已有住院紀錄")

    # 驗證床位
    bed = db.execute(
        select(Bed).where(Bed.id == bed_id, Bed.is_active.is_(True))
    ).scalar_one_or_none()
    if not bed:
        raise BedUnavailableError("病床不存在")
    if bed.status != "available":
        raise BedUnavailableError("該病床目前無法使用")

    ward = db.get(Ward, bed.ward_id)
    if not ward or ward.clinic_id != clinic_id:
        raise BedUnavailableError("病床不屬於當前分院")

    now = datetime.now(timezone.utc)

    # 建立住院紀錄
    admission = Admission(
        organization_id=organization_id,
        clinic_id=clinic_id,
        visit_id=visit_id,
        bed_id=bed_id,
        admission_reason_id=admission_reason_id,
        reason_notes=reason_notes,
        attending_vet_id=attending_vet_id,
        admitted_at=now,
        created_by=user_id,
    )
    db.add(admission)
    db.flush()

    # 設備勾選
    for eq_id in equipment_item_ids:
        db.add(AdmissionEquipment(
            admission_id=admission.id,
            equipment_item_id=eq_id,
        ))

    # 床位 → 占用
    bed.status = "occupied"

    # Visit 狀態 → admitted
    old_status = visit.status
    visit.status = VS.ADMITTED
    visit.admitted_at = now
    db.add(VisitStatusHistory(
        visit_id=visit.id,
        from_status=old_status,
        to_status=VS.ADMITTED,
        changed_by=user_id,
    ))

    db.commit()
    db.refresh(admission)
    return admission


# ── 出院 ──────────────────────────────────────────────────────

ALLOWED_POST_DISCHARGE_STATUSES = {"completed", "in_consultation"}


def discharge(
    *,
    admission: Admission,
    discharge_reason_id: int,
    discharge_condition_id: int,
    discharge_notes: str | None,
    follow_up_plan: str | None,
    post_discharge_status: str,
    user_id: int,
    db: Session,
) -> DischargeRecord:
    """
    出院流程：
    1. 驗證 admission 為 active
    2. 驗證 post_discharge_status 合法
    3. 建立 DischargeRecord
    4. Admission → discharged
    5. Bed → available
    6. Visit 狀態依選擇（completed 或 in_consultation）
    7. 結束所有 active 醫囑
    """
    if admission.status != "active":
        raise AdmissionNotActiveError("此住院已結束")

    if post_discharge_status not in ALLOWED_POST_DISCHARGE_STATUSES:
        raise InvalidPostDischargeStatusError(
            f"出院後狀態只能是：{', '.join(ALLOWED_POST_DISCHARGE_STATUSES)}"
        )

    now = datetime.now(timezone.utc)

    # 建立出院紀錄
    record = DischargeRecord(
        admission_id=admission.id,
        discharge_reason_id=discharge_reason_id,
        discharge_condition_id=discharge_condition_id,
        discharge_notes=discharge_notes,
        follow_up_plan=follow_up_plan,
        discharged_at=now,
        discharged_by=user_id,
    )
    db.add(record)

    # Admission → discharged
    admission.status = "discharged"
    admission.discharged_at = now

    # Bed → available
    bed = db.get(Bed, admission.bed_id)
    if bed:
        bed.status = "available"

    # Visit 狀態
    visit = db.get(Visit, admission.visit_id)
    if visit:
        old_status = visit.status
        visit.status = post_discharge_status
        if post_discharge_status == VS.COMPLETED:
            visit.completed_at = now
        db.add(VisitStatusHistory(
            visit_id=visit.id,
            from_status=old_status,
            to_status=post_discharge_status,
            changed_by=user_id,
        ))

    # 結束所有 active 醫囑
    active_orders = db.execute(
        select(InpatientOrder).where(
            InpatientOrder.admission_id == admission.id,
            InpatientOrder.status == "active",
            InpatientOrder.is_superseded.is_(False),
        )
    ).scalars().all()
    for order in active_orders:
        order.status = "completed"
        order.end_at = now

    db.commit()
    db.refresh(record)
    return record


# ── 轉床 ──────────────────────────────────────────────────────

def transfer_bed(
    *,
    admission: Admission,
    to_bed_id: int,
    clinic_id: int,
    assessment: str | None,
    plan: str | None,
    user_id: int,
    db: Session,
) -> tuple[BedTransfer, bool]:
    """
    轉床流程：
    1. 驗證 admission 為 active
    2. 驗證目標床位可用且屬於同分院
    3. 判斷是否跨類型（ward_type 不同）
    4. 跨類型時同時建立巡房紀錄
    5. 更新床位狀態 + admission.bed_id

    Returns: (BedTransfer, is_cross_type)
    """
    if admission.status != "active":
        raise AdmissionNotActiveError("此住院已結束，無法轉床")

    # 驗證目標床位
    to_bed = db.execute(
        select(Bed).where(Bed.id == to_bed_id, Bed.is_active.is_(True))
    ).scalar_one_or_none()
    if not to_bed:
        raise BedUnavailableError("目標病床不存在")
    if to_bed.status != "available":
        raise BedUnavailableError("目標病床目前無法使用")

    to_ward = db.get(Ward, to_bed.ward_id)
    if not to_ward or to_ward.clinic_id != clinic_id:
        raise BedUnavailableError("目標病床不屬於當前分院")

    from_bed = db.get(Bed, admission.bed_id)
    from_ward = db.get(Ward, from_bed.ward_id) if from_bed else None

    # 判斷是否跨類型
    is_cross_type = (
        from_ward is not None
        and to_ward.ward_type_id != from_ward.ward_type_id
    )

    # 建立轉床紀錄
    transfer = BedTransfer(
        admission_id=admission.id,
        from_bed_id=admission.bed_id,
        to_bed_id=to_bed_id,
        transferred_by=user_id,
    )
    db.add(transfer)

    # 跨類型：同時建立巡房紀錄
    if is_cross_type:
        dr = DailyRound(
            admission_id=admission.id,
            round_date=date_type.today(),
            assessment=assessment,
            plan=plan,
            created_by=user_id,
        )
        db.add(dr)

    # 更新床位狀態
    if from_bed:
        from_bed.status = "available"
    to_bed.status = "occupied"

    # 更新 admission 的當前床位
    admission.bed_id = to_bed_id

    db.commit()
    db.refresh(transfer)
    return transfer, is_cross_type
