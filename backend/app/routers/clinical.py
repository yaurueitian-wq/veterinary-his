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
from app.dependencies import get_current_user, get_token_data
from app.models.catalogs import MucousMembraneColor
from app.models.clinical import NursingNote, SoapDiagnosis, SoapNote, VitalSign
from app.models.foundation import User
from app.models.visits import Visit
from app.schemas.clinical import (
    ClinicalSummary,
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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

    return ClinicalSummary(
        latest_weight_kg=vs.weight_kg if vs else None,
        latest_temperature_c=float(vs.temperature_c) if vs and vs.temperature_c is not None else None,
        latest_heart_rate_bpm=vs.heart_rate_bpm if vs else None,
        latest_diagnosis=diag_text,
    )
