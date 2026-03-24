"""
住院管理 Schemas（ADR-023）
"""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


# ── Ward & Bed ─────────────────────────────────────────────────

class WardRead(BaseModel):
    id: int
    clinic_id: int
    ward_type_id: int
    ward_type_name: str
    name: str
    code: str
    is_active: bool
    total_beds: int = 0
    available_beds: int = 0


class BedRead(BaseModel):
    id: int
    ward_id: int
    bed_type_id: int
    bed_type_name: str
    bed_number: str
    status: str
    is_active: bool


class WardDetailRead(WardRead):
    beds: list[BedRead] = []
    default_equipment: list[dict] = []  # [{id, name}]


# ── Admission ──────────────────────────────────────────────────

class AdmissionCreate(BaseModel):
    bed_id: int
    admission_reason_id: int
    reason_notes: Optional[str] = None
    attending_vet_id: int
    equipment_item_ids: list[int] = []


class AdmissionRead(BaseModel):
    id: int
    visit_id: int
    clinic_id: int
    bed_id: int
    bed_number: str
    ward_name: str
    admission_reason_id: int
    admission_reason_name: str
    reason_notes: Optional[str] = None
    attending_vet_id: int
    attending_vet_name: str
    status: str
    admitted_at: datetime
    discharged_at: Optional[datetime] = None
    created_at: datetime
    created_by_name: str
    equipment: list[dict] = []  # [{id, name, notes}]


# ── Daily Round ────────────────────────────────────────────────

class DailyRoundCreate(BaseModel):
    round_date: date
    assessment: Optional[str] = None
    plan: Optional[str] = None


class DailyRoundRead(BaseModel):
    id: int
    admission_id: int
    round_date: date
    assessment: Optional[str] = None
    plan: Optional[str] = None
    is_superseded: bool
    created_at: datetime
    created_by_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Inpatient Nursing Log ──────────────────────────────────────

class InpatientNursingLogCreate(BaseModel):
    action_item_ids: list[int] = []
    notes: Optional[str] = None


class InpatientNursingLogRead(BaseModel):
    id: int
    admission_id: int
    notes: Optional[str] = None
    actions: list[dict] = []  # [{id, name}]
    is_superseded: bool
    created_at: datetime
    created_by_name: Optional[str] = None


# ── Inpatient Order ────────────────────────────────────────────

class InpatientOrderCreate(BaseModel):
    order_type_id: int
    description: str
    frequency_id: Optional[int] = None
    end_at: Optional[datetime] = None


class InpatientOrderRead(BaseModel):
    id: int
    admission_id: int
    order_type_id: int
    order_type_name: str
    description: str
    frequency_id: Optional[int] = None
    frequency_code: Optional[str] = None
    frequency_name: Optional[str] = None
    start_at: datetime
    end_at: Optional[datetime] = None
    status: str
    is_superseded: bool
    created_at: datetime
    created_by_name: Optional[str] = None
    executions: list["OrderExecutionRead"] = []


class OrderExecutionCreate(BaseModel):
    notes: Optional[str] = None


class OrderExecutionRead(BaseModel):
    id: int
    order_id: int
    executed_at: datetime
    notes: Optional[str] = None
    created_by_name: Optional[str] = None


# ── Bed Transfer ───────────────────────────────────────────────

class BedTransferCreate(BaseModel):
    to_bed_id: int
    reason_id: int
    reason_notes: Optional[str] = None


class BedTransferRead(BaseModel):
    id: int
    admission_id: int
    from_bed_id: int
    from_bed_number: str
    to_bed_id: int
    to_bed_number: str
    reason_id: int
    reason_name: str
    reason_notes: Optional[str] = None
    transferred_at: datetime
    transferred_by_name: str


# ── Discharge ──────────────────────────────────────────────────

class DischargeCreate(BaseModel):
    discharge_reason_id: int
    discharge_condition_id: int
    discharge_notes: Optional[str] = None
    follow_up_plan: Optional[str] = None


class DischargeRead(BaseModel):
    id: int
    admission_id: int
    discharge_reason_id: int
    discharge_reason_name: str
    discharge_condition_id: int
    discharge_condition_name: str
    discharge_notes: Optional[str] = None
    follow_up_plan: Optional[str] = None
    discharged_at: datetime
    discharged_by_name: str
