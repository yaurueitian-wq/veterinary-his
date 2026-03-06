"""
臨床記錄 Schemas
  VitalSign / SoapNote / SoapDiagnosis / NursingNote
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ── VitalSign ─────────────────────────────────────────────────

class VitalSignCreate(BaseModel):
    weight_kg: Optional[float] = None
    temperature_c: Optional[float] = None
    heart_rate_bpm: Optional[int] = None
    respiratory_rate_bpm: Optional[int] = None
    systolic_bp_mmhg: Optional[int] = None
    capillary_refill_sec: Optional[float] = None
    body_condition_score: Optional[int] = None  # 1–9


class VitalSignRead(BaseModel):
    id: int
    visit_id: int
    weight_kg: Optional[float] = None
    temperature_c: Optional[float] = None
    heart_rate_bpm: Optional[int] = None
    respiratory_rate_bpm: Optional[int] = None
    systolic_bp_mmhg: Optional[int] = None
    capillary_refill_sec: Optional[float] = None
    body_condition_score: Optional[int] = None
    mucous_membrane_color_id: Optional[int] = None
    mucous_membrane_color_name: Optional[str] = None
    is_superseded: bool
    created_at: datetime
    created_by_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── SoapDiagnosis ─────────────────────────────────────────────

class SoapDiagnosisCreate(BaseModel):
    free_text: str


class SoapDiagnosisRead(BaseModel):
    id: int
    free_text: Optional[str] = None
    is_superseded: bool
    created_at: datetime
    created_by_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── SoapNote ──────────────────────────────────────────────────

class SoapNoteCreate(BaseModel):
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    diagnoses: list[SoapDiagnosisCreate] = []


class SoapNoteRead(BaseModel):
    id: int
    visit_id: int
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    diagnoses: list[SoapDiagnosisRead] = []
    is_superseded: bool
    created_at: datetime
    created_by_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── ClinicalSummary（看板卡片用） ────────────────────────────────

class ClinicalSummary(BaseModel):
    """最新一筆生命徵象 + 主診斷，供看板卡片快速顯示"""
    latest_weight_kg: Optional[float] = None
    latest_temperature_c: Optional[float] = None
    latest_heart_rate_bpm: Optional[int] = None
    latest_diagnosis: Optional[str] = None  # 最新 SoapNote 的主診斷 free_text
    has_pending_lab: bool = False            # 是否有待結果的檢驗單


# ── NursingNote ───────────────────────────────────────────────

class NursingNoteCreate(BaseModel):
    note_text: str


class NursingNoteRead(BaseModel):
    id: int
    visit_id: int
    note_text: str
    is_superseded: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── LabOrder ──────────────────────────────────────────────────


class LabResultItemCreate(BaseModel):
    analyte_id: int
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    is_abnormal: Optional[bool] = None
    notes: Optional[str] = None


class LabResultItemRead(BaseModel):
    id: int
    analyte_id: int
    analyte_name: str       # JOIN 帶入
    unit: Optional[str] = None
    analyte_type: str
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    is_abnormal: Optional[bool] = None
    notes: Optional[str] = None
    is_superseded: bool
    created_at: datetime
    created_by_name: Optional[str] = None

    model_config = {"from_attributes": True}


class LabOrderCreate(BaseModel):
    test_type_id: int
    notes: Optional[str] = None


class LabOrderRead(BaseModel):
    id: int
    visit_id: int
    test_type_id: int
    test_type_name: str     # JOIN 帶入
    status: str             # pending | resulted | cancelled
    notes: Optional[str] = None
    resulted_at: Optional[datetime] = None
    resulted_by_name: Optional[str] = None
    is_superseded: bool
    created_at: datetime
    created_by_name: Optional[str] = None
    result_items: list[LabResultItemRead] = []

    model_config = {"from_attributes": True}


class LabResultSubmit(BaseModel):
    """技術員填寫完所有指標後一次提交"""
    items: list[LabResultItemCreate]
