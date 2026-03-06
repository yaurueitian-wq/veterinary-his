"""
模組二：掛號 & 候診
  visits / visit_status_history
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, ForeignKey,
    Index, Integer, String, Text, text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Visit(Base):
    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    clinic_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("clinics.id"), nullable=False
    )
    # nullable：預留緊急通道（MVP 永遠非 null，ADR-006）
    animal_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("animals.id"), nullable=True
    )
    # 冗餘欄位，方便查詢；與 animal.owner_id 保持一致
    owner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("owners.id"), nullable=True
    )
    # 當前負責獸醫師；輪班制允許轉交，不鎖定原始醫師
    attending_vet_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    # 狀態機（ADR-006）
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'registered'")
    )
    # 候診排序：priority DESC, registered_at ASC（ADR-006）
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'normal'")
    )
    # 主訴（掛號時填寫）
    chief_complaint: Mapped[str] = mapped_column(Text, nullable=False)
    # 緊急標記，MVP 永遠為 false；預留緊急通道（ADR-006）
    is_emergency: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    # 掛號時間（排序依據之一）
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    admitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
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
            "status IN ('registered','triaged','in_consultation',"
            "'pending_results','completed','admitted','cancelled')",
            name="visits_status_check",
        ),
        CheckConstraint(
            "priority IN ('normal', 'urgent')",
            name="visits_priority_check",
        ),
    )


class VisitStatusHistory(Base):
    """就診狀態轉換稽核記錄（ADR-012，append-only）"""
    __tablename__ = "visit_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("visits.id"), nullable=False
    )
    from_status: Mapped[Optional[str]] = mapped_column(
        String(30), nullable=True  # NULL = 初始掛號
    )
    to_status: Mapped[str] = mapped_column(String(30), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    changed_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    __table_args__ = (
        Index("ix_visit_status_history_visit_changed", "visit_id", "changed_at"),
    )
