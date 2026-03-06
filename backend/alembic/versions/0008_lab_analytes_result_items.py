"""lab_analytes, lab_analyte_references, lab_result_items; drop result_text

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-06
"""
from typing import Union

from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE lab_analytes (
            id               SERIAL PRIMARY KEY,
            organization_id  INTEGER NOT NULL REFERENCES organizations(id),
            lab_test_type_id INTEGER NOT NULL REFERENCES lab_test_types(id),
            name             VARCHAR(100) NOT NULL,
            unit             VARCHAR(30),
            analyte_type     VARCHAR(10) NOT NULL DEFAULT 'numeric'
                CHECK (analyte_type IN ('numeric', 'text')),
            sort_order       SMALLINT NOT NULL DEFAULT 0,
            is_active        BOOLEAN NOT NULL DEFAULT TRUE,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT lab_analytes_unique UNIQUE (lab_test_type_id, name)
        );

        CREATE TABLE lab_analyte_references (
            id          SERIAL PRIMARY KEY,
            analyte_id  INTEGER NOT NULL REFERENCES lab_analytes(id),
            species_id  INTEGER REFERENCES species(id),
            ref_low     NUMERIC(12,4),
            ref_high    NUMERIC(12,4),
            ref_text    VARCHAR(100),
            CONSTRAINT lab_analyte_references_unique UNIQUE (analyte_id, species_id)
        );

        CREATE TABLE lab_result_items (
            id             SERIAL PRIMARY KEY,
            lab_order_id   INTEGER NOT NULL REFERENCES lab_orders(id),
            analyte_id     INTEGER NOT NULL REFERENCES lab_analytes(id),
            value_numeric  NUMERIC(12,4),
            value_text     VARCHAR(200),
            is_abnormal    BOOLEAN,
            notes          TEXT,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by     INTEGER NOT NULL REFERENCES users(id),
            is_superseded  BOOLEAN NOT NULL DEFAULT FALSE,
            superseded_by  INTEGER REFERENCES lab_result_items(id),
            CONSTRAINT lab_result_items_unique UNIQUE (lab_order_id, analyte_id)
        );

        ALTER TABLE lab_orders DROP COLUMN IF EXISTS result_text;

        CREATE INDEX lab_analytes_test_type_idx ON lab_analytes (lab_test_type_id);
        CREATE INDEX lab_result_items_order_idx ON lab_result_items (lab_order_id);
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS lab_result_items_order_idx;
        DROP INDEX IF EXISTS lab_analytes_test_type_idx;
        DROP TABLE IF EXISTS lab_result_items;
        DROP TABLE IF EXISTS lab_analyte_references;
        DROP TABLE IF EXISTS lab_analytes;
        ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS result_text TEXT;
    """)
