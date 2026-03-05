"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-05

依據 SCHEMA.md 建立完整資料模型，執行順序依據表依賴圖。
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ============================================================
    # Foundation
    # ============================================================

    op.execute("""
    CREATE TABLE organizations (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(200) NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """)

    op.execute("""
    CREATE TABLE clinics (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      name             VARCHAR(200) NOT NULL,
      address          TEXT,
      phone            VARCHAR(50),
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """)

    op.execute("""
    CREATE TABLE role_definitions (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      role_key         VARCHAR(50) NOT NULL,
      display_name     VARCHAR(100) NOT NULL,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT role_definitions_unique UNIQUE (organization_id, role_key)
    )
    """)

    op.execute("""
    CREATE TABLE users (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      full_name        VARCHAR(200) NOT NULL,
      email            VARCHAR(200) NOT NULL,
      hashed_password  VARCHAR NOT NULL,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by       INTEGER REFERENCES users(id),
      CONSTRAINT users_email_org_unique UNIQUE (organization_id, email)
    )
    """)

    op.execute("""
    CREATE TABLE user_roles (
      id                   SERIAL PRIMARY KEY,
      user_id              INTEGER NOT NULL REFERENCES users(id),
      role_definition_id   INTEGER NOT NULL REFERENCES role_definitions(id),
      clinic_id            INTEGER REFERENCES clinics(id),
      granted_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      granted_by           INTEGER NOT NULL REFERENCES users(id),
      revoked_at           TIMESTAMPTZ
    )
    """)

    # PostgreSQL NULL 不視為相等，用 partial index 確保角色唯一性（ADR-007）
    op.execute("""
    CREATE UNIQUE INDEX user_roles_clinic_active_idx
      ON user_roles (user_id, role_definition_id, clinic_id)
      WHERE clinic_id IS NOT NULL AND revoked_at IS NULL
    """)

    op.execute("""
    CREATE UNIQUE INDEX user_roles_org_active_idx
      ON user_roles (user_id, role_definition_id)
      WHERE clinic_id IS NULL AND revoked_at IS NULL
    """)

    # ============================================================
    # Reference Catalogs
    # ============================================================

    op.execute("""
    CREATE TABLE contact_types (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      type_key         VARCHAR(30) NOT NULL,
      display_name     VARCHAR(50) NOT NULL,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT contact_types_unique UNIQUE (organization_id, type_key)
    )
    """)

    op.execute("""
    CREATE TABLE species (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      name             VARCHAR(100) NOT NULL,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT species_name_unique UNIQUE (organization_id, name)
    )
    """)

    op.execute("""
    CREATE TABLE breeds (
      id          SERIAL PRIMARY KEY,
      species_id  INTEGER NOT NULL REFERENCES species(id),
      name        VARCHAR(100) NOT NULL,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT breeds_name_unique UNIQUE (species_id, name)
    )
    """)

    op.execute("""
    CREATE TABLE mucous_membrane_colors (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      name             VARCHAR(50) NOT NULL,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE
    )
    """)

    op.execute("""
    CREATE TABLE lab_categories (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      name             VARCHAR(100) NOT NULL,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE
    )
    """)

    op.execute("""
    CREATE TABLE lab_test_types (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      lab_category_id  INTEGER NOT NULL REFERENCES lab_categories(id),
      name             VARCHAR(200) NOT NULL,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE
    )
    """)

    op.execute("""
    CREATE TABLE diagnosis_categories (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      name             VARCHAR(100) NOT NULL,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT diagnosis_categories_unique UNIQUE (organization_id, name)
    )
    """)

    op.execute("""
    CREATE TABLE diagnosis_codes (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      code             VARCHAR(50),
      name             VARCHAR(200) NOT NULL,
      coding_system    VARCHAR(30),
      CONSTRAINT diagnosis_coding_system_check
        CHECK (coding_system IN ('internal', 'venomcode', 'snomed') OR coding_system IS NULL),
      category_id      INTEGER REFERENCES diagnosis_categories(id),
      species_id       INTEGER REFERENCES species(id),
      is_active        BOOLEAN NOT NULL DEFAULT TRUE
    )
    """)

    # ============================================================
    # 模組一：飼主 & 動物建檔
    # ============================================================

    op.execute("""
    CREATE TABLE owners (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      full_name        VARCHAR(200) NOT NULL,
      national_id      VARCHAR(20),
      notes            TEXT,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by       INTEGER NOT NULL REFERENCES users(id)
    )
    """)

    # national_id 有值時才需唯一（ADR-009）
    op.execute("""
    CREATE UNIQUE INDEX owners_national_id_idx
      ON owners (organization_id, national_id)
      WHERE national_id IS NOT NULL
    """)

    op.execute("""
    CREATE TABLE owner_contacts (
      id               SERIAL PRIMARY KEY,
      owner_id         INTEGER NOT NULL REFERENCES owners(id),
      contact_type_id  INTEGER NOT NULL REFERENCES contact_types(id),
      value            VARCHAR(200) NOT NULL,
      label            VARCHAR(20) NOT NULL DEFAULT 'personal'
        CHECK (label IN ('personal', 'work', 'other')),
      is_primary       BOOLEAN NOT NULL DEFAULT FALSE,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by       INTEGER NOT NULL REFERENCES users(id)
    )
    """)

    op.execute("""
    CREATE TABLE owner_addresses (
      id           SERIAL PRIMARY KEY,
      owner_id     INTEGER NOT NULL REFERENCES owners(id),
      label        VARCHAR(20) NOT NULL DEFAULT 'home'
        CHECK (label IN ('home', 'work', 'other')),
      postal_code  VARCHAR(10),
      county       VARCHAR(50) NOT NULL,
      district     VARCHAR(50),
      street       VARCHAR(200),
      detail       VARCHAR(100),
      is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
      is_active    BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by   INTEGER NOT NULL REFERENCES users(id)
    )
    """)

    op.execute("""
    CREATE TABLE animals (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      owner_id         INTEGER NOT NULL REFERENCES owners(id),
      name             VARCHAR(100) NOT NULL,
      species_id       INTEGER NOT NULL REFERENCES species(id),
      breed_id         INTEGER REFERENCES breeds(id),
      sex              VARCHAR(20) NOT NULL
        CHECK (sex IN ('intact_male', 'intact_female', 'neutered_male', 'neutered_female', 'unknown')),
      date_of_birth    DATE,
      birth_year       SMALLINT,
      microchip_number VARCHAR(20),
      tag_number       VARCHAR(50),
      tattoo_number    VARCHAR(50),
      color            VARCHAR(100),
      is_deceased      BOOLEAN NOT NULL DEFAULT FALSE,
      deceased_date    DATE,
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by       INTEGER NOT NULL REFERENCES users(id)
    )
    """)

    # 晶片號碼唯一（有值時）（ADR-009）
    op.execute("""
    CREATE UNIQUE INDEX animals_microchip_idx
      ON animals (organization_id, microchip_number)
      WHERE microchip_number IS NOT NULL
    """)

    # ============================================================
    # 模組二：掛號 & 候診
    # ============================================================

    op.execute("""
    CREATE TABLE visits (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      clinic_id        INTEGER NOT NULL REFERENCES clinics(id),
      animal_id        INTEGER REFERENCES animals(id),
      owner_id         INTEGER REFERENCES owners(id),
      attending_vet_id INTEGER REFERENCES users(id),
      status           VARCHAR(30) NOT NULL DEFAULT 'registered'
        CHECK (status IN (
          'registered', 'triaged', 'in_consultation',
          'pending_results', 'completed', 'admitted', 'cancelled'
        )),
      priority         VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('normal', 'urgent')),
      chief_complaint  TEXT NOT NULL,
      is_emergency     BOOLEAN NOT NULL DEFAULT FALSE,
      registered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at     TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by       INTEGER NOT NULL REFERENCES users(id)
    )
    """)

    # ============================================================
    # 模組三：門診
    # ============================================================

    op.execute("""
    CREATE TABLE vital_signs (
      id                         SERIAL PRIMARY KEY,
      visit_id                   INTEGER NOT NULL REFERENCES visits(id),
      weight_kg                  NUMERIC(6,3),
      temperature_c              NUMERIC(4,2),
      heart_rate_bpm             SMALLINT,
      respiratory_rate_bpm       SMALLINT,
      systolic_bp_mmhg           SMALLINT,
      capillary_refill_sec       NUMERIC(3,1),
      mucous_membrane_color_id   INTEGER REFERENCES mucous_membrane_colors(id),
      body_condition_score       SMALLINT
        CHECK (body_condition_score BETWEEN 1 AND 9),
      is_superseded              BOOLEAN NOT NULL DEFAULT FALSE,
      superseded_by              INTEGER REFERENCES vital_signs(id),
      created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by                 INTEGER NOT NULL REFERENCES users(id)
    )
    """)

    op.execute("""
    CREATE TABLE soap_notes (
      id              SERIAL PRIMARY KEY,
      visit_id        INTEGER NOT NULL REFERENCES visits(id),
      subjective      TEXT,
      objective       TEXT,
      assessment      TEXT,
      plan            TEXT,
      is_superseded   BOOLEAN NOT NULL DEFAULT FALSE,
      superseded_by   INTEGER REFERENCES soap_notes(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by      INTEGER NOT NULL REFERENCES users(id)
    )
    """)

    op.execute("""
    CREATE TABLE soap_diagnoses (
      id            SERIAL PRIMARY KEY,
      soap_note_id  INTEGER NOT NULL REFERENCES soap_notes(id),
      code_id       INTEGER REFERENCES diagnosis_codes(id),
      free_text     VARCHAR(500),
      CONSTRAINT soap_diagnoses_code_or_text
        CHECK (code_id IS NOT NULL OR free_text IS NOT NULL),
      is_primary    BOOLEAN NOT NULL DEFAULT TRUE,
      is_superseded BOOLEAN NOT NULL DEFAULT FALSE,
      superseded_by INTEGER REFERENCES soap_diagnoses(id),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by    INTEGER NOT NULL REFERENCES users(id)
    )
    """)

    op.execute("""
    CREATE TABLE nursing_notes (
      id            SERIAL PRIMARY KEY,
      visit_id      INTEGER NOT NULL REFERENCES visits(id),
      note_text     TEXT NOT NULL,
      is_superseded BOOLEAN NOT NULL DEFAULT FALSE,
      superseded_by INTEGER REFERENCES nursing_notes(id),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by    INTEGER NOT NULL REFERENCES users(id)
    )
    """)

    # ============================================================
    # 模組四：檢驗
    # ============================================================

    op.execute("""
    CREATE TABLE lab_orders (
      id              SERIAL PRIMARY KEY,
      visit_id        INTEGER NOT NULL REFERENCES visits(id),
      clinic_id       INTEGER NOT NULL REFERENCES clinics(id),
      organization_id INTEGER NOT NULL REFERENCES organizations(id),
      test_type_id    INTEGER NOT NULL REFERENCES lab_test_types(id),
      ordered_by      INTEGER NOT NULL REFERENCES users(id),
      status          VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'resulted', 'cancelled')),
      result_text     TEXT,
      resulted_at     TIMESTAMPTZ,
      resulted_by     INTEGER REFERENCES users(id),
      notes           TEXT,
      is_superseded   BOOLEAN NOT NULL DEFAULT FALSE,
      superseded_by   INTEGER REFERENCES lab_orders(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by      INTEGER NOT NULL REFERENCES users(id)
    )
    """)


def downgrade() -> None:
    # 依反向依賴順序刪除（CASCADE 確保 FK 安全）
    tables = [
        "lab_orders",
        "nursing_notes",
        "soap_diagnoses",
        "soap_notes",
        "vital_signs",
        "visits",
        "animals",
        "owner_addresses",
        "owner_contacts",
        "owners",
        "diagnosis_codes",
        "diagnosis_categories",
        "lab_test_types",
        "lab_categories",
        "mucous_membrane_colors",
        "breeds",
        "species",
        "contact_types",
        "user_roles",
        "users",
        "role_definitions",
        "clinics",
        "organizations",
    ]
    for table in tables:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
