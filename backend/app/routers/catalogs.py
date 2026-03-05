from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.catalogs import (
    AdministrationRoute, Breed, ContactType, Medication, MedicationCategory,
    ProcedureCategory, ProcedureType, Species,
)
from app.models.foundation import User
from app.schemas.catalogs import (
    AdministrationRouteRead, ContactTypeRead, MedicationCategoryRead,
    MedicationRead, ProcedureCategoryRead, ProcedureTypeRead, SpeciesRead,
)

router = APIRouter(prefix="/catalogs", tags=["目錄資料"])


@router.get("/species", response_model=list[SpeciesRead])
def list_species(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得所有物種（含品種清單）"""
    species_list = db.execute(
        select(Species).where(
            Species.organization_id == current_user.organization_id,
            Species.is_active.is_(True),
        ).order_by(
            case((Species.name == "其他", 1), else_=0),
            Species.name,
        )
    ).scalars().all()

    result = []
    for sp in species_list:
        breeds = db.execute(
            select(Breed).where(
                Breed.species_id == sp.id,
                Breed.is_active.is_(True),
            ).order_by(Breed.name)
        ).scalars().all()
        item = SpeciesRead.model_validate(sp)
        item.breeds = [{"id": b.id, "name": b.name} for b in breeds]
        result.append(item)

    return result


@router.get("/contact-types", response_model=list[ContactTypeRead])
def list_contact_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得所有聯絡方式類型"""
    types = db.execute(
        select(ContactType).where(
            ContactType.organization_id == current_user.organization_id,
            ContactType.is_active.is_(True),
        ).order_by(ContactType.display_name)
    ).scalars().all()
    return types


@router.get("/administration-routes", response_model=list[AdministrationRouteRead])
def list_administration_routes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得所有給藥途徑"""
    routes = db.execute(
        select(AdministrationRoute).where(
            AdministrationRoute.organization_id == current_user.organization_id,
            AdministrationRoute.is_active.is_(True),
        ).order_by(AdministrationRoute.name)
    ).scalars().all()
    return routes


@router.get("/medication-categories", response_model=list[MedicationCategoryRead])
def list_medication_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得所有藥品分類（含藥品清單）"""
    categories = db.execute(
        select(MedicationCategory).where(
            MedicationCategory.organization_id == current_user.organization_id,
            MedicationCategory.is_active.is_(True),
        ).order_by(
            case((MedicationCategory.name == "其他", 1), else_=0),
            MedicationCategory.name,
        )
    ).scalars().all()

    result = []
    for cat in categories:
        meds = db.execute(
            select(Medication).where(
                Medication.organization_id == current_user.organization_id,
                Medication.medication_category_id == cat.id,
                Medication.is_active.is_(True),
            ).order_by(Medication.name)
        ).scalars().all()
        item = MedicationCategoryRead.model_validate(cat)
        item.medications = [MedicationRead.model_validate(m) for m in meds]
        result.append(item)

    return result


@router.get("/medications", response_model=list[MedicationRead])
def list_medications(
    category_id: Optional[int] = Query(None, description="依分類過濾"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得藥品清單（可依分類過濾）"""
    q = select(Medication).where(
        Medication.organization_id == current_user.organization_id,
        Medication.is_active.is_(True),
    )
    if category_id is not None:
        q = q.where(Medication.medication_category_id == category_id)
    meds = db.execute(q.order_by(Medication.name)).scalars().all()
    return meds


@router.get("/procedure-categories", response_model=list[ProcedureCategoryRead])
def list_procedure_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得所有處置/手術分類（含項目清單）"""
    categories = db.execute(
        select(ProcedureCategory).where(
            ProcedureCategory.organization_id == current_user.organization_id,
            ProcedureCategory.is_active.is_(True),
        ).order_by(
            case((ProcedureCategory.name == "其他", 1), else_=0),
            ProcedureCategory.name,
        )
    ).scalars().all()

    result = []
    for cat in categories:
        types = db.execute(
            select(ProcedureType).where(
                ProcedureType.organization_id == current_user.organization_id,
                ProcedureType.procedure_category_id == cat.id,
                ProcedureType.is_active.is_(True),
            ).order_by(ProcedureType.name)
        ).scalars().all()
        item = ProcedureCategoryRead.model_validate(cat)
        item.procedure_types = [ProcedureTypeRead.model_validate(t) for t in types]
        result.append(item)

    return result


@router.get("/procedure-types", response_model=list[ProcedureTypeRead])
def list_procedure_types(
    category_id: Optional[int] = Query(None, description="依分類過濾"),
    species_id: Optional[int] = Query(None, description="依物種過濾（含跨物種通用）"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得處置/手術項目清單（可依分類或物種過濾）"""
    q = select(ProcedureType).where(
        ProcedureType.organization_id == current_user.organization_id,
        ProcedureType.is_active.is_(True),
    )
    if category_id is not None:
        q = q.where(ProcedureType.procedure_category_id == category_id)
    if species_id is not None:
        # 回傳該物種專屬 + 跨物種通用（species_id IS NULL）
        from sqlalchemy import or_
        q = q.where(
            or_(ProcedureType.species_id == species_id, ProcedureType.species_id.is_(None))
        )
    types = db.execute(q.order_by(ProcedureType.name)).scalars().all()
    return types
