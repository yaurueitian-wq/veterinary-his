"""
分析模組 Models
"""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class InsightDismissal(Base):
    __tablename__ = "insight_dismissals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    insight_key: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    dismissed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
