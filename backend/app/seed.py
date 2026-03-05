"""
初始資料腳本

使用方式：
    docker compose exec backend python -m app.seed

特性：冪等 — 已有 organization 資料時直接跳過，不會重複建立。
"""
import sys

from sqlalchemy import select

from app.auth import hash_password
from app.database import SessionLocal
from app.models.catalogs import ContactType, LabCategory, MucousMembraneColor, Species
from app.models.foundation import Clinic, Organization, RoleDefinition, User, UserRole


def seed() -> None:
    db = SessionLocal()
    try:
        # 冪等檢查
        if db.execute(select(Organization)).scalar_one_or_none():
            print("資料庫已有初始資料，跳過 seed。")
            return

        print("開始建立初始資料…")

        # ── 1. Organization ──────────────────────────────────────
        org = Organization(name="獸醫診所連鎖集團")
        db.add(org)
        db.flush()

        # ── 2. Clinics ───────────────────────────────────────────
        clinic_names = ["總院", "北區分院", "南區分院", "東區分院", "西區分院"]
        clinics = [Clinic(organization_id=org.id, name=name) for name in clinic_names]
        db.add_all(clinics)
        db.flush()

        # ── 3. Role definitions ──────────────────────────────────
        role_data = [
            ("admin",        "系統管理員"),
            ("vet",          "獸醫師"),
            ("nurse",        "護理人員"),
            ("technician",   "技術員"),
            ("receptionist", "櫃台人員"),
        ]
        role_defs = [
            RoleDefinition(
                organization_id=org.id,
                role_key=key,
                display_name=name,
            )
            for key, name in role_data
        ]
        db.add_all(role_defs)
        db.flush()
        role_map = {r.role_key: r for r in role_defs}

        # ── 4. Admin user（created_by = NULL，第一位使用者）──────
        admin = User(
            organization_id=org.id,
            full_name="系統管理員",
            email="admin@his.local",
            hashed_password=hash_password("his_admin_2026"),
            created_by=None,
        )
        db.add(admin)
        db.flush()

        # ── 5. Admin role（全集團授權，clinic_id = NULL）─────────
        db.add(
            UserRole(
                user_id=admin.id,
                role_definition_id=role_map["admin"].id,
                clinic_id=None,       # NULL = org-wide
                granted_by=admin.id,  # 自我授權（初始化）
            )
        )

        # ── 6. Species ───────────────────────────────────────────
        species_names = ["犬", "貓", "兔", "鳥類", "爬蟲類", "牛", "馬", "其他"]
        db.add_all([
            Species(organization_id=org.id, name=name)
            for name in species_names
        ])

        # ── 7. Contact types ─────────────────────────────────────
        contact_data = [
            ("phone",   "電話"),
            ("email",   "Email"),
            ("line",    "LINE"),
            ("wechat",  "WeChat"),
            ("other",   "其他"),
        ]
        db.add_all([
            ContactType(organization_id=org.id, type_key=key, display_name=name)
            for key, name in contact_data
        ])

        # ── 8. Mucous membrane colors ────────────────────────────
        color_names = ["粉紅（正常）", "蒼白", "黃疸", "發紺", "充血"]
        db.add_all([
            MucousMembraneColor(organization_id=org.id, name=name)
            for name in color_names
        ])

        # ── 9. Lab categories ────────────────────────────────────
        lab_cat_names = ["血液", "尿液", "影像", "心臟", "病理", "其他"]
        db.add_all([
            LabCategory(organization_id=org.id, name=name)
            for name in lab_cat_names
        ])

        db.commit()

        print("初始資料建立完成！")
        print(f"  組織：{org.name}")
        print(f"  分院：{', '.join(clinic_names)}")
        print(f"  管理員帳號：admin@his.local")
        print(f"  管理員密碼：his_admin_2026")
        print()
        print("  ⚠️  請登入後立即修改管理員密碼。")

    except Exception as exc:
        db.rollback()
        print(f"Seed 失敗：{exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
