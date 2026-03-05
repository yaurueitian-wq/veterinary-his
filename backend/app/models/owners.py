"""
模組一：飼主 & 動物建檔
  owners / owner_contacts / owner_addresses / animals
"""
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, ForeignKey,
    Index, Integer, Numeric, SmallInteger, String, Text, text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Owner(Base):
    __tablename__ = "owners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # 跨院所共用，不加 clinic_id（ADR-002）
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    # 身分證字號 / 護照號；nullable，未來串接政府動物登記時重要
    national_id: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )

    __table_args__ = (
        # national_id 有值時才需唯一（ADR-009）
        Index(
            "owners_national_id_idx",
            "organization_id", "national_id",
            unique=True,
            postgresql_where=text("national_id IS NOT NULL"),
        ),
    )


class OwnerContact(Base):
    __tablename__ = "owner_contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("owners.id"), nullable=False
    )
    contact_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("contact_types.id"), nullable=False
    )
    # 實際聯絡值（電話號碼 / email / LINE ID ...）
    value: Mapped[str] = mapped_column(String(200), nullable=False)
    label: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'personal'")
    )
    is_primary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "label IN ('personal', 'work', 'other')",
            name="owner_contacts_label_check",
        ),
    )


class OwnerAddress(Base):
    __tablename__ = "owner_addresses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("owners.id"), nullable=False
    )
    label: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'home'")
    )
    postal_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    # 縣市（例：台北市）
    county: Mapped[str] = mapped_column(String(50), nullable=False)
    # 鄉鎮市區（例：中正區）
    district: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # 路段（例：忠孝東路五段 100 號）
    street: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # 樓層 / 室（例：3 樓之 1）
    detail: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_primary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "label IN ('home', 'work', 'other')",
            name="owner_addresses_label_check",
        ),
    )


class Animal(Base):
    __tablename__ = "animals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # 跨院所共用，不加 clinic_id（ADR-002）
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id"), nullable=False
    )
    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("owners.id"), nullable=False
    )
    # 動物名稱（例：小白）
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    species_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("species.id"), nullable=False
    )
    # nullable：品種不明或混種
    breed_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("breeds.id"), nullable=True
    )
    sex: Mapped[str] = mapped_column(String(20), nullable=False)
    # 精確生日（擇一填寫）
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # 只知道年份時使用
    birth_year: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    # 晶片號碼；nullable（並非所有動物都有晶片）
    microchip_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # 耳標號碼（大型動物用）
    tag_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # 刺青識別碼
    tattoo_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # 毛色 / 外觀描述（MVP 保留自由文字）
    color: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_deceased: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    deceased_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "sex IN ('intact_male', 'intact_female', 'neutered_male', 'neutered_female', 'unknown')",
            name="animals_sex_check",
        ),
        # 晶片號碼唯一（有值時）（ADR-009）
        Index(
            "animals_microchip_idx",
            "organization_id", "microchip_number",
            unique=True,
            postgresql_where=text("microchip_number IS NOT NULL"),
        ),
    )
