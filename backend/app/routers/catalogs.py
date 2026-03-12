from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.catalogs import (
    AdministrationRoute, BloodType, Breed, ContactType,
    DiagnosisCategory, DiagnosisCode,
    LabAnalyte, LabCategory, LabTestType,
    Medication, MedicationCategory,
    MucousMembraneColor,
    ProcedureCategory, ProcedureType, Species,
)
from app.models.foundation import User
from app.schemas.catalogs import (
    AdministrationRouteCreate, AdministrationRouteRead, AdministrationRouteUpdate,
    BloodTypeCreate, BloodTypeRead, BloodTypeUpdate,
    BreedCreate, BreedRead, BreedUpdate,
    ContactTypeCreate, ContactTypeRead, ContactTypeUpdate,
    DiagnosisCategoryCreate, DiagnosisCategoryRead, DiagnosisCategoryUpdate,
    DiagnosisCodeCreate, DiagnosisCodeRead, DiagnosisCodeUpdate,
    LabAnalyteCreate, LabAnalyteRead, LabAnalyteUpdate,
    LabCategoryCreate, LabCategoryRead, LabCategoryUpdate,
    LabTestTypeCreate, LabTestTypeRead, LabTestTypeUpdate,
    MedicationCategoryCreate, MedicationCategoryRead, MedicationCategoryUpdate,
    MedicationCreate, MedicationRead, MedicationUpdate,
    MucousMembraneColorCreate, MucousMembraneColorRead, MucousMembraneColorUpdate,
    ProcedureCategoryCreate, ProcedureCategoryRead, ProcedureCategoryUpdate,
    ProcedureTypeCreate, ProcedureTypeRead, ProcedureTypeUpdate,
    SpeciesCreate, SpeciesRead, SpeciesUpdate,
)

router = APIRouter(prefix="/catalogs", tags=["目錄資料"])


def _conflict(_e: IntegrityError) -> HTTPException:
    return HTTPException(status_code=409, detail="名稱或代碼已存在")


# ══════════════════════════════════════════════════════════════════
# Blood Types
# ══════════════════════════════════════════════════════════════════

@router.get("/blood-types", response_model=list[BloodTypeRead])
def list_blood_types(
    species_id: Optional[int] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(BloodType)
    if not include_inactive:
        q = q.where(BloodType.is_active.is_(True))
    if species_id is not None:
        q = q.where(BloodType.species_id == species_id)
    return db.execute(q.order_by(BloodType.species_id, BloodType.code)).scalars().all()


@router.post("/blood-types", response_model=BloodTypeRead, status_code=201)
def create_blood_type(
    data: BloodTypeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    obj = BloodType(**data.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.put("/blood-types/{bt_id}", response_model=BloodTypeRead)
def update_blood_type(
    bt_id: int,
    data: BloodTypeUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    obj = db.get(BloodType, bt_id)
    if not obj:
        raise HTTPException(404, "找不到此血型")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.patch("/blood-types/{bt_id}/active", response_model=BloodTypeRead)
def toggle_blood_type_active(
    bt_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    obj = db.get(BloodType, bt_id)
    if not obj:
        raise HTTPException(404, "找不到此血型")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return obj


# ══════════════════════════════════════════════════════════════════
# Species
# ══════════════════════════════════════════════════════════════════

@router.get("/species", response_model=list[SpeciesRead])
def list_species(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Species).where(Species.organization_id == current_user.organization_id)
    if not include_inactive:
        q = q.where(Species.is_active.is_(True))
    species_list = db.execute(
        q.order_by(case((Species.name == "其他", 1), else_=0), Species.name)
    ).scalars().all()

    result = []
    for sp in species_list:
        breeds_q = select(Breed).where(Breed.species_id == sp.id)
        if not include_inactive:
            breeds_q = breeds_q.where(Breed.is_active.is_(True))
        breeds = db.execute(breeds_q.order_by(Breed.name)).scalars().all()
        item = SpeciesRead.model_validate(sp)
        item.breeds = [BreedRead.model_validate(b) for b in breeds]
        result.append(item)
    return result


@router.post("/species", response_model=SpeciesRead, status_code=201)
def create_species(
    data: SpeciesCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = Species(organization_id=current_user.organization_id, **data.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return SpeciesRead(id=obj.id, name=obj.name, is_active=obj.is_active, breeds=[])


@router.put("/species/{sp_id}", response_model=SpeciesRead)
def update_species(
    sp_id: int,
    data: SpeciesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(Species, sp_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此物種")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return SpeciesRead(id=obj.id, name=obj.name, is_active=obj.is_active, breeds=[])


@router.patch("/species/{sp_id}/active", response_model=SpeciesRead)
def toggle_species_active(
    sp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(Species, sp_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此物種")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return SpeciesRead(id=obj.id, name=obj.name, is_active=obj.is_active, breeds=[])


# ══════════════════════════════════════════════════════════════════
# Breeds
# ══════════════════════════════════════════════════════════════════

@router.post("/breeds", response_model=BreedRead, status_code=201)
def create_breed(
    data: BreedCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    obj = Breed(**data.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.put("/breeds/{breed_id}", response_model=BreedRead)
def update_breed(
    breed_id: int,
    data: BreedUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    obj = db.get(Breed, breed_id)
    if not obj:
        raise HTTPException(404, "找不到此品種")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.patch("/breeds/{breed_id}/active", response_model=BreedRead)
def toggle_breed_active(
    breed_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    obj = db.get(Breed, breed_id)
    if not obj:
        raise HTTPException(404, "找不到此品種")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return obj


# ══════════════════════════════════════════════════════════════════
# Mucous Membrane Colors
# ══════════════════════════════════════════════════════════════════

@router.get("/mucous-membrane-colors", response_model=list[MucousMembraneColorRead])
def list_mucous_membrane_colors(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(MucousMembraneColor).where(
        MucousMembraneColor.organization_id == current_user.organization_id
    )
    if not include_inactive:
        q = q.where(MucousMembraneColor.is_active.is_(True))
    return db.execute(q.order_by(MucousMembraneColor.name)).scalars().all()


@router.post("/mucous-membrane-colors", response_model=MucousMembraneColorRead, status_code=201)
def create_mucous_membrane_color(
    data: MucousMembraneColorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = MucousMembraneColor(organization_id=current_user.organization_id, **data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/mucous-membrane-colors/{mc_id}", response_model=MucousMembraneColorRead)
def update_mucous_membrane_color(
    mc_id: int,
    data: MucousMembraneColorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(MucousMembraneColor, mc_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此項目")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/mucous-membrane-colors/{mc_id}/active", response_model=MucousMembraneColorRead)
def toggle_mucous_membrane_color_active(
    mc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(MucousMembraneColor, mc_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此項目")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return obj


# ══════════════════════════════════════════════════════════════════
# Contact Types
# ══════════════════════════════════════════════════════════════════

@router.get("/contact-types", response_model=list[ContactTypeRead])
def list_contact_types(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(ContactType).where(ContactType.organization_id == current_user.organization_id)
    if not include_inactive:
        q = q.where(ContactType.is_active.is_(True))
    return db.execute(q.order_by(ContactType.display_name)).scalars().all()


@router.post("/contact-types", response_model=ContactTypeRead, status_code=201)
def create_contact_type(
    data: ContactTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = ContactType(organization_id=current_user.organization_id, **data.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.put("/contact-types/{ct_id}", response_model=ContactTypeRead)
def update_contact_type(
    ct_id: int,
    data: ContactTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(ContactType, ct_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此項目")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.patch("/contact-types/{ct_id}/active", response_model=ContactTypeRead)
def toggle_contact_type_active(
    ct_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(ContactType, ct_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此項目")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return obj


# ══════════════════════════════════════════════════════════════════
# Administration Routes
# ══════════════════════════════════════════════════════════════════

@router.get("/administration-routes", response_model=list[AdministrationRouteRead])
def list_administration_routes(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AdministrationRoute).where(
        AdministrationRoute.organization_id == current_user.organization_id
    )
    if not include_inactive:
        q = q.where(AdministrationRoute.is_active.is_(True))
    return db.execute(q.order_by(AdministrationRoute.name)).scalars().all()


@router.post("/administration-routes", response_model=AdministrationRouteRead, status_code=201)
def create_administration_route(
    data: AdministrationRouteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = AdministrationRoute(organization_id=current_user.organization_id, **data.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.put("/administration-routes/{ar_id}", response_model=AdministrationRouteRead)
def update_administration_route(
    ar_id: int,
    data: AdministrationRouteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(AdministrationRoute, ar_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此項目")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.patch("/administration-routes/{ar_id}/active", response_model=AdministrationRouteRead)
def toggle_administration_route_active(
    ar_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(AdministrationRoute, ar_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此項目")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return obj


# ══════════════════════════════════════════════════════════════════
# Medication Categories + Medications
# ══════════════════════════════════════════════════════════════════

@router.get("/medication-categories", response_model=list[MedicationCategoryRead])
def list_medication_categories(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(MedicationCategory).where(
        MedicationCategory.organization_id == current_user.organization_id
    )
    if not include_inactive:
        q = q.where(MedicationCategory.is_active.is_(True))
    categories = db.execute(
        q.order_by(case((MedicationCategory.name == "其他", 1), else_=0), MedicationCategory.name)
    ).scalars().all()

    result = []
    for cat in categories:
        meds_q = select(Medication).where(
            Medication.organization_id == current_user.organization_id,
            Medication.medication_category_id == cat.id,
        )
        if not include_inactive:
            meds_q = meds_q.where(Medication.is_active.is_(True))
        meds = db.execute(meds_q.order_by(Medication.name)).scalars().all()
        item = MedicationCategoryRead.model_validate(cat)
        item.medications = [MedicationRead.model_validate(m) for m in meds]
        result.append(item)
    return result


@router.post("/medication-categories", response_model=MedicationCategoryRead, status_code=201)
def create_medication_category(
    data: MedicationCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = MedicationCategory(organization_id=current_user.organization_id, **data.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return MedicationCategoryRead(id=obj.id, name=obj.name, is_active=obj.is_active, medications=[])


@router.put("/medication-categories/{mc_id}", response_model=MedicationCategoryRead)
def update_medication_category(
    mc_id: int,
    data: MedicationCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(MedicationCategory, mc_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此分類")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return MedicationCategoryRead(id=obj.id, name=obj.name, is_active=obj.is_active, medications=[])


@router.patch("/medication-categories/{mc_id}/active", response_model=MedicationCategoryRead)
def toggle_medication_category_active(
    mc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(MedicationCategory, mc_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此分類")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return MedicationCategoryRead(id=obj.id, name=obj.name, is_active=obj.is_active, medications=[])


@router.get("/medications", response_model=list[MedicationRead])
def list_medications(
    category_id: Optional[int] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Medication).where(Medication.organization_id == current_user.organization_id)
    if not include_inactive:
        q = q.where(Medication.is_active.is_(True))
    if category_id is not None:
        q = q.where(Medication.medication_category_id == category_id)
    return db.execute(q.order_by(Medication.name)).scalars().all()


@router.post("/medications", response_model=MedicationRead, status_code=201)
def create_medication(
    data: MedicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = Medication(organization_id=current_user.organization_id, **data.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.put("/medications/{med_id}", response_model=MedicationRead)
def update_medication(
    med_id: int,
    data: MedicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(Medication, med_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此藥品")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.patch("/medications/{med_id}/active", response_model=MedicationRead)
def toggle_medication_active(
    med_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(Medication, med_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此藥品")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return obj


# ══════════════════════════════════════════════════════════════════
# Procedure Categories + Procedure Types
# ══════════════════════════════════════════════════════════════════

@router.get("/procedure-categories", response_model=list[ProcedureCategoryRead])
def list_procedure_categories(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(ProcedureCategory).where(
        ProcedureCategory.organization_id == current_user.organization_id
    )
    if not include_inactive:
        q = q.where(ProcedureCategory.is_active.is_(True))
    categories = db.execute(
        q.order_by(case((ProcedureCategory.name == "其他", 1), else_=0), ProcedureCategory.name)
    ).scalars().all()

    result = []
    for cat in categories:
        types_q = select(ProcedureType).where(
            ProcedureType.organization_id == current_user.organization_id,
            ProcedureType.procedure_category_id == cat.id,
        )
        if not include_inactive:
            types_q = types_q.where(ProcedureType.is_active.is_(True))
        types = db.execute(types_q.order_by(ProcedureType.name)).scalars().all()
        item = ProcedureCategoryRead.model_validate(cat)
        item.procedure_types = [ProcedureTypeRead.model_validate(t) for t in types]
        result.append(item)
    return result


@router.post("/procedure-categories", response_model=ProcedureCategoryRead, status_code=201)
def create_procedure_category(
    data: ProcedureCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = ProcedureCategory(organization_id=current_user.organization_id, **data.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return ProcedureCategoryRead(id=obj.id, name=obj.name, is_active=obj.is_active, procedure_types=[])


@router.put("/procedure-categories/{pc_id}", response_model=ProcedureCategoryRead)
def update_procedure_category(
    pc_id: int,
    data: ProcedureCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(ProcedureCategory, pc_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此分類")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return ProcedureCategoryRead(id=obj.id, name=obj.name, is_active=obj.is_active, procedure_types=[])


@router.patch("/procedure-categories/{pc_id}/active", response_model=ProcedureCategoryRead)
def toggle_procedure_category_active(
    pc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(ProcedureCategory, pc_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此分類")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return ProcedureCategoryRead(id=obj.id, name=obj.name, is_active=obj.is_active, procedure_types=[])


@router.get("/procedure-types", response_model=list[ProcedureTypeRead])
def list_procedure_types(
    category_id: Optional[int] = Query(None),
    species_id: Optional[int] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import or_
    q = select(ProcedureType).where(ProcedureType.organization_id == current_user.organization_id)
    if not include_inactive:
        q = q.where(ProcedureType.is_active.is_(True))
    if category_id is not None:
        q = q.where(ProcedureType.procedure_category_id == category_id)
    if species_id is not None:
        q = q.where(
            or_(ProcedureType.species_id == species_id, ProcedureType.species_id.is_(None))
        )
    return db.execute(q.order_by(ProcedureType.name)).scalars().all()


@router.post("/procedure-types", response_model=ProcedureTypeRead, status_code=201)
def create_procedure_type(
    data: ProcedureTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = ProcedureType(organization_id=current_user.organization_id, **data.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.put("/procedure-types/{pt_id}", response_model=ProcedureTypeRead)
def update_procedure_type(
    pt_id: int,
    data: ProcedureTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(ProcedureType, pt_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此處置項目")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.patch("/procedure-types/{pt_id}/active", response_model=ProcedureTypeRead)
def toggle_procedure_type_active(
    pt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(ProcedureType, pt_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此處置項目")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return obj


# ══════════════════════════════════════════════════════════════════
# Diagnosis Categories + Diagnosis Codes
# ══════════════════════════════════════════════════════════════════

@router.get("/diagnosis-categories", response_model=list[DiagnosisCategoryRead])
def list_diagnosis_categories(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(DiagnosisCategory).where(
        DiagnosisCategory.organization_id == current_user.organization_id
    )
    if not include_inactive:
        q = q.where(DiagnosisCategory.is_active.is_(True))
    return db.execute(q.order_by(DiagnosisCategory.name)).scalars().all()


@router.post("/diagnosis-categories", response_model=DiagnosisCategoryRead, status_code=201)
def create_diagnosis_category(
    data: DiagnosisCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = DiagnosisCategory(organization_id=current_user.organization_id, **data.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.put("/diagnosis-categories/{dc_id}", response_model=DiagnosisCategoryRead)
def update_diagnosis_category(
    dc_id: int,
    data: DiagnosisCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(DiagnosisCategory, dc_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此分類")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.patch("/diagnosis-categories/{dc_id}/active", response_model=DiagnosisCategoryRead)
def toggle_diagnosis_category_active(
    dc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(DiagnosisCategory, dc_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此分類")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/diagnosis-codes", response_model=list[DiagnosisCodeRead])
def list_diagnosis_codes(
    category_id: Optional[int] = Query(None),
    species_id: Optional[int] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(DiagnosisCode).where(DiagnosisCode.organization_id == current_user.organization_id)
    if not include_inactive:
        q = q.where(DiagnosisCode.is_active.is_(True))
    if category_id is not None:
        q = q.where(DiagnosisCode.category_id == category_id)
    if species_id is not None:
        from sqlalchemy import or_
        q = q.where(
            or_(DiagnosisCode.species_id == species_id, DiagnosisCode.species_id.is_(None))
        )
    return db.execute(q.order_by(DiagnosisCode.name)).scalars().all()


@router.post("/diagnosis-codes", response_model=DiagnosisCodeRead, status_code=201)
def create_diagnosis_code(
    data: DiagnosisCodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = DiagnosisCode(organization_id=current_user.organization_id, **data.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.put("/diagnosis-codes/{code_id}", response_model=DiagnosisCodeRead)
def update_diagnosis_code(
    code_id: int,
    data: DiagnosisCodeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(DiagnosisCode, code_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此診斷碼")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.patch("/diagnosis-codes/{code_id}/active", response_model=DiagnosisCodeRead)
def toggle_diagnosis_code_active(
    code_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(DiagnosisCode, code_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此診斷碼")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return obj


# ══════════════════════════════════════════════════════════════════
# Lab Categories + Lab Test Types + Lab Analytes
# ══════════════════════════════════════════════════════════════════

@router.get("/lab-categories", response_model=list[LabCategoryRead])
def list_lab_categories(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(LabCategory).where(LabCategory.organization_id == current_user.organization_id)
    if not include_inactive:
        q = q.where(LabCategory.is_active.is_(True))
    categories = db.execute(q.order_by(LabCategory.name)).scalars().all()

    result = []
    for cat in categories:
        tt_q = select(LabTestType).where(LabTestType.lab_category_id == cat.id)
        if not include_inactive:
            tt_q = tt_q.where(LabTestType.is_active.is_(True))
        test_types = db.execute(tt_q.order_by(LabTestType.name)).scalars().all()

        tt_list = []
        for tt in test_types:
            an_q = select(LabAnalyte).where(LabAnalyte.lab_test_type_id == tt.id)
            if not include_inactive:
                an_q = an_q.where(LabAnalyte.is_active.is_(True))
            analytes = db.execute(an_q.order_by(LabAnalyte.sort_order, LabAnalyte.name)).scalars().all()
            tt_list.append(LabTestTypeRead(
                id=tt.id,
                lab_category_id=tt.lab_category_id,
                name=tt.name,
                is_active=tt.is_active,
                analytes=[LabAnalyteRead.model_validate(a) for a in analytes],
            ))
        result.append(LabCategoryRead(id=cat.id, name=cat.name, is_active=cat.is_active, test_types=tt_list))
    return result


@router.post("/lab-categories", response_model=LabCategoryRead, status_code=201)
def create_lab_category(
    data: LabCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = LabCategory(organization_id=current_user.organization_id, **data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return LabCategoryRead(id=obj.id, name=obj.name, is_active=obj.is_active, test_types=[])


@router.put("/lab-categories/{lc_id}", response_model=LabCategoryRead)
def update_lab_category(
    lc_id: int,
    data: LabCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(LabCategory, lc_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此分類")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return LabCategoryRead(id=obj.id, name=obj.name, is_active=obj.is_active, test_types=[])


@router.patch("/lab-categories/{lc_id}/active", response_model=LabCategoryRead)
def toggle_lab_category_active(
    lc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(LabCategory, lc_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此分類")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return LabCategoryRead(id=obj.id, name=obj.name, is_active=obj.is_active, test_types=[])


@router.get("/lab-test-types", response_model=list[LabTestTypeRead])
def list_lab_test_types(
    category_id: Optional[int] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(LabTestType).where(LabTestType.organization_id == current_user.organization_id)
    if not include_inactive:
        q = q.where(LabTestType.is_active.is_(True))
    if category_id is not None:
        q = q.where(LabTestType.lab_category_id == category_id)
    test_types = db.execute(q.order_by(LabTestType.name)).scalars().all()

    result = []
    for tt in test_types:
        an_q = select(LabAnalyte).where(LabAnalyte.lab_test_type_id == tt.id)
        if not include_inactive:
            an_q = an_q.where(LabAnalyte.is_active.is_(True))
        analytes = db.execute(an_q.order_by(LabAnalyte.sort_order, LabAnalyte.name)).scalars().all()
        result.append(LabTestTypeRead(
            id=tt.id,
            lab_category_id=tt.lab_category_id,
            name=tt.name,
            is_active=tt.is_active,
            analytes=[LabAnalyteRead.model_validate(a) for a in analytes],
        ))
    return result


@router.post("/lab-test-types", response_model=LabTestTypeRead, status_code=201)
def create_lab_test_type(
    data: LabTestTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = LabTestType(organization_id=current_user.organization_id, **data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return LabTestTypeRead(id=obj.id, lab_category_id=obj.lab_category_id, name=obj.name, is_active=obj.is_active, analytes=[])


@router.put("/lab-test-types/{ltt_id}", response_model=LabTestTypeRead)
def update_lab_test_type(
    ltt_id: int,
    data: LabTestTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(LabTestType, ltt_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此檢驗類型")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return LabTestTypeRead(id=obj.id, lab_category_id=obj.lab_category_id, name=obj.name, is_active=obj.is_active, analytes=[])


@router.patch("/lab-test-types/{ltt_id}/active", response_model=LabTestTypeRead)
def toggle_lab_test_type_active(
    ltt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(LabTestType, ltt_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此檢驗類型")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return LabTestTypeRead(id=obj.id, lab_category_id=obj.lab_category_id, name=obj.name, is_active=obj.is_active, analytes=[])


@router.get("/lab-analytes", response_model=list[LabAnalyteRead])
def list_lab_analytes(
    test_type_id: Optional[int] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(LabAnalyte).where(LabAnalyte.organization_id == current_user.organization_id)
    if not include_inactive:
        q = q.where(LabAnalyte.is_active.is_(True))
    if test_type_id is not None:
        q = q.where(LabAnalyte.lab_test_type_id == test_type_id)
    return db.execute(q.order_by(LabAnalyte.sort_order, LabAnalyte.name)).scalars().all()


@router.post("/lab-analytes", response_model=LabAnalyteRead, status_code=201)
def create_lab_analyte(
    data: LabAnalyteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = LabAnalyte(organization_id=current_user.organization_id, **data.model_dump())
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.put("/lab-analytes/{la_id}", response_model=LabAnalyteRead)
def update_lab_analyte(
    la_id: int,
    data: LabAnalyteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(LabAnalyte, la_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此分析指標")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _conflict(e)
    db.refresh(obj)
    return obj


@router.patch("/lab-analytes/{la_id}/active", response_model=LabAnalyteRead)
def toggle_lab_analyte_active(
    la_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = db.get(LabAnalyte, la_id)
    if not obj or obj.organization_id != current_user.organization_id:
        raise HTTPException(404, "找不到此分析指標")
    obj.is_active = not obj.is_active
    db.commit()
    db.refresh(obj)
    return obj
