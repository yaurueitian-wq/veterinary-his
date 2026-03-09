"""
臨床記錄 API（append-only，ADR-007）
  前綴：/visits/{visit_id}

  GET/POST  /visits/{visit_id}/vital-signs
  GET/POST  /visits/{visit_id}/soap-notes
  GET/POST  /visits/{visit_id}/nursing-notes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_token_data, require_roles
from app.models.catalogs import LabAnalyte, LabTestType, MucousMembraneColor
from app.models.clinical import (
    LabOrder, LabResultItem, NursingNote, SoapDiagnosis, SoapNote, VitalSign,
)
from app.models.foundation import User
from app.models.visits import Visit
from app.schemas.clinical import (
    ClinicalSummary,
    LabOrderCreate,
    LabOrderRead,
    LabResultItemRead,
    LabResultSubmit,
    NursingNoteCreate,
    NursingNoteRead,
    SoapNoteCreate,
    SoapNoteRead,
    VitalSignCreate,
    VitalSignRead,
)

router = APIRouter(prefix="/visits/{visit_id}", tags=["臨床記錄"])


# ── 共用：取得就診並驗證分院 ──────────────────────────────────

def _get_visit(visit_id: int, clinic_id: int, db: Session) -> Visit:
    visit = db.execute(
        select(Visit).where(
            Visit.id == visit_id,
            Visit.clinic_id == clinic_id,
        )
    ).scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="掛號紀錄不存在")
    return visit


def _get_clinic_id(token_data: dict) -> int:
    clinic_id = token_data.get("clinic_id")
    if not clinic_id:
        raise HTTPException(status_code=400, detail="請先選擇分院後再操作")
    return int(clinic_id)


# ── Vital Signs ───────────────────────────────────────────────

def _vs_to_read(
    vs: VitalSign,
    users_map: dict[int, User],
    colors_map: dict[int, MucousMembraneColor] | None = None,
) -> VitalSignRead:
    user = users_map.get(vs.created_by)
    color = (colors_map or {}).get(vs.mucous_membrane_color_id) if vs.mucous_membrane_color_id else None
    return VitalSignRead.model_validate({
        **vs.__dict__,
        "created_by_name": user.full_name if user else None,
        "mucous_membrane_color_name": color.name if color else None,
    })


@router.get("/vital-signs", response_model=list[VitalSignRead])
def list_vital_signs(
    visit_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    clinic_id = _get_clinic_id(token_data)
    _get_visit(visit_id, clinic_id, db)

    rows = db.execute(
        select(VitalSign)
        .where(VitalSign.visit_id == visit_id)
        .order_by(VitalSign.created_at.desc())
    ).scalars().all()

    user_ids = list({r.created_by for r in rows})
    users_map: dict[int, User] = {}
    if user_ids:
        for u in db.execute(select(User).where(User.id.in_(user_ids))).scalars():
            users_map[u.id] = u

    color_ids = list({r.mucous_membrane_color_id for r in rows if r.mucous_membrane_color_id})
    colors_map: dict[int, MucousMembraneColor] = {}
    if color_ids:
        for c in db.execute(select(MucousMembraneColor).where(MucousMembraneColor.id.in_(color_ids))).scalars():
            colors_map[c.id] = c

    return [_vs_to_read(r, users_map, colors_map) for r in rows]


@router.post("/vital-signs", response_model=VitalSignRead, status_code=201)
def create_vital_sign(
    visit_id: int,
    body: VitalSignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("vet", "nurse")),
    token_data: dict = Depends(get_token_data),
):
    clinic_id = _get_clinic_id(token_data)
    _get_visit(visit_id, clinic_id, db)

    vs = VitalSign(
        visit_id=visit_id,
        created_by=current_user.id,
        **body.model_dump(exclude_none=True),
    )
    db.add(vs)
    db.commit()
    db.refresh(vs)

    colors_map: dict[int, MucousMembraneColor] = {}
    if vs.mucous_membrane_color_id:
        color = db.get(MucousMembraneColor, vs.mucous_membrane_color_id)
        if color:
            colors_map[color.id] = color

    return _vs_to_read(vs, {current_user.id: current_user}, colors_map)


# ── SOAP Notes ────────────────────────────────────────────────

@router.get("/soap-notes", response_model=list[SoapNoteRead])
def list_soap_notes(
    visit_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    clinic_id = _get_clinic_id(token_data)
    _get_visit(visit_id, clinic_id, db)

    notes = db.execute(
        select(SoapNote)
        .where(SoapNote.visit_id == visit_id)
        .order_by(SoapNote.created_at.desc())
    ).scalars().all()

    # 批次查詢紀錄人姓名
    note_user_ids = list({n.created_by for n in notes if n.created_by})
    users_map: dict[int, User] = {}
    if note_user_ids:
        for u in db.execute(select(User).where(User.id.in_(note_user_ids))).scalars():
            users_map[u.id] = u

    # 組裝 diagnoses（含紀錄人）
    note_ids = [n.id for n in notes]
    diags_raw: list[SoapDiagnosis] = []
    diagnoses_map: dict[int, list[dict]] = {n.id: [] for n in notes}
    if note_ids:
        diags_raw = db.execute(
            select(SoapDiagnosis)
            .where(SoapDiagnosis.soap_note_id.in_(note_ids))
            .order_by(SoapDiagnosis.created_at)
        ).scalars().all()

    # 批次查詢 diagnosis 紀錄人
    diag_user_ids = list({d.created_by for d in diags_raw if d.created_by})
    for uid in diag_user_ids:
        if uid not in users_map:
            u = db.get(User, uid)
            if u:
                users_map[u.id] = u

    for diag in diags_raw:
        diag_user = users_map.get(diag.created_by)
        diagnoses_map[diag.soap_note_id].append({
            **diag.__dict__,
            "created_by_name": diag_user.full_name if diag_user else None,
        })

    result = []
    for note in notes:
        note_user = users_map.get(note.created_by)
        note_dict = {
            "id": note.id,
            "visit_id": note.visit_id,
            "subjective": note.subjective,
            "objective": note.objective,
            "assessment": note.assessment,
            "plan": note.plan,
            "is_superseded": note.is_superseded,
            "created_at": note.created_at,
            "created_by_name": note_user.full_name if note_user else None,
            "diagnoses": diagnoses_map[note.id],
        }
        result.append(SoapNoteRead.model_validate(note_dict))
    return result


@router.post("/soap-notes", response_model=SoapNoteRead, status_code=201)
def create_soap_note(
    visit_id: int,
    body: SoapNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("vet")),
    token_data: dict = Depends(get_token_data),
):
    clinic_id = _get_clinic_id(token_data)
    _get_visit(visit_id, clinic_id, db)

    note = SoapNote(
        visit_id=visit_id,
        created_by=current_user.id,
        subjective=body.subjective,
        objective=body.objective,
        assessment=body.assessment,
        plan=body.plan,
    )
    db.add(note)
    db.flush()  # 取得 note.id 以便建立 diagnoses

    diagnoses: list[SoapDiagnosis] = []
    for d in body.diagnoses:
        diag = SoapDiagnosis(
            soap_note_id=note.id,
            free_text=d.free_text,
            created_by=current_user.id,
        )
        db.add(diag)
        diagnoses.append(diag)

    db.commit()
    db.refresh(note)
    for diag in diagnoses:
        db.refresh(diag)

    diag_dicts = [
        {**d.__dict__, "created_by_name": current_user.full_name}
        for d in diagnoses
    ]
    return SoapNoteRead.model_validate({
        "id": note.id,
        "visit_id": note.visit_id,
        "subjective": note.subjective,
        "objective": note.objective,
        "assessment": note.assessment,
        "plan": note.plan,
        "is_superseded": note.is_superseded,
        "created_at": note.created_at,
        "created_by_name": current_user.full_name,
        "diagnoses": diag_dicts,
    })


# ── Nursing Notes ─────────────────────────────────────────────

@router.get("/nursing-notes", response_model=list[NursingNoteRead])
def list_nursing_notes(
    visit_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    clinic_id = _get_clinic_id(token_data)
    _get_visit(visit_id, clinic_id, db)

    rows = db.execute(
        select(NursingNote)
        .where(NursingNote.visit_id == visit_id)
        .order_by(NursingNote.created_at.desc())
    ).scalars().all()
    return rows


@router.post("/nursing-notes", response_model=NursingNoteRead, status_code=201)
def create_nursing_note(
    visit_id: int,
    body: NursingNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("vet", "nurse")),
    token_data: dict = Depends(get_token_data),
):
    clinic_id = _get_clinic_id(token_data)
    _get_visit(visit_id, clinic_id, db)

    nn = NursingNote(
        visit_id=visit_id,
        note_text=body.note_text,
        created_by=current_user.id,
    )
    db.add(nn)
    db.commit()
    db.refresh(nn)
    return nn


# ── Clinical Summary（看板卡片用） ────────────────────────────────

@router.get("/clinical-summary", response_model=ClinicalSummary)
def get_clinical_summary(
    visit_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    """取得最新生命徵象 + 主診斷，供看板卡片快速顯示"""
    clinic_id = _get_clinic_id(token_data)
    _get_visit(visit_id, clinic_id, db)

    # 最新一筆生命徵象
    vs = db.execute(
        select(VitalSign)
        .where(VitalSign.visit_id == visit_id)
        .order_by(VitalSign.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    # 最新 SoapNote 的主診斷
    note = db.execute(
        select(SoapNote)
        .where(SoapNote.visit_id == visit_id)
        .order_by(SoapNote.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    diag_text: str | None = None
    if note:
        diag = db.execute(
            select(SoapDiagnosis)
            .where(
                SoapDiagnosis.soap_note_id == note.id,
                SoapDiagnosis.is_superseded.is_(False),
            )
            .order_by(SoapDiagnosis.created_at)
            .limit(1)
        ).scalar_one_or_none()
        if diag:
            diag_text = diag.free_text

    # 是否有 pending lab orders
    pending_lab = db.execute(
        select(LabOrder).where(
            LabOrder.visit_id == visit_id,
            LabOrder.status == "pending",
            LabOrder.is_superseded.is_(False),
        ).limit(1)
    ).scalar_one_or_none()

    return ClinicalSummary(
        latest_weight_kg=vs.weight_kg if vs else None,
        latest_temperature_c=float(vs.temperature_c) if vs and vs.temperature_c is not None else None,
        latest_heart_rate_bpm=vs.heart_rate_bpm if vs else None,
        latest_diagnosis=diag_text,
        has_pending_lab=pending_lab is not None,
    )


# ── Lab Orders ────────────────────────────────────────────────

def _build_order_read(
    order: LabOrder,
    test_type_name: str,
    users_map: dict[int, User],
    analytes_map: dict[int, LabAnalyte],
    result_items: list[LabResultItem],
) -> LabOrderRead:
    items_read = []
    for ri in result_items:
        analyte = analytes_map.get(ri.analyte_id)
        ri_user = users_map.get(ri.created_by)
        items_read.append(LabResultItemRead(
            id=ri.id,
            analyte_id=ri.analyte_id,
            analyte_name=analyte.name if analyte else "—",
            unit=analyte.unit if analyte else None,
            analyte_type=analyte.analyte_type if analyte else "numeric",
            value_numeric=float(ri.value_numeric) if ri.value_numeric is not None else None,
            value_text=ri.value_text,
            is_abnormal=ri.is_abnormal,
            notes=ri.notes,
            is_superseded=ri.is_superseded,
            created_at=ri.created_at,
            created_by_name=ri_user.full_name if ri_user else None,
        ))

    ordered_by_user = users_map.get(order.ordered_by)
    resulted_by_user = users_map.get(order.resulted_by) if order.resulted_by else None
    return LabOrderRead(
        id=order.id,
        visit_id=order.visit_id,
        test_type_id=order.test_type_id,
        test_type_name=test_type_name,
        status=order.status,
        notes=order.notes,
        resulted_at=order.resulted_at,
        resulted_by_name=resulted_by_user.full_name if resulted_by_user else None,
        is_superseded=order.is_superseded,
        created_at=order.created_at,
        created_by_name=ordered_by_user.full_name if ordered_by_user else None,
        result_items=items_read,
    )


def _load_order_context(
    orders: list[LabOrder], db: Session
) -> tuple[dict[int, str], dict[int, User], dict[int, LabAnalyte], dict[int, list[LabResultItem]]]:
    """批次載入 lab order 的關聯資料，避免 N+1"""
    order_ids = [o.id for o in orders]
    user_ids: set[int] = set()
    for o in orders:
        user_ids.add(o.ordered_by)
        if o.resulted_by:
            user_ids.add(o.resulted_by)

    # test_type names
    tt_ids = list({o.test_type_id for o in orders})
    tt_map: dict[int, str] = {}
    if tt_ids:
        for tt in db.execute(select(LabTestType).where(LabTestType.id.in_(tt_ids))).scalars():
            tt_map[tt.id] = tt.name

    # users
    users_map: dict[int, User] = {}
    if user_ids:
        for u in db.execute(select(User).where(User.id.in_(list(user_ids)))).scalars():
            users_map[u.id] = u

    # result items (is_superseded=False)
    items_by_order: dict[int, list[LabResultItem]] = {oid: [] for oid in order_ids}
    analyte_ids: set[int] = set()
    if order_ids:
        for ri in db.execute(
            select(LabResultItem).where(
                LabResultItem.lab_order_id.in_(order_ids),
                LabResultItem.is_superseded.is_(False),
            ).order_by(LabResultItem.analyte_id)
        ).scalars():
            items_by_order[ri.lab_order_id].append(ri)
            analyte_ids.add(ri.analyte_id)
            user_ids.add(ri.created_by)

    # analytes
    analytes_map: dict[int, LabAnalyte] = {}
    if analyte_ids:
        for a in db.execute(select(LabAnalyte).where(LabAnalyte.id.in_(list(analyte_ids)))).scalars():
            analytes_map[a.id] = a

    # 補 result_item 建立人（可能不在 user_ids 第一輪中）
    for ri_user_id in user_ids:
        if ri_user_id not in users_map:
            u = db.get(User, ri_user_id)
            if u:
                users_map[u.id] = u

    return tt_map, users_map, analytes_map, items_by_order


@router.get("/lab-orders", response_model=list[LabOrderRead])
def list_lab_orders(
    visit_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    """取得就診的所有檢驗醫囑（含結果明細）"""
    clinic_id = _get_clinic_id(token_data)
    _get_visit(visit_id, clinic_id, db)

    orders = db.execute(
        select(LabOrder).where(
            LabOrder.visit_id == visit_id,
            LabOrder.is_superseded.is_(False),
        ).order_by(LabOrder.created_at.desc())
    ).scalars().all()

    if not orders:
        return []

    tt_map, users_map, analytes_map, items_by_order = _load_order_context(list(orders), db)
    return [
        _build_order_read(o, tt_map.get(o.test_type_id, "—"), users_map, analytes_map, items_by_order[o.id])
        for o in orders
    ]


@router.post("/lab-orders", response_model=LabOrderRead, status_code=201)
def create_lab_order(
    visit_id: int,
    body: LabOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("vet")),
    token_data: dict = Depends(get_token_data),
):
    """開立檢驗醫囑（status=pending）"""
    clinic_id = _get_clinic_id(token_data)
    visit = _get_visit(visit_id, clinic_id, db)

    order = LabOrder(
        visit_id=visit_id,
        clinic_id=clinic_id,
        organization_id=visit.organization_id,
        test_type_id=body.test_type_id,
        ordered_by=current_user.id,
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    tt = db.get(LabTestType, order.test_type_id)
    return _build_order_read(
        order,
        tt.name if tt else "—",
        {current_user.id: current_user},
        {},
        [],
    )


@router.post("/lab-orders/{order_id}/results", response_model=LabOrderRead)
def submit_lab_results(
    visit_id: int,
    order_id: int,
    body: LabResultSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("vet", "nurse", "technician")),
    token_data: dict = Depends(get_token_data),
):
    """提交檢驗結果（批次寫入指標值，status → resulted）"""
    from datetime import timezone
    from datetime import datetime as dt

    clinic_id = _get_clinic_id(token_data)
    _get_visit(visit_id, clinic_id, db)

    order = db.execute(
        select(LabOrder).where(
            LabOrder.id == order_id,
            LabOrder.visit_id == visit_id,
            LabOrder.is_superseded.is_(False),
        )
    ).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="檢驗醫囑不存在")
    if order.status == "cancelled":
        raise HTTPException(status_code=400, detail="已取消的醫囑無法填入結果")

    # 舊的同 analyte → is_superseded=True
    analyte_ids = [item.analyte_id for item in body.items]
    if analyte_ids:
        for old_ri in db.execute(
            select(LabResultItem).where(
                LabResultItem.lab_order_id == order_id,
                LabResultItem.analyte_id.in_(analyte_ids),
                LabResultItem.is_superseded.is_(False),
            )
        ).scalars():
            old_ri.is_superseded = True

    # 批次 INSERT 新值
    new_items: list[LabResultItem] = []
    for item in body.items:
        ri = LabResultItem(
            lab_order_id=order_id,
            analyte_id=item.analyte_id,
            value_numeric=item.value_numeric,
            value_text=item.value_text,
            is_abnormal=item.is_abnormal,
            notes=item.notes,
            created_by=current_user.id,
        )
        db.add(ri)
        new_items.append(ri)

    # 更新 order status
    order.status = "resulted"
    order.resulted_at = dt.now(timezone.utc)
    order.resulted_by = current_user.id

    db.commit()
    for ri in new_items:
        db.refresh(ri)
    db.refresh(order)

    tt = db.get(LabTestType, order.test_type_id)
    # 重新載入完整 result_items（含舊的 superseded）
    all_items = db.execute(
        select(LabResultItem).where(
            LabResultItem.lab_order_id == order_id,
            LabResultItem.is_superseded.is_(False),
        )
    ).scalars().all()

    analyte_ids_all = list({ri.analyte_id for ri in all_items})
    analytes_map: dict[int, LabAnalyte] = {}
    if analyte_ids_all:
        for a in db.execute(select(LabAnalyte).where(LabAnalyte.id.in_(analyte_ids_all))).scalars():
            analytes_map[a.id] = a

    user_ids_set = {ri.created_by for ri in all_items} | {order.ordered_by}
    if order.resulted_by:
        user_ids_set.add(order.resulted_by)
    users_map: dict[int, User] = {}
    for uid in user_ids_set:
        u = db.get(User, uid)
        if u:
            users_map[u.id] = u

    return _build_order_read(
        order,
        tt.name if tt else "—",
        users_map,
        analytes_map,
        list(all_items),
    )


@router.patch("/lab-orders/{order_id}", response_model=LabOrderRead)
def cancel_lab_order(
    visit_id: int,
    order_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    token_data: dict = Depends(get_token_data),
):
    """取消檢驗醫囑（append-only：is_superseded=True）"""
    clinic_id = _get_clinic_id(token_data)
    _get_visit(visit_id, clinic_id, db)

    order = db.execute(
        select(LabOrder).where(
            LabOrder.id == order_id,
            LabOrder.visit_id == visit_id,
            LabOrder.is_superseded.is_(False),
        )
    ).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="檢驗醫囑不存在")

    order.is_superseded = True
    db.commit()
    db.refresh(order)

    tt = db.get(LabTestType, order.test_type_id)
    users_map: dict[int, User] = {}
    for uid in {order.ordered_by, order.created_by}:
        u = db.get(User, uid)
        if u:
            users_map[u.id] = u

    return _build_order_read(order, tt.name if tt else "—", users_map, {}, [])
