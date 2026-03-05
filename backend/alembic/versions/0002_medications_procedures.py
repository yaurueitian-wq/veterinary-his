"""medications and procedures schema

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-06

新增用藥與手術/處置相關表格：
  目錄表：administration_routes, medication_categories, medications,
          procedure_categories, procedure_types
  業務表：prescription_orders, medication_administrations, procedure_records
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ============================================================
    # 目錄表
    # ============================================================

    op.execute("""
    CREATE TABLE administration_routes (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      name             VARCHAR(50) NOT NULL,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT administration_routes_unique UNIQUE (organization_id, name)
    )
    """)

    op.execute("""
    CREATE TABLE medication_categories (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      name             VARCHAR(100) NOT NULL,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT medication_categories_unique UNIQUE (organization_id, name)
    )
    """)

    op.execute("""
    CREATE TABLE medications (
      id                      SERIAL PRIMARY KEY,
      organization_id         INTEGER NOT NULL REFERENCES organizations(id),
      medication_category_id  INTEGER REFERENCES medication_categories(id),
      name                    VARCHAR(200) NOT NULL,
      default_dose_unit       VARCHAR(30),
      is_active               BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT medications_unique UNIQUE (organization_id, name)
    )
    """)

    op.execute("""
    CREATE TABLE procedure_categories (
      id               SERIAL PRIMARY KEY,
      organization_id  INTEGER NOT NULL REFERENCES organizations(id),
      name             VARCHAR(100) NOT NULL,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT procedure_categories_unique UNIQUE (organization_id, name)
    )
    """)

    op.execute("""
    CREATE TABLE procedure_types (
      id                     SERIAL PRIMARY KEY,
      organization_id        INTEGER NOT NULL REFERENCES organizations(id),
      procedure_category_id  INTEGER REFERENCES procedure_categories(id),
      name                   VARCHAR(200) NOT NULL,
      species_id             INTEGER REFERENCES species(id),
      is_active              BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT procedure_types_unique UNIQUE (organization_id, name)
    )
    """)

    # ============================================================
    # 業務紀錄表（append-only）
    # ============================================================

    op.execute("""
    CREATE TABLE prescription_orders (
      id                       SERIAL PRIMARY KEY,
      soap_note_id             INTEGER NOT NULL REFERENCES soap_notes(id),
      medication_id            INTEGER REFERENCES medications(id),
      free_text                VARCHAR(500),
      CONSTRAINT prescription_orders_med_or_text
        CHECK (medication_id IS NOT NULL OR free_text IS NOT NULL),
      dose                     NUMERIC(8,3),
      dose_unit                VARCHAR(30),
      administration_route_id  INTEGER REFERENCES administration_routes(id),
      frequency                VARCHAR(50),
      duration_days            SMALLINT,
      instructions             TEXT,
      is_superseded            BOOLEAN NOT NULL DEFAULT FALSE,
      superseded_by            INTEGER REFERENCES prescription_orders(id),
      created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by               INTEGER NOT NULL REFERENCES users(id)
    )
    """)

    op.execute("""
    CREATE TABLE medication_administrations (
      id                       SERIAL PRIMARY KEY,
      soap_note_id             INTEGER NOT NULL REFERENCES soap_notes(id),
      prescription_order_id    INTEGER REFERENCES prescription_orders(id),
      medication_id            INTEGER REFERENCES medications(id),
      free_text                VARCHAR(500),
      CONSTRAINT medication_administrations_med_or_text
        CHECK (medication_id IS NOT NULL OR free_text IS NOT NULL),
      dose                     NUMERIC(8,3),
      dose_unit                VARCHAR(30),
      administration_route_id  INTEGER REFERENCES administration_routes(id),
      administered_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      is_superseded            BOOLEAN NOT NULL DEFAULT FALSE,
      superseded_by            INTEGER REFERENCES medication_administrations(id),
      created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by               INTEGER NOT NULL REFERENCES users(id)
    )
    """)

    op.execute("""
    CREATE TABLE procedure_records (
      id                   SERIAL PRIMARY KEY,
      soap_note_id         INTEGER NOT NULL REFERENCES soap_notes(id),
      procedure_type_id    INTEGER REFERENCES procedure_types(id),
      free_text            VARCHAR(500),
      CONSTRAINT procedure_records_type_or_text
        CHECK (procedure_type_id IS NOT NULL OR free_text IS NOT NULL),
      notes                TEXT,
      is_superseded        BOOLEAN NOT NULL DEFAULT FALSE,
      superseded_by        INTEGER REFERENCES procedure_records(id),
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by           INTEGER NOT NULL REFERENCES users(id)
    )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS procedure_records")
    op.execute("DROP TABLE IF EXISTS medication_administrations")
    op.execute("DROP TABLE IF EXISTS prescription_orders")
    op.execute("DROP TABLE IF EXISTS procedure_types")
    op.execute("DROP TABLE IF EXISTS procedure_categories")
    op.execute("DROP TABLE IF EXISTS medications")
    op.execute("DROP TABLE IF EXISTS medication_categories")
    op.execute("DROP TABLE IF EXISTS administration_routes")
