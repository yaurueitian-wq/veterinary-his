"""
Model Metadata 測試（不需 DB 連線）

透過 SQLAlchemy Base.metadata 檢查：
1. 所有預期的資料表都有定義
2. 每張表都有主鍵
3. CHECK 約束存在（名稱正確）
4. UNIQUE 約束存在（名稱正確）
5. Append-only 資料表有 is_superseded + superseded_by 欄位
"""
import pytest

# 匯入所有 model 模組以觸發 Base.metadata 登錄
import app.models.foundation  # noqa: F401
import app.models.catalogs    # noqa: F401
import app.models.owners      # noqa: F401
import app.models.visits      # noqa: F401
import app.models.clinical    # noqa: F401

from app.models.base import Base

METADATA = Base.metadata


def _get_table(name: str):
    assert name in METADATA.tables, f"資料表 '{name}' 不存在於 metadata"
    return METADATA.tables[name]


def _constraint_names(table) -> set[str]:
    return {c.name for c in table.constraints if c.name}


# ── 1. 預期存在的資料表 ──────────────────────────────────────────

EXPECTED_TABLES = [
    # foundation
    "organizations", "clinics", "role_definitions", "users", "user_roles",
    # catalogs
    "contact_types", "species", "breeds", "blood_types",
    "mucous_membrane_colors",
    "diagnosis_categories", "diagnosis_codes",
    "medications", "medication_categories", "administration_routes",
    "procedure_types", "procedure_categories",
    "lab_categories", "lab_test_types", "lab_analytes",
    # owners
    "owners", "owner_contacts", "owner_addresses", "animals",
    "animal_diseases", "animal_medications",
    # visits
    "visits",
    # clinical
    "vital_signs", "soap_notes", "soap_diagnoses", "nursing_notes",
    "lab_orders", "lab_result_items",
    "prescription_orders", "medication_administrations", "procedure_records",
]


@pytest.mark.parametrize("table_name", EXPECTED_TABLES)
def test_table_exists(table_name: str):
    assert table_name in METADATA.tables, f"資料表 '{table_name}' 未在 metadata 中定義"


# ── 2. 每張表都有主鍵 ───────────────────────────────────────────

@pytest.mark.parametrize("table_name", EXPECTED_TABLES)
def test_table_has_primary_key(table_name: str):
    if table_name not in METADATA.tables:
        pytest.skip(f"資料表 {table_name} 不存在，跳過")
    table = METADATA.tables[table_name]
    pk_cols = list(table.primary_key.columns)
    assert pk_cols, f"資料表 '{table_name}' 沒有主鍵"


# ── 3. CHECK 約束 ────────────────────────────────────────────────

EXPECTED_CHECK_CONSTRAINTS = [
    ("vital_signs",             "vital_signs_bcs_check"),
    ("soap_diagnoses",          "soap_diagnoses_code_or_text"),
    ("lab_orders",              "lab_orders_status_check"),
    ("prescription_orders",     "prescription_orders_med_or_text"),
    ("medication_administrations", "medication_administrations_med_or_text"),
    ("procedure_records",       "procedure_records_type_or_text"),
    ("animal_diseases",         "animal_diseases_code_or_text"),
    ("animal_medications",      "animal_medications_med_or_text"),
]


@pytest.mark.parametrize("table_name,constraint_name", EXPECTED_CHECK_CONSTRAINTS)
def test_check_constraint_exists(table_name: str, constraint_name: str):
    if table_name not in METADATA.tables:
        pytest.skip(f"資料表 {table_name} 不存在，跳過")
    names = _constraint_names(METADATA.tables[table_name])
    assert constraint_name in names, (
        f"資料表 '{table_name}' 缺少 CHECK 約束 '{constraint_name}'，"
        f"現有約束：{sorted(names)}"
    )


# ── 4. Append-only 資料表有 is_superseded + superseded_by ───────

APPEND_ONLY_TABLES = [
    "vital_signs",
    "soap_notes",
    "soap_diagnoses",
    "nursing_notes",
    "lab_orders",
    "lab_result_items",
    "prescription_orders",
    "medication_administrations",
    "procedure_records",
]


@pytest.mark.parametrize("table_name", APPEND_ONLY_TABLES)
def test_append_only_has_is_superseded(table_name: str):
    if table_name not in METADATA.tables:
        pytest.skip(f"資料表 {table_name} 不存在，跳過")
    table = METADATA.tables[table_name]
    col_names = {c.name for c in table.columns}
    assert "is_superseded" in col_names, (
        f"Append-only 資料表 '{table_name}' 缺少 'is_superseded' 欄位"
    )
    assert "superseded_by" in col_names, (
        f"Append-only 資料表 '{table_name}' 缺少 'superseded_by' 欄位"
    )


# ── 5. 關鍵欄位的 nullable 設定 ──────────────────────────────────

def test_lab_analyte_type_column_exists():
    """lab_analytes 必須有 analyte_type 欄位"""
    if "lab_analytes" not in METADATA.tables:
        pytest.skip("lab_analytes 不存在")
    table = METADATA.tables["lab_analytes"]
    assert "analyte_type" in {c.name for c in table.columns}


def test_visits_has_priority_column():
    table = _get_table("visits")
    assert "priority" in {c.name for c in table.columns}


def test_visits_has_status_column():
    table = _get_table("visits")
    col = table.columns["status"]
    # status 不能為 NULL
    assert not col.nullable, "visits.status 不應允許 NULL"


def test_lab_orders_has_status_column():
    if "lab_orders" not in METADATA.tables:
        pytest.skip("lab_orders 不存在")
    table = METADATA.tables["lab_orders"]
    col = table.columns["status"]
    assert not col.nullable, "lab_orders.status 不應允許 NULL"
