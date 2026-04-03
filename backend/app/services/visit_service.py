"""
掛號 & 候診 Service 層

掛號建立（重複防護）和狀態轉換（狀態機 + admission 檢查）的業務邏輯。
"""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import VisitStatus as VS
from app.models.hospitalization import Admission
from app.models.owners import Animal
from app.models.visits import Visit, VisitStatusHistory


# ── 狀態機 ────────────────────────────────────────────────────

_ACTIVE_STATUSES: set[str] = {
    VS.REGISTERED, VS.TRIAGED, VS.IN_CONSULTATION,
    VS.PENDING_RESULTS, VS.ADMITTED, VS.COMPLETED,
}

VALID_TRANSITIONS: dict[str, set[str]] = {
    s: (_ACTIVE_STATUSES - {s}) | {VS.CANCELLED}
    for s in _ACTIVE_STATUSES
} | {VS.CANCELLED: set()}


# ── Exceptions ────────────────────────────────────────────────

class AnimalNotFoundError(Exception):
    """動物不存在"""


class DuplicateVisitError(Exception):
    """此動物已有進行中的就診"""


class InvalidTransitionError(Exception):
    """不允許的狀態轉換"""


class ActiveAdmissionBlockError(Exception):
    """有住院中的紀錄，須走出院流程"""


# ── 掛號 ──────────────────────────────────────────────────────

_ACTIVE_STATUSES_FOR_DUPLICATE_CHECK = [
    VS.REGISTERED, VS.TRIAGED, VS.IN_CONSULTATION, VS.PENDING_RESULTS, VS.ADMITTED,
]


def create_visit(
    *,
    animal_id: int,
    organization_id: int,
    clinic_id: int,
    priority: str,
    chief_complaint: str | None,
    user_id: int,
    db: Session,
) -> Visit:
    """
    新增掛號：
    1. 驗證動物存在
    2. 重複掛號防護（同動物、同分院、進行中的就診）
    3. 建立 Visit
    """
    animal = db.execute(
        select(Animal).where(
            Animal.id == animal_id,
            Animal.organization_id == organization_id,
        )
    ).scalar_one_or_none()
    if not animal:
        raise AnimalNotFoundError("動物不存在")

    existing = db.execute(
        select(Visit).where(
            Visit.animal_id == animal.id,
            Visit.clinic_id == clinic_id,
            Visit.status.in_(_ACTIVE_STATUSES_FOR_DUPLICATE_CHECK),
        ).limit(1)
    ).scalar_one_or_none()
    if existing:
        raise DuplicateVisitError("此動物已有進行中的就診（含住院），請先結束後再掛號")

    visit = Visit(
        organization_id=organization_id,
        clinic_id=clinic_id,
        animal_id=animal.id,
        owner_id=animal.owner_id,
        status=VS.REGISTERED,
        priority=priority,
        chief_complaint=chief_complaint,
        created_by=user_id,
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit


# ── 狀態轉換 ──────────────────────────────────────────────────

def change_visit_status(
    *,
    visit: Visit,
    new_status: str,
    user_id: int,
    db: Session,
) -> Visit:
    """
    變更就診狀態：
    1. 檢查有無 active admission（有的話須走出院流程）
    2. 驗證狀態轉換合法
    3. 更新狀態 + 記錄 VisitStatusHistory
    """
    # 檢查 active admission
    active_admission = db.execute(
        select(Admission).where(
            Admission.visit_id == visit.id,
            Admission.status == "active",
        )
    ).scalar_one_or_none()
    if active_admission:
        raise ActiveAdmissionBlockError("此就診有住院中的紀錄，請先辦理出院")

    # 驗證轉換
    allowed = VALID_TRANSITIONS.get(visit.status, set())
    if new_status not in allowed:
        raise InvalidTransitionError(
            f"不允許從 '{visit.status}' 轉換至 '{new_status}'"
        )

    old_status = visit.status
    visit.status = new_status
    now = datetime.now(timezone.utc)
    if new_status == VS.ADMITTED:
        visit.admitted_at = now
    elif new_status == VS.COMPLETED:
        visit.completed_at = now

    db.add(VisitStatusHistory(
        visit_id=visit.id,
        from_status=old_status,
        to_status=new_status,
        changed_by=user_id,
    ))

    return visit
