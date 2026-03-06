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
    is_superseded: bool
    created_at: datetime
    created_by_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── SoapDiagnosis ─────────────────────────────────────────────

class SoapDiagnosisCreate(BaseModel):
    free_text: str
    is_primary: bool = True


class SoapDiagnosisRead(BaseModel):
    id: int
    free_text: Optional[str] = None
    is_primary: bool
    is_superseded: bool
    created_at: datetime

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

    model_config = {"from_attributes": True}


# ── ClinicalSummary（看板卡片用） ────────────────────────────────

class ClinicalSummary(BaseModel):
    """最新一筆生命徵象 + 主診斷，供看板卡片快速顯示"""
    latest_weight_kg: Optional[float] = None
    latest_temperature_c: Optional[float] = None
    latest_heart_rate_bpm: Optional[int] = None
    latest_diagnosis: Optional[str] = None  # 最新 SoapNote 的主診斷 free_text


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
