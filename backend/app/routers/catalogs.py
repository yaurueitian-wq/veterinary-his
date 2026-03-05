from fastapi import APIRouter, Depends
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.catalogs import Breed, ContactType, Species
from app.models.foundation import User
from app.schemas.catalogs import ContactTypeRead, SpeciesRead

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

    # 為每個物種載入品種
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
