from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── 共用基底 ──────────────────────────────────────────────────────

class _Cfg(BaseModel):
    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════
# Breed
# ══════════════════════════════════════════════════════════════════

class BreedRead(_Cfg):
    id: int
    species_id: int
    name: str
    is_active: bool


class BreedCreate(BaseModel):
    species_id: int
    name: str = Field(..., max_length=100)


class BreedUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════
# BloodType
# ══════════════════════════════════════════════════════════════════

class BloodTypeRead(_Cfg):
    id: int
    species_id: int
    code: str
    display_name: str
    is_active: bool


class BloodTypeCreate(BaseModel):
    species_id: int
    code: str = Field(..., max_length=20)
    display_name: str = Field(..., max_length=100)


class BloodTypeUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════
# Species
# ══════════════════════════════════════════════════════════════════

class SpeciesRead(_Cfg):
    id: int
    name: str
    is_active: bool
    breeds: list[BreedRead] = []


class SpeciesCreate(BaseModel):
    name: str = Field(..., max_length=100)


class SpeciesUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════
# ContactType
# ══════════════════════════════════════════════════════════════════

class ContactTypeRead(_Cfg):
    id: int
    type_key: str
    display_name: str
    is_active: bool


class ContactTypeCreate(BaseModel):
    type_key: str = Field(..., max_length=30)
    display_name: str = Field(..., max_length=50)


class ContactTypeUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════
# MucousMembraneColor
# ══════════════════════════════════════════════════════════════════

class MucousMembraneColorRead(_Cfg):
    id: int
    name: str
    is_active: bool


class MucousMembraneColorCreate(BaseModel):
    name: str = Field(..., max_length=50)


class MucousMembraneColorUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════
# DiagnosisCategory
# ══════════════════════════════════════════════════════════════════

class DiagnosisCategoryRead(_Cfg):
    id: int
    organization_id: int
    name: str
    is_active: bool


class DiagnosisCategoryCreate(BaseModel):
    name: str = Field(..., max_length=100)


class DiagnosisCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════
# DiagnosisCode
# ══════════════════════════════════════════════════════════════════

class DiagnosisCodeRead(_Cfg):
    id: int
    organization_id: int
    name: str
    code: Optional[str] = None
    coding_system: Optional[str] = None
    category_id: Optional[int] = None
    species_id: Optional[int] = None
    is_active: bool


class DiagnosisCodeCreate(BaseModel):
    name: str = Field(..., max_length=200)
    category_id: Optional[int] = None
    species_id: Optional[int] = None
    code: Optional[str] = Field(None, max_length=50)
    coding_system: Literal["internal", "venomcode", "snomed"] = "internal"


class DiagnosisCodeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    category_id: Optional[int] = None
    species_id: Optional[int] = None
    code: Optional[str] = Field(None, max_length=50)
    coding_system: Optional[Literal["internal", "venomcode", "snomed"]] = None
    is_active: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════
# AdministrationRoute
# ══════════════════════════════════════════════════════════════════

class AdministrationRouteRead(_Cfg):
    id: int
    name: str
    is_active: bool


class AdministrationRouteCreate(BaseModel):
    name: str = Field(..., max_length=50)


class AdministrationRouteUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════
# MedicationCategory + Medication
# ══════════════════════════════════════════════════════════════════

class MedicationRead(_Cfg):
    id: int
    name: str
    medication_category_id: Optional[int] = None
    default_dose_unit: Optional[str] = None
    is_active: bool


class MedicationCreate(BaseModel):
    name: str = Field(..., max_length=200)
    medication_category_id: Optional[int] = None
    default_dose_unit: Optional[str] = Field(None, max_length=30)


class MedicationUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    medication_category_id: Optional[int] = None
    default_dose_unit: Optional[str] = Field(None, max_length=30)
    is_active: Optional[bool] = None


class MedicationCategoryRead(_Cfg):
    id: int
    name: str
    is_active: bool
    medications: list[MedicationRead] = []


class MedicationCategoryCreate(BaseModel):
    name: str = Field(..., max_length=100)


class MedicationCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════
# ProcedureCategory + ProcedureType
# ══════════════════════════════════════════════════════════════════

class ProcedureTypeRead(_Cfg):
    id: int
    name: str
    procedure_category_id: Optional[int] = None
    species_id: Optional[int] = None
    is_active: bool


class ProcedureTypeCreate(BaseModel):
    name: str = Field(..., max_length=200)
    procedure_category_id: Optional[int] = None
    species_id: Optional[int] = None


class ProcedureTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    procedure_category_id: Optional[int] = None
    species_id: Optional[int] = None
    is_active: Optional[bool] = None


class ProcedureCategoryRead(_Cfg):
    id: int
    name: str
    is_active: bool
    procedure_types: list[ProcedureTypeRead] = []


class ProcedureCategoryCreate(BaseModel):
    name: str = Field(..., max_length=100)


class ProcedureCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════
# Lab
# ══════════════════════════════════════════════════════════════════

class LabAnalyteRead(_Cfg):
    id: int
    lab_test_type_id: int
    name: str
    unit: Optional[str] = None
    analyte_type: str  # 'numeric' | 'text'
    sort_order: int
    is_active: bool


class LabAnalyteCreate(BaseModel):
    name: str = Field(..., max_length=100)
    lab_test_type_id: int
    unit: Optional[str] = Field(None, max_length=30)
    analyte_type: Literal["numeric", "text"] = "numeric"
    sort_order: int = 0


class LabAnalyteUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, max_length=30)
    analyte_type: Optional[Literal["numeric", "text"]] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class LabTestTypeRead(_Cfg):
    id: int
    lab_category_id: int
    name: str
    is_active: bool
    analytes: list[LabAnalyteRead] = []


class LabTestTypeCreate(BaseModel):
    name: str = Field(..., max_length=200)
    lab_category_id: int


class LabTestTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    lab_category_id: Optional[int] = None
    is_active: Optional[bool] = None


class LabCategoryRead(_Cfg):
    id: int
    name: str
    is_active: bool
    test_types: list[LabTestTypeRead] = []


class LabCategoryCreate(BaseModel):
    name: str = Field(..., max_length=100)


class LabCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None
