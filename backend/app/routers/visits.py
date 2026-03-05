"""
掛號 & 候診 API
  GET    /visits           — 取得候診清單（依分院 + 日期過濾）
  POST   /visits           — 新增掛號
  PATCH  /visits/{id}      — 更新掛號（狀態 / 優先度 / 負責獸醫）
"""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case as sa_case, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_token_data
from app.models.catalogs import Species
from app.models.foundation import User
from app.models.owners import Animal, Owner
from app.models.visits import Visit
from app.schemas.visits import (
    VisitCreate,
    VisitListItem,
    VisitListResponse,
    VisitUpdate,
)

router = APIRouter(prefix="/visits", tags=["掛號 & 候診"])

# ── 狀態轉換允許矩陣 ──────────────────────────────────────────

VALID_TRANSITIONS: dict[str, set[str]] = {
    "registered":       {"triaged", "in_consultation", "cancelled"},
    "triaged":          {"in_consultation", "cancelled"},
    "in_consultation":  {"pending_results", "completed", "admitted", "cancelled"},
    "pending_results":  {"in_consultation", "completed", "cancelled"},
    "completed":        set(),
    "admitted":         set(),
    "cancelled":        set(),
}


def _get_clinic_id(token_data: dict) -> int:
    clinic_id = token_data.get("clinic_id")
    if not clinic_id:
        raise HTTPException(status_code=400, detail="請先選擇分院後再操作")
    return int(clinic_id)


def _get_visit_or_404(visit_id: int, clinic_id: int, db: Session) -> Visit:
    visit = db.execute(
        select(Visit).where(
            Visit.id == visit_id,
            Visit.clinic_id == clinic_id,
        )
    ).scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="掛號紀錄不存在")
    return visit


def _build_list_item(
    visit: Visit,
    animal: Optional[Animal],
    owner: Optional[Owner],
    species: Optional[Species],
    vet: Optional[User],
) -> VisitListItem:
    return VisitListItem(
        id=visit.id,
        animal_id=visit.animal_id,
        animal_name=animal.name if animal else None,
        species_name=species.name if species else None,
        owner_id=visit.owner_id,
        owner_name=owner.full_name if owner else None,
        attending_vet_id=visit.attending_vet_id,
        attending_vet_name=vet.full_name if vet else None,
        status=visit.status,
        priority=visit.priority,
        chief_complaint=visit.chief_complaint,
        is_emergency=visit.is_emergency,
        registered_at=visit.registered_at,
    )


def _resolve_relations(
    visits: list[Visit], db: Session
) -> tuple[dict[int, Animal], dict[int, Owner], dict[int, Species], dict[int, User]]:
    """批次載入關聯物件，避免 N+1"""
    animal_ids = [v.animal_id for v in visits if v.animal_id]
    owner_ids  = [v.owner_id  for v in visits if v.owner_id]
    vet_ids    = [v.attending_vet_id for v in visits if v.attending_vet_id]

    animals_map: dict[int, Animal] = {}
    if animal_ids:
        for a in db.execute(select(Animal).where(Animal.id.in_(animal_ids))).scalars():
            animals_map[a.id] = a

    owners_map: dict[int, Owner] = {}
    if owner_ids:
        for o in db.execute(select(Owner).where(Owner.id.in_(owner_ids))).scalars():
            owners_map[o.id] = o

    vets_map: dict[int, User] = {}
    if vet_ids:
        for u in db.execute(select(User).where(User.id.in_(vet_ids))).scalars():
            vets_map[u.id] = u

    species_ids = list({a.species_id for a in animals_map.values()})
    species_map: dict[int, Species] = {}
    if species_ids:
        for sp in db.execute(select(Species).where(Species.id.in_(species_ids))).scalars():
            species_map[sp.id] = sp

    return animals_map, owners_map, species_map, vets_map


# ── GET /visits ──────────────────────────────────────────────

@router.get("", response_model=VisitListResponse)
def list_visits(
    visit_date: Optional[date] = Query(None, description="過濾日期（預設今天，UTC）"),
    status: Optional[str] = Query(None, description="狀態過濾（逗號分隔多值）"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    """取得候診清單，預設顯示今天的掛號記錄"""
    clinic_id   = _get_clinic_id(token_data)
    target_date = visit_date or date.today()

    day_start = datetime(
        target_date.year, target_date.month, target_date.day, tzinfo=timezone.utc
    )
    day_end = day_start + timedelta(days=1)

    base_q = select(Visit).where(
        Visit.clinic_id == clinic_id,
        Visit.registered_at >= day_start,
        Visit.registered_at < day_end,
    )

    if status:
        status_list = [s.strip() for s in status.split(",") if s.strip()]
        if status_list:
            base_q = base_q.where(Visit.status.in_(status_list))

    base_q = base_q.order_by(
        sa_case((Visit.priority == "urgent", 0), else_=1),
        Visit.registered_at,
    )

    visits = db.execute(base_q).scalars().all()
    animals_map, owners_map, species_map, vets_map = _resolve_relations(visits, db)

    items = []
    for v in visits:
        animal  = animals_map.get(v.animal_id)       if v.animal_id        else None
        owner   = owners_map.get(v.owner_id)          if v.owner_id         else None
        vet     = vets_map.get(v.attending_vet_id)    if v.attending_vet_id else None
        species = species_map.get(animal.species_id)  if animal             else None
        items.append(_build_list_item(v, animal, owner, species, vet))

    return VisitListResponse(items=items, total=len(items))


# ── POST /visits ─────────────────────────────────────────────

@router.post("", response_model=VisitListItem, status_code=201)
def create_visit(
    body: VisitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    """新增掛號"""
    clinic_id = _get_clinic_id(token_data)

    animal = db.execute(
        select(Animal).where(
            Animal.id == body.animal_id,
            Animal.organization_id == current_user.organization_id,
        )
    ).scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="動物不存在")

    # 重複掛號防護：同一動物今日已有進行中的掛號
    today = date.today()
    day_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    existing = db.execute(
        select(Visit).where(
            Visit.animal_id == animal.id,
            Visit.clinic_id == clinic_id,
            Visit.status.in_(["registered", "triaged", "in_consultation", "pending_results"]),
            Visit.registered_at >= day_start,
            Visit.registered_at < day_end,
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="此動物今日已有進行中的掛號")

    visit = Visit(
        organization_id=current_user.organization_id,
        clinic_id=clinic_id,
        animal_id=animal.id,
        owner_id=animal.owner_id,
        status="registered",
        priority=body.priority,
        chief_complaint=body.chief_complaint,
        created_by=current_user.id,
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)

    owner   = db.get(Owner,   animal.owner_id)  if animal.owner_id  else None
    species = db.get(Species, animal.species_id)
    return _build_list_item(visit, animal, owner, species, None)


# ── PATCH /visits/{id} ───────────────────────────────────────

@router.patch("/{visit_id}", response_model=VisitListItem)
def update_visit(
    visit_id: int,
    body: VisitUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    """更新掛號（狀態轉換 / 優先度 / 負責獸醫）"""
    clinic_id = _get_clinic_id(token_data)
    visit     = _get_visit_or_404(visit_id, clinic_id, db)

    if body.status is not None and body.status != visit.status:
        allowed = VALID_TRANSITIONS.get(visit.status, set())
        if body.status not in allowed:
            raise HTTPException(
                status_code=422,
                detail=f"不允許從 '{visit.status}' 轉換至 '{body.status}'",
            )
        visit.status = body.status
        if body.status == "completed":
            visit.completed_at = datetime.now(timezone.utc)

    if body.priority is not None:
        visit.priority = body.priority

    if body.attending_vet_id is not None:
        visit.attending_vet_id = body.attending_vet_id

    if body.chief_complaint is not None:
        visit.chief_complaint = body.chief_complaint

    db.commit()
    db.refresh(visit)

    animal  = db.get(Animal,  visit.animal_id)        if visit.animal_id        else None
    owner   = db.get(Owner,   visit.owner_id)          if visit.owner_id         else None
    vet     = db.get(User,    visit.attending_vet_id)  if visit.attending_vet_id else None
    species = db.get(Species, animal.species_id)       if animal                 else None
    return _build_list_item(visit, animal, owner, species, vet)
