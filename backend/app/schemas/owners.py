from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


# ── 聯絡方式 ─────────────────────────────────────────────


class ContactCreate(BaseModel):
    contact_type_id: int
    value: str
    label: str = "personal"  # personal | work | other
    is_primary: bool = False


class ContactRead(BaseModel):
    id: int
    contact_type_id: int
    type_key: str       # 由 JOIN 帶入，不在 ORM 直接對應
    display_name: str   # 由 JOIN 帶入
    value: str
    label: str
    is_primary: bool

    model_config = {"from_attributes": True}


# ── 飼主 ──────────────────────────────────────────────────


class OwnerCreate(BaseModel):
    full_name: str
    national_id: Optional[str] = None
    notes: Optional[str] = None
    contacts: list[ContactCreate] = []


class OwnerUpdate(BaseModel):
    full_name: Optional[str] = None
    national_id: Optional[str] = None
    notes: Optional[str] = None


class OwnerListItem(BaseModel):
    """用於清單頁的精簡版（含計算欄位）"""
    id: int
    full_name: str
    national_id: Optional[str]
    primary_phone: Optional[str]   # 計算欄位
    animal_count: int              # 計算欄位
    animal_names: str              # 逗號分隔，計算欄位


class OwnerListResponse(BaseModel):
    items: list[OwnerListItem]
    total: int
    page: int
    page_size: int


# ── 動物（飼主詳細頁中的簡略版）────────────────────────────


class AnimalBrief(BaseModel):
    id: int
    name: str
    species_name: str
    breed_name: Optional[str]
    sex: str
    microchip_number: Optional[str]


class OwnerDetail(BaseModel):
    id: int
    full_name: str
    national_id: Optional[str]
    notes: Optional[str]
    is_active: bool
    created_at: datetime
    contacts: list[ContactRead]
    animals: list[AnimalBrief]

    model_config = {"from_attributes": True}


# ── 動物（完整）─────────────────────────────────────────────


class AnimalCreate(BaseModel):
    name: str
    species_id: int
    breed_id: Optional[int] = None
    sex: str  # intact_male | intact_female | neutered_male | neutered_female | unknown
    date_of_birth: Optional[date] = None
    birth_year: Optional[int] = None
    microchip_number: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None


class AnimalUpdate(BaseModel):
    name: Optional[str] = None
    breed_id: Optional[int] = None
    sex: Optional[str] = None
    date_of_birth: Optional[date] = None
    birth_year: Optional[int] = None
    microchip_number: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None
    is_deceased: Optional[bool] = None
    deceased_date: Optional[date] = None


class AnimalRead(BaseModel):
    id: int
    owner_id: int
    name: str
    species_id: int
    species_name: str
    breed_id: Optional[int]
    breed_name: Optional[str]
    sex: str
    date_of_birth: Optional[date]
    birth_year: Optional[int]
    microchip_number: Optional[str]
    color: Optional[str]
    is_deceased: bool
    deceased_date: Optional[date]
    notes: Optional[str]

    model_config = {"from_attributes": True}
