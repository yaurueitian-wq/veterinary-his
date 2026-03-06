"""
共用目錄表（Reference Catalogs）：
  contact_types / species / breeds / blood_types / mucous_membrane_colors /
  diagnosis_categories / diagnosis_codes / lab_categories / lab_test_types /
  lab_analytes / administration_routes / medication_categories / medications /
  procedure_categories / procedure_types
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, ForeignKey, Integer,
    SmallInteger, String, UniqueConstraint, text,
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


class BloodType(Base):
    __tablename__ = "blood_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # 物種特定，無 organization_id（血型是生物事實，類似 breeds）
    species_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("species.id"), nullable=False
    )
    # 犬: "DEA 1.1+", "DEA 1.1-"；貓: "A", "B", "AB"
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    # 顯示名稱："A 型", "DEA 1.1 陽性"
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    __table_args__ = (
        UniqueConstraint("species_id", "code", name="blood_types_unique"),
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


class LabAnalyte(Base):
    """每個 lab_test_type 包含哪些分析指標（結構性目錄）"""
    __tablename__ = "lab_analytes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    lab_test_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lab_test_types.id"), nullable=False
    )
    # RBC / WBC / ALT / Creatinine / Glucose ...
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # 10^6/μL / U/L / mg/dL（NULL = 無單位）
    unit: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    # numeric（數值型）或 text（文字型）
    analyte_type: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default=text("'numeric'")
    )
    sort_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default=text("0")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    __table_args__ = (
        CheckConstraint(
            "analyte_type IN ('numeric', 'text')",
            name="lab_analytes_type_check",
        ),
        UniqueConstraint("lab_test_type_id", "name", name="lab_analytes_unique"),
    )


class AdministrationRoute(Base):
    __tablename__ = "administration_routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    # 口服 / 皮下注射 / 肌肉注射 / 靜脈注射 / 外用 / 眼用 / 耳用 / 吸入
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="administration_routes_unique"),
    )


class MedicationCategory(Base):
    __tablename__ = "medication_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    # 抗生素 / 消炎止痛 / 驅蟲 / 疫苗 / 外用藥 / 點眼耳藥 / 靜脈輸液 / 其他
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="medication_categories_unique"),
    )


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    medication_category_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("medication_categories.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # mg / mL / tablet / IU（建議值，開立處方時可覆蓋）
    default_dose_unit: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="medications_unique"),
    )


class ProcedureCategory(Base):
    __tablename__ = "procedure_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    # 外科手術 / 牙科處置 / 影像診斷 / 一般處置 / 其他
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="procedure_categories_unique"),
    )


class ProcedureType(Base):
    __tablename__ = "procedure_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    procedure_category_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("procedure_categories.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # NULL = 跨物種通用
    species_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("species.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="procedure_types_unique"),
    )
