"""
初始資料腳本

使用方式：
    docker compose exec backend python -m app.seed

特性：冪等 — 已有 organization 資料時直接跳過，不會重複建立。
"""
import sys

from sqlalchemy import func, select

from app.auth import hash_password
from app.database import SessionLocal
from app.models.catalogs import (
    AdministrationRoute, BloodType, ContactType, LabAnalyte, LabCategory,
    LabTestType, MedicationCategory, MucousMembraneColor, ProcedureCategory,
    Species,
)
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
        species_objs = [Species(organization_id=org.id, name=name) for name in species_names]
        db.add_all(species_objs)
        db.flush()
        species_map = {s.name: s for s in species_objs}

        # ── 6b. Blood types（物種特定，MVP 只 seed 犬貓）────────
        blood_type_data = [
            ("犬", "DEA 1.1+", "DEA 1.1 陽性"),
            ("犬", "DEA 1.1-", "DEA 1.1 陰性"),
            ("貓", "A",        "A 型"),
            ("貓", "B",        "B 型"),
            ("貓", "AB",       "AB 型"),
        ]
        db.add_all([
            BloodType(species_id=species_map[sp].id, code=code, display_name=display)
            for sp, code, display in blood_type_data
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

        # ── 10. Administration routes ─────────────────────────────
        route_names = ["口服", "皮下注射", "肌肉注射", "靜脈注射", "外用", "眼用", "耳用", "吸入"]
        db.add_all([
            AdministrationRoute(organization_id=org.id, name=name)
            for name in route_names
        ])

        # ── 11. Medication categories ─────────────────────────────
        med_cat_names = ["抗生素", "消炎止痛", "驅蟲", "疫苗", "外用藥", "點眼耳藥", "靜脈輸液", "其他"]
        db.add_all([
            MedicationCategory(organization_id=org.id, name=name)
            for name in med_cat_names
        ])

        # ── 12. Procedure categories ──────────────────────────────
        proc_cat_names = ["外科手術", "牙科處置", "影像診斷", "一般處置", "其他"]
        db.add_all([
            ProcedureCategory(organization_id=org.id, name=name)
            for name in proc_cat_names
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


def seed_lab_data() -> None:
    """補充 lab_test_types + lab_analytes（冪等，可單獨執行）"""
    db = SessionLocal()
    try:
        org = db.execute(select(Organization)).scalar_one_or_none()
        if not org:
            print("尚未執行基礎 seed，請先執行 python -m app.seed", file=sys.stderr)
            return

        # 冪等：已有資料則跳過
        existing_count = db.scalar(
            select(func.count()).select_from(LabTestType).where(
                LabTestType.organization_id == org.id
            )
        )
        if existing_count and existing_count > 0:
            print(f"lab_test_types 已有 {existing_count} 筆，跳過 lab seed。")
            return

        print("開始補充 lab_test_types + lab_analytes…")

        # 取得 lab_categories map
        cats = db.execute(
            select(LabCategory).where(LabCategory.organization_id == org.id)
        ).scalars().all()
        cat_map = {c.name: c for c in cats}

        # ── CBC ─────────────────────────────────────────────────
        cbc = LabTestType(
            organization_id=org.id,
            lab_category_id=cat_map["血液"].id,
            name="全血計數（CBC）",
        )
        db.add(cbc)
        db.flush()

        cbc_analytes = [
            ("WBC（白血球）",              "10³/μL", "numeric", 1),
            ("RBC（紅血球）",              "10⁶/μL", "numeric", 2),
            ("HGB（血紅素）",              "g/dL",   "numeric", 3),
            ("HCT（血容比）",              "%",      "numeric", 4),
            ("PLT（血小板）",              "10³/μL", "numeric", 5),
            ("MCV（平均血球容積）",         "fL",     "numeric", 6),
            ("MCH（平均血球血色素）",       "pg",     "numeric", 7),
            ("MCHC（平均血球血色素濃度）",  "g/dL",   "numeric", 8),
            ("WBC 分類",                   None,     "text",    9),
        ]
        db.add_all([
            LabAnalyte(
                organization_id=org.id,
                lab_test_type_id=cbc.id,
                name=name, unit=unit, analyte_type=atype, sort_order=order,
            )
            for name, unit, atype, order in cbc_analytes
        ])

        # ── 血液生化 ─────────────────────────────────────────────
        biochem = LabTestType(
            organization_id=org.id,
            lab_category_id=cat_map["血液"].id,
            name="血液生化（Biochemistry）",
        )
        db.add(biochem)
        db.flush()

        biochem_analytes = [
            ("ALT（丙胺酸轉胺酶）",     "U/L",   "numeric", 1),
            ("AST（天門冬胺酸轉胺酶）", "U/L",   "numeric", 2),
            ("ALP（鹼性磷酸酶）",       "U/L",   "numeric", 3),
            ("BUN（血尿素氮）",         "mg/dL", "numeric", 4),
            ("Creatinine（肌酸酐）",    "mg/dL", "numeric", 5),
            ("Glucose（血糖）",         "mg/dL", "numeric", 6),
            ("TP（總蛋白）",            "g/dL",  "numeric", 7),
            ("Albumin（白蛋白）",       "g/dL",  "numeric", 8),
            ("Ca（鈣）",                "mg/dL", "numeric", 9),
            ("P（磷）",                 "mg/dL", "numeric", 10),
            ("Cholesterol（膽固醇）",   "mg/dL", "numeric", 11),
            ("T-Bili（總膽紅素）",      "mg/dL", "numeric", 12),
        ]
        db.add_all([
            LabAnalyte(
                organization_id=org.id,
                lab_test_type_id=biochem.id,
                name=name, unit=unit, analyte_type=atype, sort_order=order,
            )
            for name, unit, atype, order in biochem_analytes
        ])

        # ── 影像（無 analytes）──────────────────────────────────
        db.add_all([
            LabTestType(
                organization_id=org.id,
                lab_category_id=cat_map["影像"].id,
                name=name,
            )
            for name in ["X-ray 胸腔", "X-ray 腹腔"]
        ])

        db.commit()
        print("lab_test_types + lab_analytes 建立完成！")

    except Exception as exc:
        db.rollback()
        print(f"Lab seed 失敗：{exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import sys as _sys
    if len(_sys.argv) > 1 and _sys.argv[1] == "lab":
        seed_lab_data()
    else:
        seed()
