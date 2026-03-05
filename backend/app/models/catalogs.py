"""
共用目錄表（Reference Catalogs）：
  contact_types / species / breeds / mucous_membrane_colors /
  diagnosis_categories / diagnosis_codes / lab_categories / lab_test_types
"""
from typing import Optional

from sqlalchemy import (
    Boolean, CheckConstraint, ForeignKey, Integer,
    String, UniqueConstraint, text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ContactType(Base):
    __tablename__ = "contact_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    # phone / email / line / wechat / other
    type_key: Mapped[str] = mapped_column(String(30), nullable=False)
    display_name: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "type_key", name="contact_types_unique"),
    )


class Species(Base):
    __tablename__ = "species"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    # 犬、貓、兔、鳥類、爬蟲類、牛、馬、其他
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="species_name_unique"),
    )


class Breed(Base):
    __tablename__ = "breeds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    species_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("species.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    __table_args__ = (
        UniqueConstraint("species_id", "name", name="breeds_name_unique"),
    )


class MucousMembraneColor(Base):
    __tablename__ = "mucous_membrane_colors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    # 粉紅（正常）/ 蒼白 / 黃疸 / 發紺 / 充血
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )


class DiagnosisCategory(Base):
    __tablename__ = "diagnosis_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    # 消化 / 骨科 / 皮膚 / 心臟 / 傳染病 ...
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    __table_args__ = (
        UniqueConstraint(
            "organization_id", "name", name="diagnosis_categories_unique"
        ),
    )


class DiagnosisCode(Base):
    __tablename__ = "diagnosis_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    # 外部編碼系統代碼；內部自訂時可為 NULL
    code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # MVP：internal；未來：venomcode / snomed
    coding_system: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    # 診斷分類（NULL = 未分類）
    category_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("diagnosis_categories.id"), nullable=True
    )
    # NULL = 跨物種通用
    species_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("species.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    __table_args__ = (
        CheckConstraint(
            "coding_system IN ('internal', 'venomcode', 'snomed') OR coding_system IS NULL",
            name="diagnosis_coding_system_check",
        ),
    )


class LabCategory(Base):
    __tablename__ = "lab_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    # 血液 / 尿液 / 影像 / 心臟 / 病理 / 其他
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )


class LabTestType(Base):
    __tablename__ = "lab_test_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    lab_category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lab_categories.id"), nullable=False
    )
    # 全血計數（CBC）/ X-ray 胸腔 / 心電圖 ...
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
