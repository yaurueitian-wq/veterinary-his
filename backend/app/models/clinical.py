"""
模組三 & 四：門診 & 檢驗
  vital_signs / soap_notes / soap_diagnoses / nursing_notes / lab_orders /
  prescription_orders / medication_administrations / procedure_records
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, ForeignKey,
    Integer, Numeric, SmallInteger, String, Text, text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class VitalSign(Base):
    __tablename__ = "vital_signs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("visits.id"), nullable=False
    )
    weight_kg: Mapped[Optional[float]] = mapped_column(Numeric(6, 3), nullable=True)
    temperature_c: Mapped[Optional[float]] = mapped_column(Numeric(4, 2), nullable=True)
    heart_rate_bpm: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    respiratory_rate_bpm: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    # 收縮壓（部分動物測量）
    systolic_bp_mmhg: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    # 微血管充填時間
    capillary_refill_sec: Mapped[Optional[float]] = mapped_column(Numeric(3, 1), nullable=True)
    mucous_membrane_color_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("mucous_membrane_colors.id"), nullable=True
    )
    # BCS：犬貓 1-9；大型動物 1-5，沿用 1-9 欄位並以 1-5 填寫
    body_condition_score: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    # append-only（ADR-007）
    is_superseded: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    superseded_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("vital_signs.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    # 允許 nurse 或 vet 角色建立（應用層權限控制）
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "body_condition_score BETWEEN 1 AND 9",
            name="vital_signs_bcs_check",
        ),
    )


class SoapNote(Base):
    __tablename__ = "soap_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("visits.id"), nullable=False
    )
    # S — Subjective（主觀）：飼主主訴、病史、症狀描述
    subjective: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # O — Objective（客觀）：理學檢查發現（量化數值在 vital_signs）
    objective: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # A — Assessment（評估）：獸醫師臨床推理（結構化診斷在 soap_diagnoses）
    assessment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # P — Plan（計畫）：處置計畫、衛教指示、追蹤建議
    plan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # append-only（ADR-007）
    is_superseded: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    superseded_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("soap_notes.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    # 僅 vet 角色可建立（應用層權限控制）
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )


class SoapDiagnosis(Base):
    __tablename__ = "soap_diagnoses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    soap_note_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("soap_notes.id"), nullable=False
    )
    # NULL = 純自由文字診斷（無對應碼時）
    code_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("diagnosis_codes.id"), nullable=True
    )
    # code_id 非 null 時可補充說明；code_id 為 null 時必填
    free_text: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # 主診斷 vs 次診斷
    is_primary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    # append-only（ADR-007）
    is_superseded: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    superseded_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("soap_diagnoses.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )

    __table_args__ = (
        # DB 層確保：code_id 或 free_text 至少一者非 null
        CheckConstraint(
            "code_id IS NOT NULL OR free_text IS NOT NULL",
            name="soap_diagnoses_code_or_text",
        ),
    )


class NursingNote(Base):
    __tablename__ = "nursing_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("visits.id"), nullable=False
    )
    # 護理觀察、處置說明、交班備忘（臨床敘述，不可避免的自由文字）
    note_text: Mapped[str] = mapped_column(Text, nullable=False)
    # append-only（ADR-007）
    is_superseded: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    superseded_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("nursing_notes.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    # 允許 nurse 或 vet 角色建立（應用層權限控制）
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )


class LabOrder(Base):
    __tablename__ = "lab_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("visits.id"), nullable=False
    )
    clinic_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("clinics.id"), nullable=False
    )
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    test_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lab_test_types.id"), nullable=False
    )
    # 下醫囑的獸醫師
    ordered_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'pending'")
    )
    # MVP 人工輸入結果；未來儀器串接後可新增結構化欄位
    result_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resulted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # 輸入結果的人員（technician / nurse）
    resulted_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    # 醫囑備註或特殊說明
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # append-only（ADR-007）
    is_superseded: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    superseded_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("lab_orders.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'resulted', 'cancelled')",
            name="lab_orders_status_check",
        ),
    )


class PrescriptionOrder(Base):
    __tablename__ = "prescription_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    soap_note_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("soap_notes.id"), nullable=False
    )
    # NULL = 自由文字（無對應目錄項目時）
    medication_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("medications.id"), nullable=True
    )
    # medication_id IS NULL 時必填
    free_text: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    dose: Mapped[Optional[float]] = mapped_column(Numeric(8, 3), nullable=True)
    # 可覆蓋藥品的 default_dose_unit
    dose_unit: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    administration_route_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("administration_routes.id"), nullable=True
    )
    # 自由文字：SID / BID / TID / PRN ...
    frequency: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    duration_days: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    # 服藥注意事項（衛教）
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # append-only（ADR-007）
    is_superseded: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    superseded_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("prescription_orders.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    # 僅 vet 角色可建立（應用層權限控制）
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "medication_id IS NOT NULL OR free_text IS NOT NULL",
            name="prescription_orders_med_or_text",
        ),
    )


class MedicationAdministration(Base):
    __tablename__ = "medication_administrations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    soap_note_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("soap_notes.id"), nullable=False
    )
    # NULL = 未依處方的臨時給藥
    prescription_order_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("prescription_orders.id"), nullable=True
    )
    medication_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("medications.id"), nullable=True
    )
    free_text: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    dose: Mapped[Optional[float]] = mapped_column(Numeric(8, 3), nullable=True)
    dose_unit: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    administration_route_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("administration_routes.id"), nullable=True
    )
    administered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    # append-only（ADR-007）
    is_superseded: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    superseded_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("medication_administrations.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    # 允許 nurse 或 vet 角色建立（應用層權限控制）
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "medication_id IS NOT NULL OR free_text IS NOT NULL",
            name="medication_administrations_med_or_text",
        ),
    )


class ProcedureRecord(Base):
    __tablename__ = "procedure_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    soap_note_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("soap_notes.id"), nullable=False
    )
    # NULL = 自由文字（無對應目錄項目時）
    procedure_type_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("procedure_types.id"), nullable=True
    )
    # procedure_type_id IS NULL 時必填
    free_text: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # append-only（ADR-007）
    is_superseded: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    superseded_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("procedure_records.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    # 允許 vet 角色建立（應用層權限控制）
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "procedure_type_id IS NOT NULL OR free_text IS NOT NULL",
            name="procedure_records_type_or_text",
        ),
    )
