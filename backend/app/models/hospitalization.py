"""
模組五：住院管理（ADR-023）
  wards / beds / ward_default_equipment / admissions / admission_equipment /
  daily_rounds / inpatient_nursing_logs / inpatient_nursing_log_actions /
  inpatient_orders / inpatient_order_executions / bed_transfers / discharge_records
"""
from datetime import datetime, date
from typing import Optional

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, ForeignKey,
    Integer, String, Text, UniqueConstraint, text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Ward(Base):
    __tablename__ = "wards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    clinic_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("clinics.id"), nullable=False
    )
    ward_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ward_types.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    __table_args__ = (
        UniqueConstraint("clinic_id", "code", name="wards_unique"),
    )


class Bed(Base):
    __tablename__ = "beds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ward_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("wards.id"), nullable=False
    )
    bed_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bed_types.id"), nullable=False
    )
    bed_number: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'available'")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('available', 'occupied', 'maintenance', 'inactive')",
            name="beds_status_check",
        ),
        UniqueConstraint("ward_id", "bed_number", name="beds_number_unique"),
    )


class WardDefaultEquipment(Base):
    __tablename__ = "ward_default_equipment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ward_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("wards.id"), nullable=False
    )
    equipment_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("equipment_items.id"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("ward_id", "equipment_item_id", name="ward_default_equipment_unique"),
    )


class Admission(Base):
    __tablename__ = "admissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    clinic_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("clinics.id"), nullable=False
    )
    visit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("visits.id"), nullable=False
    )
    bed_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("beds.id"), nullable=False
    )
    admission_reason_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("admission_reasons.id"), nullable=False
    )
    reason_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attending_vet_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'active'")
    )
    admitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    discharged_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'discharged')",
            name="admissions_status_check",
        ),
        UniqueConstraint("visit_id", name="admissions_visit_unique"),
    )


class AdmissionEquipment(Base):
    __tablename__ = "admission_equipment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admission_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("admissions.id"), nullable=False
    )
    equipment_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("equipment_items.id"), nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    __table_args__ = (
        UniqueConstraint("admission_id", "equipment_item_id", name="admission_equipment_unique"),
    )


class DailyRound(Base):
    __tablename__ = "daily_rounds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admission_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("admissions.id"), nullable=False
    )
    round_date: Mapped[date] = mapped_column(Date, nullable=False)
    assessment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    plan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    # append-only（ADR-007）
    is_superseded: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    superseded_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("daily_rounds.id"), nullable=True
    )


class InpatientNursingLog(Base):
    __tablename__ = "inpatient_nursing_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admission_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("admissions.id"), nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    # append-only（ADR-007）
    is_superseded: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    superseded_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("inpatient_nursing_logs.id"), nullable=True
    )


class InpatientNursingLogAction(Base):
    __tablename__ = "inpatient_nursing_log_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nursing_log_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("inpatient_nursing_logs.id"), nullable=False
    )
    action_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("nursing_action_items.id"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("nursing_log_id", "action_item_id", name="nursing_log_actions_unique"),
    )


class InpatientOrder(Base):
    __tablename__ = "inpatient_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admission_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("admissions.id"), nullable=False
    )
    order_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("order_types.id"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    frequency_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("frequencies.id"), nullable=True
    )
    start_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    end_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'active'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    # append-only（ADR-007）
    is_superseded: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    superseded_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("inpatient_orders.id"), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'completed', 'cancelled')",
            name="inpatient_orders_status_check",
        ),
    )


class InpatientOrderExecution(Base):
    __tablename__ = "inpatient_order_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("inpatient_orders.id"), nullable=False
    )
    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )


class BedTransfer(Base):
    __tablename__ = "bed_transfers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admission_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("admissions.id"), nullable=False
    )
    from_bed_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("beds.id"), nullable=False
    )
    to_bed_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("beds.id"), nullable=False
    )
    reason_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("transfer_reasons.id"), nullable=False
    )
    reason_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    transferred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    transferred_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )


class DischargeRecord(Base):
    __tablename__ = "discharge_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admission_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("admissions.id"), nullable=False
    )
    discharge_reason_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("discharge_reasons.id"), nullable=False
    )
    discharge_condition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("discharge_conditions.id"), nullable=False
    )
    discharge_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    follow_up_plan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    discharged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    discharged_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("admission_id", name="discharge_records_admission_unique"),
    )
