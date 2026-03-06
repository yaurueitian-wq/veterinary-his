from typing import Optional

from pydantic import BaseModel


class BreedRead(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class BloodTypeRead(BaseModel):
    id: int
    species_id: int
    code: str
    display_name: str

    model_config = {"from_attributes": True}


class SpeciesRead(BaseModel):
    id: int
    name: str
    breeds: list[BreedRead] = []

    model_config = {"from_attributes": True}


class ContactTypeRead(BaseModel):
    id: int
    type_key: str
    display_name: str

    model_config = {"from_attributes": True}


class MucousMembraneColorRead(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class AdministrationRouteRead(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class MedicationRead(BaseModel):
    id: int
    name: str
    medication_category_id: Optional[int] = None
    default_dose_unit: Optional[str] = None

    model_config = {"from_attributes": True}


class MedicationCategoryRead(BaseModel):
    id: int
    name: str
    medications: list[MedicationRead] = []

    model_config = {"from_attributes": True}


class ProcedureTypeRead(BaseModel):
    id: int
    name: str
    procedure_category_id: Optional[int] = None
    species_id: Optional[int] = None

    model_config = {"from_attributes": True}


class ProcedureCategoryRead(BaseModel):
    id: int
    name: str
    procedure_types: list[ProcedureTypeRead] = []

    model_config = {"from_attributes": True}


# ── Lab ───────────────────────────────────────────────────────


class LabAnalyteRead(BaseModel):
    id: int
    name: str
    unit: Optional[str] = None
    analyte_type: str  # 'numeric' | 'text'
    sort_order: int

    model_config = {"from_attributes": True}


class LabTestTypeRead(BaseModel):
    id: int
    lab_category_id: int
    name: str
    analytes: list[LabAnalyteRead] = []

    model_config = {"from_attributes": True}


class LabCategoryRead(BaseModel):
    id: int
    name: str
    test_types: list[LabTestTypeRead] = []

    model_config = {"from_attributes": True}
