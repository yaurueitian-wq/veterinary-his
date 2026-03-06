"""
飼主 & 動物管理 API
  GET    /owners/suggest               — Combobox 即時建議
  GET    /owners                       — 搜尋 / 列表（多欄位 AND 過濾）
  POST   /owners                       — 新增飼主（含聯絡方式）
  GET    /owners/{id}                  — 飼主詳細
  PATCH  /owners/{id}                  — 更新飼主
  POST   /owners/{id}/animals          — 為飼主新增動物
  GET    /animals/{id}                 — 動物詳細
  PATCH  /animals/{id}                 — 更新動物
  GET    /animals/{id}/diseases        — 動物疾病史
  POST   /animals/{id}/diseases        — 新增疾病紀錄
  DELETE /animals/{id}/diseases/{did}  — 軟刪除疾病紀錄
  GET    /animals/{id}/medications     — 動物長期用藥
  POST   /animals/{id}/medications     — 新增長期用藥
  DELETE /animals/{id}/medications/{mid} — 軟刪除長期用藥
"""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.catalogs import BloodType, Breed, ContactType, Species
from app.models.foundation import User
from app.models.owners import Animal, AnimalDisease, AnimalMedication, Owner, OwnerContact
from app.schemas.owners import (
    AnimalBrief,
    AnimalCreate,
    AnimalDiseaseCreate,
    AnimalDiseaseRead,
    AnimalMedicationCreate,
    AnimalMedicationRead,
    AnimalRead,
    AnimalUpdate,
    ContactRead,
    OwnerCreate,
    OwnerDetail,
    OwnerListItem,
    OwnerListResponse,
    OwnerUpdate,
)

router = APIRouter(tags=["飼主 & 動物"])
animals_router = APIRouter(tags=["飼主 & 動物"])


# ── 工具函式 ──────────────────────────────────────────────


def _get_owner_or_404(owner_id: int, org_id: int, db: Session) -> Owner:
    owner = db.execute(
        select(Owner).where(
            Owner.id == owner_id,
            Owner.organization_id == org_id,
            Owner.is_active.is_(True),
        )
    ).scalar_one_or_none()
    if not owner:
        raise HTTPException(status_code=404, detail="飼主不存在")
    return owner


def _build_contact_read(contact: OwnerContact, contact_type: ContactType) -> ContactRead:
    return ContactRead(
        id=contact.id,
        contact_type_id=contact.contact_type_id,
        type_key=contact_type.type_key,
        display_name=contact_type.display_name,
        value=contact.value,
        label=contact.label,
        is_primary=contact.is_primary,
    )


def _build_owner_detail(owner: Owner, db: Session) -> OwnerDetail:
    """組裝 OwnerDetail（含聯絡方式 + 動物清單）"""
    # 聯絡方式
    contact_rows = db.execute(
        select(OwnerContact, ContactType)
        .join(ContactType, OwnerContact.contact_type_id == ContactType.id)
        .where(
            OwnerContact.owner_id == owner.id,
            OwnerContact.is_active.is_(True),
        )
        .order_by(OwnerContact.is_primary.desc(), OwnerContact.id)
    ).all()
    contacts = [_build_contact_read(c, ct) for c, ct in contact_rows]

    # 動物清單
    animal_rows = db.execute(
        select(Animal, Species, Breed, BloodType)
        .join(Species, Animal.species_id == Species.id)
        .outerjoin(Breed, Animal.breed_id == Breed.id)
        .outerjoin(BloodType, Animal.blood_type_id == BloodType.id)
        .where(Animal.owner_id == owner.id)
        .order_by(Animal.id)
    ).all()
    animals = [
        AnimalBrief(
            id=a.id,
            name=a.name,
            species_name=sp.name,
            breed_name=br.name if br else None,
            sex=a.sex,
            date_of_birth=a.date_of_birth,
            birth_year=a.birth_year,
            microchip_number=a.microchip_number,
            blood_type_name=bt.display_name if bt else None,
        )
        for a, sp, br, bt in animal_rows
    ]

    return OwnerDetail(
        id=owner.id,
        full_name=owner.full_name,
        national_id=owner.national_id,
        notes=owner.notes,
        is_active=owner.is_active,
        created_at=owner.created_at,
        contacts=contacts,
        animals=animals,
    )


# ── Combobox 即時建議 ─────────────────────────────────────


@router.get("/owners/suggest", response_model=list[str])
def suggest_owners(
    field: Literal["name", "phone", "national_id", "animal", "species"] = Query(...),
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """回傳指定欄位的自動完成建議（最多 10 筆）"""
    org_id = current_user.organization_id
    q_like = f"%{q}%"

    if field == "name":
        rows = db.execute(
            select(distinct(Owner.full_name))
            .where(
                Owner.organization_id == org_id,
                Owner.is_active.is_(True),
                Owner.full_name.ilike(q_like),
            )
            .limit(10)
        ).scalars().all()

    elif field == "phone":
        rows = db.execute(
            select(distinct(OwnerContact.value))
            .join(Owner, OwnerContact.owner_id == Owner.id)
            .join(ContactType, OwnerContact.contact_type_id == ContactType.id)
            .where(
                Owner.organization_id == org_id,
                Owner.is_active.is_(True),
                OwnerContact.is_active.is_(True),
                ContactType.type_key == "phone",
                OwnerContact.value.ilike(q_like),
            )
            .limit(10)
        ).scalars().all()

    elif field == "national_id":
        rows = db.execute(
            select(distinct(Owner.national_id))
            .where(
                Owner.organization_id == org_id,
                Owner.is_active.is_(True),
                Owner.national_id.isnot(None),
                Owner.national_id.ilike(q_like),
            )
            .limit(10)
        ).scalars().all()

    elif field == "animal":
        rows = db.execute(
            select(distinct(Animal.name))
            .join(Owner, Animal.owner_id == Owner.id)
            .where(
                Owner.organization_id == org_id,
                Owner.is_active.is_(True),
                Animal.name.ilike(q_like),
            )
            .limit(10)
        ).scalars().all()

    else:  # species
        rows = db.execute(
            select(distinct(Species.name))
            .join(Animal, Animal.species_id == Species.id)
            .join(Owner, Animal.owner_id == Owner.id)
            .where(
                Owner.organization_id == org_id,
                Owner.is_active.is_(True),
                Species.name.ilike(q_like),
            )
            .limit(10)
        ).scalars().all()

    return [r for r in rows if r is not None]


# ── 飼主列表 ──────────────────────────────────────────────


@router.get("/owners", response_model=OwnerListResponse)
def list_owners(
    name: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    national_id: Optional[str] = Query(None),
    animal: Optional[str] = Query(None),
    species: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = current_user.organization_id

    # 基礎查詢
    base_q = (
        select(Owner)
        .where(Owner.organization_id == org_id, Owner.is_active.is_(True))
        .distinct()
    )

    if name:
        base_q = base_q.where(Owner.full_name.ilike(f"%{name}%"))
    if national_id:
        base_q = base_q.where(Owner.national_id.ilike(f"%{national_id}%"))
    if phone:
        base_q = base_q.join(
            OwnerContact,
            (OwnerContact.owner_id == Owner.id) & OwnerContact.is_active.is_(True),
        ).join(
            ContactType,
            (OwnerContact.contact_type_id == ContactType.id)
            & (ContactType.type_key == "phone"),
        ).where(OwnerContact.value.ilike(f"%{phone}%"))
    if animal:
        animal_subq = (
            select(Animal.owner_id)
            .where(Animal.name.ilike(f"%{animal}%"))
            .distinct()
            .subquery()
        )
        base_q = base_q.where(Owner.id.in_(animal_subq))
    if species:
        species_subq = (
            select(Animal.owner_id)
            .join(Species, Animal.species_id == Species.id)
            .where(Species.name.ilike(f"%{species}%"))
            .distinct()
            .subquery()
        )
        base_q = base_q.where(Owner.id.in_(species_subq))

    # 計算總筆數
    count_q = select(func.count()).select_from(base_q.subquery())
    total = db.execute(count_q).scalar_one()

    # 分頁
    owners = db.execute(
        base_q.order_by(Owner.full_name).offset((page - 1) * page_size).limit(page_size)
    ).scalars().all()

    # 批次取計算欄位
    owner_ids = [o.id for o in owners]
    if owner_ids:
        # animal_count + animal_names
        animal_agg = db.execute(
            select(
                Animal.owner_id,
                func.count(Animal.id).label("cnt"),
                func.string_agg(Animal.name, ", ").label("names"),
            )
            .where(Animal.owner_id.in_(owner_ids))
            .group_by(Animal.owner_id)
        ).all()
        animal_map = {row.owner_id: (row.cnt, row.names) for row in animal_agg}

        # primary phone
        phone_rows = db.execute(
            select(OwnerContact.owner_id, OwnerContact.value)
            .join(ContactType, OwnerContact.contact_type_id == ContactType.id)
            .where(
                OwnerContact.owner_id.in_(owner_ids),
                OwnerContact.is_active.is_(True),
                ContactType.type_key == "phone",
            )
            .order_by(OwnerContact.is_primary.desc(), OwnerContact.id)
        ).all()
        phone_map: dict[int, str] = {}
        for row in phone_rows:
            if row.owner_id not in phone_map:
                phone_map[row.owner_id] = row.value
    else:
        animal_map = {}
        phone_map = {}

    items = [
        OwnerListItem(
            id=o.id,
            full_name=o.full_name,
            national_id=o.national_id,
            primary_phone=phone_map.get(o.id),
            animal_count=animal_map.get(o.id, (0, ""))[0],
            animal_names=animal_map.get(o.id, (0, ""))[1] or "",
        )
        for o in owners
    ]

    return OwnerListResponse(items=items, total=total, page=page, page_size=page_size)


# ── 新增飼主 ──────────────────────────────────────────────


@router.post("/owners", response_model=OwnerDetail, status_code=status.HTTP_201_CREATED)
def create_owner(
    body: OwnerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owner = Owner(
        organization_id=current_user.organization_id,
        full_name=body.full_name,
        national_id=body.national_id or None,
        notes=body.notes or None,
        created_by=current_user.id,
    )
    db.add(owner)
    db.flush()

    for c in body.contacts:
        db.add(OwnerContact(
            owner_id=owner.id,
            contact_type_id=c.contact_type_id,
            value=c.value,
            label=c.label,
            is_primary=c.is_primary,
            created_by=current_user.id,
        ))

    db.commit()
    db.refresh(owner)
    return _build_owner_detail(owner, db)


# ── 飼主詳細 ──────────────────────────────────────────────


@router.get("/owners/{owner_id}", response_model=OwnerDetail)
def get_owner(
    owner_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owner = _get_owner_or_404(owner_id, current_user.organization_id, db)
    return _build_owner_detail(owner, db)


# ── 更新飼主 ──────────────────────────────────────────────


@router.patch("/owners/{owner_id}", response_model=OwnerDetail)
def update_owner(
    owner_id: int,
    body: OwnerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owner = _get_owner_or_404(owner_id, current_user.organization_id, db)

    if body.full_name is not None:
        owner.full_name = body.full_name
    if body.national_id is not None:
        owner.national_id = body.national_id or None
    if body.notes is not None:
        owner.notes = body.notes or None

    db.commit()
    db.refresh(owner)
    return _build_owner_detail(owner, db)


# ── 刪除飼主（軟刪除） ────────────────────────────────────


@router.delete("/owners/{owner_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_owner(
    owner_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owner = _get_owner_or_404(owner_id, current_user.organization_id, db)
    owner.is_active = False
    db.commit()


# ── 為飼主新增動物 ─────────────────────────────────────────


@router.post(
    "/owners/{owner_id}/animals",
    response_model=AnimalRead,
    status_code=status.HTTP_201_CREATED,
)
def create_animal(
    owner_id: int,
    body: AnimalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owner_or_404(owner_id, current_user.organization_id, db)

    animal = Animal(
        organization_id=current_user.organization_id,
        owner_id=owner_id,
        name=body.name,
        species_id=body.species_id,
        breed_id=body.breed_id,
        sex=body.sex,
        date_of_birth=body.date_of_birth,
        birth_year=body.birth_year,
        microchip_number=body.microchip_number or None,
        color=body.color or None,
        notes=body.notes or None,
        blood_type_id=body.blood_type_id,
        general_info=body.general_info or None,
        critical_info=body.critical_info or None,
        neutered_date=body.neutered_date,
        created_by=current_user.id,
    )
    db.add(animal)
    db.commit()
    db.refresh(animal)
    return _build_animal_read(animal, db)


# ── 動物詳細 ──────────────────────────────────────────────


@animals_router.get("/animals/{animal_id}", response_model=AnimalRead)
def get_animal(
    animal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    animal = _get_animal_or_404(animal_id, current_user.organization_id, db)
    return _build_animal_read(animal, db)


# ── 更新動物 ──────────────────────────────────────────────


@animals_router.patch("/animals/{animal_id}", response_model=AnimalRead)
def update_animal(
    animal_id: int,
    body: AnimalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    animal = _get_animal_or_404(animal_id, current_user.organization_id, db)

    for field, value in body.model_dump(exclude_unset=True).items():
        if field in ("microchip_number", "color", "notes") and value == "":
            value = None
        setattr(animal, field, value)

    db.commit()
    db.refresh(animal)
    return _build_animal_read(animal, db)


# ── 刪除動物 ──────────────────────────────────────────────


@animals_router.delete("/animals/{animal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_animal(
    animal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    animal = _get_animal_or_404(animal_id, current_user.organization_id, db)
    db.delete(animal)
    db.commit()


# ── 動物工具函式 ───────────────────────────────────────────


def _get_animal_or_404(animal_id: int, org_id: int, db: Session) -> Animal:
    animal = db.execute(
        select(Animal)
        .join(Owner, Animal.owner_id == Owner.id)
        .where(Animal.id == animal_id, Owner.organization_id == org_id)
    ).scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="動物不存在")
    return animal


def _build_animal_read(animal: Animal, db: Session) -> AnimalRead:
    species = db.get(Species, animal.species_id)
    breed = db.get(Breed, animal.breed_id) if animal.breed_id else None
    blood_type = db.get(BloodType, animal.blood_type_id) if animal.blood_type_id else None
    return AnimalRead(
        id=animal.id,
        owner_id=animal.owner_id,
        name=animal.name,
        species_id=animal.species_id,
        species_name=species.name if species else "",
        breed_id=animal.breed_id,
        breed_name=breed.name if breed else None,
        sex=animal.sex,
        date_of_birth=animal.date_of_birth,
        birth_year=animal.birth_year,
        microchip_number=animal.microchip_number,
        color=animal.color,
        is_deceased=animal.is_deceased,
        deceased_date=animal.deceased_date,
        notes=animal.notes,
        blood_type_id=animal.blood_type_id,
        blood_type_name=blood_type.display_name if blood_type else None,
        general_info=animal.general_info,
        critical_info=animal.critical_info,
        neutered_date=animal.neutered_date,
    )


# ── 動物疾病史 ─────────────────────────────────────────────


@animals_router.get(
    "/animals/{animal_id}/diseases",
    response_model=list[AnimalDiseaseRead],
)
def list_animal_diseases(
    animal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得動物疾病 / 過敏史（is_active=True）"""
    _get_animal_or_404(animal_id, current_user.organization_id, db)
    rows = db.execute(
        select(AnimalDisease)
        .where(
            AnimalDisease.animal_id == animal_id,
            AnimalDisease.is_active.is_(True),
        )
        .order_by(AnimalDisease.is_allergy.desc(), AnimalDisease.created_at.desc())
    ).scalars().all()
    return rows


@animals_router.post(
    "/animals/{animal_id}/diseases",
    response_model=AnimalDiseaseRead,
    status_code=status.HTTP_201_CREATED,
)
def create_animal_disease(
    animal_id: int,
    body: AnimalDiseaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """新增動物疾病 / 過敏紀錄"""
    _get_animal_or_404(animal_id, current_user.organization_id, db)
    if not body.diagnosis_code_id and not body.free_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="diagnosis_code_id 或 free_text 至少填一個",
        )
    disease = AnimalDisease(
        animal_id=animal_id,
        organization_id=current_user.organization_id,
        diagnosis_code_id=body.diagnosis_code_id,
        free_text=body.free_text or None,
        is_allergy=body.is_allergy,
        status=body.status,
        onset_date=body.onset_date,
        notes=body.notes or None,
        created_by=current_user.id,
    )
    db.add(disease)
    db.commit()
    db.refresh(disease)
    return disease


@animals_router.delete(
    "/animals/{animal_id}/diseases/{disease_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_animal_disease(
    animal_id: int,
    disease_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """軟刪除疾病紀錄（is_active=False）"""
    _get_animal_or_404(animal_id, current_user.organization_id, db)
    disease = db.execute(
        select(AnimalDisease).where(
            AnimalDisease.id == disease_id,
            AnimalDisease.animal_id == animal_id,
            AnimalDisease.is_active.is_(True),
        )
    ).scalar_one_or_none()
    if not disease:
        raise HTTPException(status_code=404, detail="疾病紀錄不存在")
    disease.is_active = False
    db.commit()


# ── 動物長期用藥 ───────────────────────────────────────────


@animals_router.get(
    "/animals/{animal_id}/medications",
    response_model=list[AnimalMedicationRead],
)
def list_animal_medications(
    animal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得動物長期維持用藥（is_active=True）"""
    _get_animal_or_404(animal_id, current_user.organization_id, db)
    rows = db.execute(
        select(AnimalMedication)
        .where(
            AnimalMedication.animal_id == animal_id,
            AnimalMedication.is_active.is_(True),
        )
        .order_by(AnimalMedication.created_at.desc())
    ).scalars().all()
    return rows


@animals_router.post(
    "/animals/{animal_id}/medications",
    response_model=AnimalMedicationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_animal_medication(
    animal_id: int,
    body: AnimalMedicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """新增動物長期維持用藥"""
    _get_animal_or_404(animal_id, current_user.organization_id, db)
    if not body.medication_id and not body.free_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="medication_id 或 free_text 至少填一個",
        )
    med = AnimalMedication(
        animal_id=animal_id,
        organization_id=current_user.organization_id,
        medication_id=body.medication_id,
        free_text=body.free_text or None,
        dose=body.dose,
        dose_unit=body.dose_unit or None,
        administration_route_id=body.administration_route_id,
        frequency=body.frequency or None,
        start_date=body.start_date,
        end_date=body.end_date,
        notes=body.notes or None,
        created_by=current_user.id,
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    return med


@animals_router.delete(
    "/animals/{animal_id}/medications/{medication_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_animal_medication(
    animal_id: int,
    medication_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """軟刪除長期用藥紀錄（is_active=False）"""
    _get_animal_or_404(animal_id, current_user.organization_id, db)
    med = db.execute(
        select(AnimalMedication).where(
            AnimalMedication.id == medication_id,
            AnimalMedication.animal_id == animal_id,
            AnimalMedication.is_active.is_(True),
        )
    ).scalar_one_or_none()
    if not med:
        raise HTTPException(status_code=404, detail="用藥紀錄不存在")
    med.is_active = False
    db.commit()
