"""
住院管理 API（ADR-023）

  GET    /wards                                    — 查詢當前分院的病房
  GET    /wards/{ward_id}                          — 病房詳情（含病床 + 預設設備）
  POST   /visits/{visit_id}/admission              — 建立住院紀錄（入院）
  GET    /admissions/{admission_id}                — 取得住院紀錄
  GET    /admissions/{admission_id}/daily-rounds    — 巡房紀錄
  POST   /admissions/{admission_id}/daily-rounds    — 新增巡房紀錄
  GET    /admissions/{admission_id}/nursing-logs    — 住院護理紀錄
  POST   /admissions/{admission_id}/nursing-logs    — 新增住院護理紀錄
  GET    /admissions/{admission_id}/orders          — 住院醫囑
  POST   /admissions/{admission_id}/orders          — 新增住院醫囑
  POST   /inpatient-orders/{order_id}/execute       — 執行醫囑（打勾）
  PATCH  /inpatient-orders/{order_id}/cancel        — 取消醫囑
  POST   /admissions/{admission_id}/transfer        — 轉床
  POST   /admissions/{admission_id}/discharge       — 出院
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_clinic_id as _get_clinic_id, get_current_user, get_token_data, require_roles
from app.models.catalogs import (
    AdmissionReason, BedType, DischargeCondition, DischargeReason,
    EquipmentItem, Frequency, NursingActionItem, OrderType,
    WardType,
)
from app.models.foundation import User
from app.models.hospitalization import (
    Admission, AdmissionEquipment, Bed, DailyRound,
    InpatientNursingLog, InpatientNursingLogAction,
    InpatientOrder, InpatientOrderExecution, Ward, WardDefaultEquipment,
)
from app.models.visits import Visit
from app.services import hospitalization_service as svc
from app.schemas.hospitalization import (
    AdmissionCreate, AdmissionRead,
    BedRead, BedTransferCreate, BedTransferRead,
    DailyRoundCreate, DailyRoundRead,
    DischargeCreate, DischargeRead,
    InpatientNursingLogCreate, InpatientNursingLogRead,
    InpatientOrderCreate, InpatientOrderRead,
    OrderExecutionCreate, OrderExecutionRead,
    WardDetailRead, WardRead,
)

router = APIRouter(tags=["住院管理"])


# ── 住院 Catalog 查詢（供表單下拉用）─────────────────────────

@router.get("/hospitalization/catalogs")
def list_hospitalization_catalogs(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    """一次取得所有住院相關 catalog（供表單下拉用）"""
    org_id = token_data.get("org_id")

    def _active(model):
        return db.execute(
            select(model).where(model.organization_id == org_id, model.is_active.is_(True))
            .order_by(model.name)
        ).scalars().all()

    def _to_list(rows):
        return [{"id": r.id, "name": r.name} for r in rows]

    admission_reasons = _to_list(_active(AdmissionReason))
    equipment_items = _to_list(_active(EquipmentItem))
    nursing_actions = _to_list(_active(NursingActionItem))
    order_types = _to_list(_active(OrderType))
    discharge_reasons = _to_list(_active(DischargeReason))
    discharge_conditions = _to_list(_active(DischargeCondition))

    # frequencies 有 code
    freq_rows = db.execute(
        select(Frequency).where(Frequency.organization_id == org_id, Frequency.is_active.is_(True))
        .order_by(Frequency.id)
    ).scalars().all()
    frequencies = [{"id": f.id, "code": f.code, "name": f.name} for f in freq_rows]

    return {
        "admission_reasons": admission_reasons,
        "equipment_items": equipment_items,
        "nursing_actions": nursing_actions,
        "order_types": order_types,
        "frequencies": frequencies,
        "discharge_reasons": discharge_reasons,
        "discharge_conditions": discharge_conditions,
    }


# ── 共用 helpers ──────────────────────────────────────────────


def _get_admission_or_404(admission_id: int, clinic_id: int, db: Session) -> Admission:
    admission = db.execute(
        select(Admission).where(
            Admission.id == admission_id,
            Admission.clinic_id == clinic_id,
        )
    ).scalar_one_or_none()
    if not admission:
        raise HTTPException(status_code=404, detail="住院紀錄不存在")
    return admission


# ── Wards & Beds ──────────────────────────────────────────────

@router.get("/wards", response_model=list[WardRead])
def list_wards(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    """查詢當前分院的病房（含床位統計）"""
    clinic_id = _get_clinic_id(token_data)

    wards = db.execute(
        select(Ward).where(Ward.clinic_id == clinic_id, Ward.is_active.is_(True))
        .order_by(Ward.name)
    ).scalars().all()

    # 批次查詢 ward_type names
    wt_ids = list({w.ward_type_id for w in wards})
    wt_map: dict[int, str] = {}
    if wt_ids:
        for wt in db.execute(select(WardType).where(WardType.id.in_(wt_ids))).scalars():
            wt_map[wt.id] = wt.name

    # 批次查詢床位統計
    ward_ids = [w.id for w in wards]
    bed_stats: dict[int, tuple[int, int]] = {wid: (0, 0) for wid in ward_ids}
    if ward_ids:
        rows = db.execute(
            select(
                Bed.ward_id,
                func.count().label("total"),
                func.count().filter(Bed.status == "available").label("available"),
            )
            .where(Bed.ward_id.in_(ward_ids), Bed.is_active.is_(True))
            .group_by(Bed.ward_id)
        ).all()
        for row in rows:
            bed_stats[row.ward_id] = (row.total, row.available)

    return [
        WardRead(
            id=w.id,
            clinic_id=w.clinic_id,
            ward_type_id=w.ward_type_id,
            ward_type_name=wt_map.get(w.ward_type_id, "—"),
            name=w.name,
            code=w.code,
            is_active=w.is_active,
            total_beds=bed_stats[w.id][0],
            available_beds=bed_stats[w.id][1],
        )
        for w in wards
    ]


@router.get("/wards/{ward_id}", response_model=WardDetailRead)
def get_ward_detail(
    ward_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    """病房詳情（含所有病床 + 預設設備）"""
    clinic_id = _get_clinic_id(token_data)

    ward = db.execute(
        select(Ward).where(Ward.id == ward_id, Ward.clinic_id == clinic_id)
    ).scalar_one_or_none()
    if not ward:
        raise HTTPException(status_code=404, detail="病房不存在")

    wt = db.get(WardType, ward.ward_type_id)

    # 病床
    beds = db.execute(
        select(Bed).where(Bed.ward_id == ward.id).order_by(Bed.bed_number)
    ).scalars().all()

    bt_ids = list({b.bed_type_id for b in beds})
    bt_map: dict[int, str] = {}
    if bt_ids:
        for bt in db.execute(select(BedType).where(BedType.id.in_(bt_ids))).scalars():
            bt_map[bt.id] = bt.name

    beds_read = [
        BedRead(
            id=b.id, ward_id=b.ward_id, bed_type_id=b.bed_type_id,
            bed_type_name=bt_map.get(b.bed_type_id, "—"),
            bed_number=b.bed_number, status=b.status, is_active=b.is_active,
        )
        for b in beds
    ]

    # 預設設備
    default_eq_rows = db.execute(
        select(WardDefaultEquipment, EquipmentItem)
        .join(EquipmentItem, WardDefaultEquipment.equipment_item_id == EquipmentItem.id)
        .where(WardDefaultEquipment.ward_id == ward.id)
    ).all()
    default_eq = [{"id": eq.id, "name": eq.name} for _wde, eq in default_eq_rows]

    total = len([b for b in beds if b.is_active])
    available = len([b for b in beds if b.is_active and b.status == "available"])

    return WardDetailRead(
        id=ward.id, clinic_id=ward.clinic_id,
        ward_type_id=ward.ward_type_id,
        ward_type_name=wt.name if wt else "—",
        name=ward.name, code=ward.code, is_active=ward.is_active,
        total_beds=total, available_beds=available,
        beds=beds_read, default_equipment=default_eq,
    )


@router.get("/wards/{ward_id}/occupancy")
def get_ward_occupancy(
    ward_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    """查詢病房內住院中的動物資訊（供病房總覽使用）"""
    from app.models.owners import Animal, Owner

    clinic_id = _get_clinic_id(token_data)
    ward = db.execute(
        select(Ward).where(Ward.id == ward_id, Ward.clinic_id == clinic_id)
    ).scalar_one_or_none()
    if not ward:
        raise HTTPException(status_code=404, detail="病房不存在")

    # 查詢此病房所有占用床位的 admission
    rows = db.execute(
        select(Admission, Bed)
        .join(Bed, Admission.bed_id == Bed.id)
        .where(
            Bed.ward_id == ward_id,
            Admission.status == "active",
        )
    ).all()

    if not rows:
        return []

    # 批次查詢動物和飼主
    visit_ids = [adm.visit_id for adm, _ in rows]
    visits = {v.id: v for v in db.execute(
        select(Visit).where(Visit.id.in_(visit_ids))
    ).scalars()}

    animal_ids = list({v.animal_id for v in visits.values() if v.animal_id})
    animals: dict[int, Animal] = {}
    if animal_ids:
        for a in db.execute(select(Animal).where(Animal.id.in_(animal_ids))).scalars():
            animals[a.id] = a

    owner_ids = list({a.owner_id for a in animals.values() if a.owner_id})
    owners: dict[int, Owner] = {}
    if owner_ids:
        for o in db.execute(select(Owner).where(Owner.id.in_(owner_ids))).scalars():
            owners[o.id] = o

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    result = []
    for adm, bed in rows:
        visit = visits.get(adm.visit_id)
        animal = animals.get(visit.animal_id) if visit and visit.animal_id else None
        owner = owners.get(animal.owner_id) if animal and animal.owner_id else None
        days = (now - adm.admitted_at).days + 1 if adm.admitted_at else 1

        result.append({
            "bed_id": bed.id,
            "bed_number": bed.bed_number,
            "admission_id": adm.id,
            "visit_id": adm.visit_id,
            "animal_name": animal.name if animal else "—",
            "owner_name": owner.full_name if owner else "—",
            "admitted_at": adm.admitted_at.isoformat() if adm.admitted_at else None,
            "days": days,
        })

    return result


# ── Admission（入院）─────────────────────────────────────────

def _build_admission_read(
    admission: Admission, db: Session
) -> AdmissionRead:
    bed = db.get(Bed, admission.bed_id)
    ward = db.get(Ward, bed.ward_id) if bed else None
    reason = db.get(AdmissionReason, admission.admission_reason_id)
    vet = db.get(User, admission.attending_vet_id)
    creator = db.get(User, admission.created_by)

    # 設備
    eq_rows = db.execute(
        select(AdmissionEquipment, EquipmentItem)
        .join(EquipmentItem, AdmissionEquipment.equipment_item_id == EquipmentItem.id)
        .where(AdmissionEquipment.admission_id == admission.id)
    ).all()
    equipment = [{"id": eq.id, "name": eq.name, "notes": ae.notes} for ae, eq in eq_rows]

    return AdmissionRead(
        id=admission.id,
        visit_id=admission.visit_id,
        clinic_id=admission.clinic_id,
        bed_id=admission.bed_id,
        bed_number=bed.bed_number if bed else "—",
        ward_name=ward.name if ward else "—",
        admission_reason_id=admission.admission_reason_id,
        admission_reason_name=reason.name if reason else "—",
        reason_notes=admission.reason_notes,
        attending_vet_id=admission.attending_vet_id,
        attending_vet_name=vet.full_name if vet else "—",
        status=admission.status,
        admitted_at=admission.admitted_at,
        discharged_at=admission.discharged_at,
        created_at=admission.created_at,
        created_by_name=creator.full_name if creator else "—",
        equipment=equipment,
    )


@router.post("/visits/{visit_id}/admission", response_model=AdmissionRead, status_code=201)
def create_admission(
    visit_id: int,
    body: AdmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("vet")),
    token_data: dict = Depends(get_token_data),
):
    """建立住院紀錄（入院）+ visit 狀態切換為 admitted"""
    clinic_id = _get_clinic_id(token_data)

    try:
        admission = svc.admit(
            visit_id=visit_id,
            clinic_id=clinic_id,
            bed_id=body.bed_id,
            admission_reason_id=body.admission_reason_id,
            reason_notes=body.reason_notes,
            attending_vet_id=body.attending_vet_id,
            equipment_item_ids=body.equipment_item_ids,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            db=db,
        )
    except svc.VisitNotFoundError:
        raise HTTPException(status_code=404, detail="掛號紀錄不存在")
    except svc.AdmissionConflictError:
        raise HTTPException(status_code=409, detail="此掛號已有住院紀錄")
    except svc.BedUnavailableError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return _build_admission_read(admission, db)


@router.get("/admissions/{admission_id}", response_model=AdmissionRead)
def get_admission(
    admission_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    """取得住院紀錄"""
    clinic_id = _get_clinic_id(token_data)
    admission = _get_admission_or_404(admission_id, clinic_id, db)
    return _build_admission_read(admission, db)


@router.get("/visits/{visit_id}/admission", response_model=AdmissionRead)
def get_admission_by_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    """透過 visit_id 查詢住院紀錄（前端用）"""
    clinic_id = _get_clinic_id(token_data)
    admission = db.execute(
        select(Admission).where(
            Admission.visit_id == visit_id,
            Admission.clinic_id == clinic_id,
        )
    ).scalar_one_or_none()
    if not admission:
        raise HTTPException(status_code=404, detail="此掛號無住院紀錄")
    return _build_admission_read(admission, db)


# ── Daily Rounds ──────────────────────────────────────────────

@router.get("/admissions/{admission_id}/daily-rounds", response_model=list[DailyRoundRead])
def list_daily_rounds(
    admission_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    clinic_id = _get_clinic_id(token_data)
    _get_admission_or_404(admission_id, clinic_id, db)

    rows = db.execute(
        select(DailyRound)
        .where(DailyRound.admission_id == admission_id, DailyRound.is_superseded.is_(False))
        .order_by(DailyRound.round_date.desc())
    ).scalars().all()

    user_ids = list({r.created_by for r in rows})
    users_map: dict[int, User] = {}
    if user_ids:
        for u in db.execute(select(User).where(User.id.in_(user_ids))).scalars():
            users_map[u.id] = u

    return [
        DailyRoundRead(
            id=r.id, admission_id=r.admission_id, round_date=r.round_date,
            assessment=r.assessment, plan=r.plan, is_superseded=r.is_superseded,
            created_at=r.created_at,
            created_by_name=users_map.get(r.created_by, User()).full_name if r.created_by in users_map else None,
        )
        for r in rows
    ]


@router.post("/admissions/{admission_id}/daily-rounds", response_model=DailyRoundRead, status_code=201)
def create_daily_round(
    admission_id: int,
    body: DailyRoundCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("vet")),
    token_data: dict = Depends(get_token_data),
):
    clinic_id = _get_clinic_id(token_data)
    admission = _get_admission_or_404(admission_id, clinic_id, db)
    if admission.status != "active":
        raise HTTPException(status_code=400, detail="此住院已結束，無法新增巡房紀錄")

    dr = DailyRound(
        admission_id=admission_id,
        round_date=body.round_date,
        assessment=body.assessment,
        plan=body.plan,
        created_by=current_user.id,
    )
    db.add(dr)
    db.commit()
    db.refresh(dr)

    return DailyRoundRead(
        id=dr.id, admission_id=dr.admission_id, round_date=dr.round_date,
        assessment=dr.assessment, plan=dr.plan, is_superseded=dr.is_superseded,
        created_at=dr.created_at, created_by_name=current_user.full_name,
    )


# ── Inpatient Nursing Logs ────────────────────────────────────

@router.get("/admissions/{admission_id}/nursing-logs", response_model=list[InpatientNursingLogRead])
def list_nursing_logs(
    admission_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    clinic_id = _get_clinic_id(token_data)
    _get_admission_or_404(admission_id, clinic_id, db)

    logs = db.execute(
        select(InpatientNursingLog)
        .where(InpatientNursingLog.admission_id == admission_id, InpatientNursingLog.is_superseded.is_(False))
        .order_by(InpatientNursingLog.created_at.desc())
    ).scalars().all()

    if not logs:
        return []

    # 批次查詢 actions
    log_ids = [lg.id for lg in logs]
    actions_map: dict[int, list[dict]] = {lid: [] for lid in log_ids}
    action_rows = db.execute(
        select(InpatientNursingLogAction, NursingActionItem)
        .join(NursingActionItem, InpatientNursingLogAction.action_item_id == NursingActionItem.id)
        .where(InpatientNursingLogAction.nursing_log_id.in_(log_ids))
    ).all()
    for la, ai in action_rows:
        actions_map[la.nursing_log_id].append({"id": ai.id, "name": ai.name})

    user_ids = list({lg.created_by for lg in logs})
    users_map: dict[int, User] = {}
    if user_ids:
        for u in db.execute(select(User).where(User.id.in_(user_ids))).scalars():
            users_map[u.id] = u

    return [
        InpatientNursingLogRead(
            id=lg.id, admission_id=lg.admission_id, notes=lg.notes,
            actions=actions_map[lg.id], is_superseded=lg.is_superseded,
            created_at=lg.created_at,
            created_by_name=users_map[lg.created_by].full_name if lg.created_by in users_map else None,
        )
        for lg in logs
    ]


@router.post("/admissions/{admission_id}/nursing-logs", response_model=InpatientNursingLogRead, status_code=201)
def create_nursing_log(
    admission_id: int,
    body: InpatientNursingLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("vet", "nurse")),
    token_data: dict = Depends(get_token_data),
):
    clinic_id = _get_clinic_id(token_data)
    admission = _get_admission_or_404(admission_id, clinic_id, db)
    if admission.status != "active":
        raise HTTPException(status_code=400, detail="此住院已結束，無法新增護理紀錄")

    log = InpatientNursingLog(
        admission_id=admission_id,
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(log)
    db.flush()

    actions = []
    for aid in body.action_item_ids:
        la = InpatientNursingLogAction(nursing_log_id=log.id, action_item_id=aid)
        db.add(la)
        actions.append(la)

    db.commit()
    db.refresh(log)

    # 查詢 action names
    action_dicts = []
    if body.action_item_ids:
        for ai in db.execute(
            select(NursingActionItem).where(NursingActionItem.id.in_(body.action_item_ids))
        ).scalars():
            action_dicts.append({"id": ai.id, "name": ai.name})

    return InpatientNursingLogRead(
        id=log.id, admission_id=log.admission_id, notes=log.notes,
        actions=action_dicts, is_superseded=log.is_superseded,
        created_at=log.created_at, created_by_name=current_user.full_name,
    )


# ── Inpatient Orders ──────────────────────────────────────────

@router.get("/admissions/{admission_id}/orders", response_model=list[InpatientOrderRead])
def list_inpatient_orders(
    admission_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    clinic_id = _get_clinic_id(token_data)
    _get_admission_or_404(admission_id, clinic_id, db)

    orders = db.execute(
        select(InpatientOrder)
        .where(InpatientOrder.admission_id == admission_id, InpatientOrder.is_superseded.is_(False))
        .order_by(InpatientOrder.created_at.desc())
    ).scalars().all()

    if not orders:
        return []

    # 批次查詢關聯
    ot_ids = list({o.order_type_id for o in orders})
    ot_map: dict[int, str] = {}
    if ot_ids:
        for ot in db.execute(select(OrderType).where(OrderType.id.in_(ot_ids))).scalars():
            ot_map[ot.id] = ot.name

    freq_ids = list({o.frequency_id for o in orders if o.frequency_id})
    freq_map: dict[int, Frequency] = {}
    if freq_ids:
        for f in db.execute(select(Frequency).where(Frequency.id.in_(freq_ids))).scalars():
            freq_map[f.id] = f

    user_ids = list({o.created_by for o in orders})
    users_map: dict[int, User] = {}
    if user_ids:
        for u in db.execute(select(User).where(User.id.in_(user_ids))).scalars():
            users_map[u.id] = u

    # 批次查詢執行紀錄
    order_ids = [o.id for o in orders]
    exec_map: dict[int, list[OrderExecutionRead]] = {oid: [] for oid in order_ids}
    if order_ids:
        execs = db.execute(
            select(InpatientOrderExecution)
            .where(InpatientOrderExecution.order_id.in_(order_ids))
            .order_by(InpatientOrderExecution.executed_at)
        ).scalars().all()
        exec_user_ids = list({e.created_by for e in execs})
        for uid in exec_user_ids:
            if uid not in users_map:
                u = db.get(User, uid)
                if u:
                    users_map[u.id] = u
        for e in execs:
            exec_map[e.order_id].append(OrderExecutionRead(
                id=e.id, order_id=e.order_id, executed_at=e.executed_at,
                notes=e.notes,
                created_by_name=users_map[e.created_by].full_name if e.created_by in users_map else None,
            ))

    return [
        InpatientOrderRead(
            id=o.id, admission_id=o.admission_id,
            order_type_id=o.order_type_id,
            order_type_name=ot_map.get(o.order_type_id, "—"),
            description=o.description,
            frequency_id=o.frequency_id,
            frequency_code=freq_map[o.frequency_id].code if o.frequency_id and o.frequency_id in freq_map else None,
            frequency_name=freq_map[o.frequency_id].name if o.frequency_id and o.frequency_id in freq_map else None,
            start_at=o.start_at, end_at=o.end_at, status=o.status,
            is_superseded=o.is_superseded, created_at=o.created_at,
            created_by_name=users_map[o.created_by].full_name if o.created_by in users_map else None,
            executions=exec_map[o.id],
        )
        for o in orders
    ]


@router.post("/admissions/{admission_id}/orders", response_model=InpatientOrderRead, status_code=201)
def create_inpatient_order(
    admission_id: int,
    body: InpatientOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("vet")),
    token_data: dict = Depends(get_token_data),
):
    clinic_id = _get_clinic_id(token_data)
    admission = _get_admission_or_404(admission_id, clinic_id, db)
    if admission.status != "active":
        raise HTTPException(status_code=400, detail="此住院已結束，無法新增醫囑")

    order = InpatientOrder(
        admission_id=admission_id,
        order_type_id=body.order_type_id,
        description=body.description,
        frequency_id=body.frequency_id,
        end_at=body.end_at,
        created_by=current_user.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    ot = db.get(OrderType, order.order_type_id)
    freq = db.get(Frequency, order.frequency_id) if order.frequency_id else None

    return InpatientOrderRead(
        id=order.id, admission_id=order.admission_id,
        order_type_id=order.order_type_id,
        order_type_name=ot.name if ot else "—",
        description=order.description,
        frequency_id=order.frequency_id,
        frequency_code=freq.code if freq else None,
        frequency_name=freq.name if freq else None,
        start_at=order.start_at, end_at=order.end_at, status=order.status,
        is_superseded=order.is_superseded, created_at=order.created_at,
        created_by_name=current_user.full_name,
        executions=[],
    )


# ── Order Execution ───────────────────────────────────────────

@router.post("/inpatient-orders/{order_id}/execute", response_model=OrderExecutionRead, status_code=201)
def execute_order(
    order_id: int,
    body: OrderExecutionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("vet", "nurse", "technician")),
    token_data: dict = Depends(get_token_data),
):
    """執行住院醫囑（護理師打勾）"""
    clinic_id = _get_clinic_id(token_data)

    order = db.execute(
        select(InpatientOrder)
        .join(Admission, InpatientOrder.admission_id == Admission.id)
        .where(
            InpatientOrder.id == order_id,
            Admission.clinic_id == clinic_id,
            InpatientOrder.is_superseded.is_(False),
        )
    ).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="住院醫囑不存在")
    if order.status != "active":
        raise HTTPException(status_code=400, detail="此醫囑已結束或取消")

    execution = InpatientOrderExecution(
        order_id=order_id,
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    return OrderExecutionRead(
        id=execution.id, order_id=execution.order_id,
        executed_at=execution.executed_at, notes=execution.notes,
        created_by_name=current_user.full_name,
    )


@router.patch("/inpatient-orders/{order_id}/cancel", response_model=InpatientOrderRead)
def cancel_inpatient_order(
    order_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_roles("vet")),
    token_data: dict = Depends(get_token_data),
):
    """取消住院醫囑"""
    clinic_id = _get_clinic_id(token_data)

    order = db.execute(
        select(InpatientOrder)
        .join(Admission, InpatientOrder.admission_id == Admission.id)
        .where(
            InpatientOrder.id == order_id,
            Admission.clinic_id == clinic_id,
            InpatientOrder.is_superseded.is_(False),
        )
    ).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="住院醫囑不存在")
    if order.status != "active":
        raise HTTPException(status_code=400, detail="此醫囑已結束或取消")

    order.status = "cancelled"
    db.commit()
    db.refresh(order)

    ot = db.get(OrderType, order.order_type_id)
    freq = db.get(Frequency, order.frequency_id) if order.frequency_id else None

    return InpatientOrderRead(
        id=order.id, admission_id=order.admission_id,
        order_type_id=order.order_type_id,
        order_type_name=ot.name if ot else "—",
        description=order.description,
        frequency_id=order.frequency_id,
        frequency_code=freq.code if freq else None,
        frequency_name=freq.name if freq else None,
        start_at=order.start_at, end_at=order.end_at, status=order.status,
        is_superseded=order.is_superseded, created_at=order.created_at,
        created_by_name=None,
        executions=[],
    )


# ── Bed Transfer ──────────────────────────────────────────────

@router.post("/admissions/{admission_id}/transfer", response_model=BedTransferRead, status_code=201)
def transfer_bed_endpoint(
    admission_id: int,
    body: BedTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("vet", "nurse")),
    token_data: dict = Depends(get_token_data),
):
    """轉床（同類型直接轉；跨類型同時建立巡房紀錄）"""
    clinic_id = _get_clinic_id(token_data)
    admission = _get_admission_or_404(admission_id, clinic_id, db)

    try:
        transfer, _is_cross_type = svc.transfer_bed(
            admission=admission,
            to_bed_id=body.to_bed_id,
            clinic_id=clinic_id,
            assessment=body.assessment,
            plan=body.plan,
            user_id=current_user.id,
            db=db,
        )
    except svc.AdmissionNotActiveError:
        raise HTTPException(status_code=400, detail="此住院已結束，無法轉床")
    except svc.BedUnavailableError as e:
        raise HTTPException(status_code=409, detail=str(e))

    from_bed = db.get(Bed, transfer.from_bed_id)
    to_bed = db.get(Bed, transfer.to_bed_id)

    return BedTransferRead(
        id=transfer.id, admission_id=transfer.admission_id,
        from_bed_id=transfer.from_bed_id,
        from_bed_number=from_bed.bed_number if from_bed else "—",
        to_bed_id=transfer.to_bed_id,
        to_bed_number=to_bed.bed_number if to_bed else "—",
        transferred_at=transfer.transferred_at,
        transferred_by_name=current_user.full_name,
    )


# ── Discharge（出院）─────────────────────────────────────────

@router.post("/admissions/{admission_id}/discharge", response_model=DischargeRead, status_code=201)
def discharge_admission(
    admission_id: int,
    body: DischargeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("vet")),
    token_data: dict = Depends(get_token_data),
):
    """出院：建立出院紀錄 + admission→discharged + bed→available + visit 狀態依選擇"""
    clinic_id = _get_clinic_id(token_data)
    admission = _get_admission_or_404(admission_id, clinic_id, db)

    try:
        record = svc.discharge(
            admission=admission,
            discharge_reason_id=body.discharge_reason_id,
            discharge_condition_id=body.discharge_condition_id,
            discharge_notes=body.discharge_notes,
            follow_up_plan=body.follow_up_plan,
            post_discharge_status=body.post_discharge_status,
            user_id=current_user.id,
            db=db,
        )
    except svc.AdmissionNotActiveError:
        raise HTTPException(status_code=400, detail="此住院已結束")
    except svc.InvalidPostDischargeStatusError as e:
        raise HTTPException(status_code=422, detail=str(e))

    reason = db.get(DischargeReason, record.discharge_reason_id)
    condition = db.get(DischargeCondition, record.discharge_condition_id)

    return DischargeRead(
        id=record.id, admission_id=record.admission_id,
        discharge_reason_id=record.discharge_reason_id,
        discharge_reason_name=reason.name if reason else "—",
        discharge_condition_id=record.discharge_condition_id,
        discharge_condition_name=condition.name if condition else "—",
        discharge_notes=record.discharge_notes,
        follow_up_plan=record.follow_up_plan,
        discharged_at=record.discharged_at,
        discharged_by_name=current_user.full_name,
    )
