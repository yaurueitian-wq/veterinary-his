"""animals health background: blood_types, animal_diseases, animal_medications

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-07
"""
from typing import Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        -- 1. blood_types（物種特定血型目錄，無 organization_id，類似 breeds）
        CREATE TABLE blood_types (
            id           SERIAL PRIMARY KEY,
            species_id   INTEGER NOT NULL REFERENCES species(id),
            code         VARCHAR(20) NOT NULL,
            display_name VARCHAR(100) NOT NULL,
            is_active    BOOLEAN NOT NULL DEFAULT TRUE,
            CONSTRAINT blood_types_unique UNIQUE (species_id, code)
        );

        -- 2. animals 新欄位
        ALTER TABLE animals ADD COLUMN blood_type_id  INTEGER REFERENCES blood_types(id);
        ALTER TABLE animals ADD COLUMN general_info   TEXT;
        ALTER TABLE animals ADD COLUMN critical_info  TEXT;
        ALTER TABLE animals ADD COLUMN neutered_date  DATE;

        -- 3. animal_diseases（慢性病/過敏史，動物層級，非就診掛鉤）
        CREATE TABLE animal_diseases (
            id                SERIAL PRIMARY KEY,
            animal_id         INTEGER NOT NULL REFERENCES animals(id),
            organization_id   INTEGER NOT NULL REFERENCES organizations(id),
            diagnosis_code_id INTEGER REFERENCES diagnosis_codes(id),
            free_text         VARCHAR(500),
            CONSTRAINT animal_diseases_code_or_text
                CHECK (diagnosis_code_id IS NOT NULL OR free_text IS NOT NULL),
            is_allergy        BOOLEAN NOT NULL DEFAULT FALSE,
            status            VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'resolved', 'chronic', 'in_remission')),
            onset_date        DATE,
            notes             TEXT,
            is_active         BOOLEAN NOT NULL DEFAULT TRUE,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by        INTEGER NOT NULL REFERENCES users(id)
        );

        CREATE INDEX animal_diseases_animal_idx ON animal_diseases (animal_id);

        -- 4. animal_medications（長期維持用藥，動物層級，非就診掛鉤）
        CREATE TABLE animal_medications (
            id                      SERIAL PRIMARY KEY,
            animal_id               INTEGER NOT NULL REFERENCES animals(id),
            organization_id         INTEGER NOT NULL REFERENCES organizations(id),
            medication_id           INTEGER REFERENCES medications(id),
            free_text               VARCHAR(500),
            CONSTRAINT animal_medications_med_or_text
                CHECK (medication_id IS NOT NULL OR free_text IS NOT NULL),
            dose                    NUMERIC(8,3),
            dose_unit               VARCHAR(30),
            administration_route_id INTEGER REFERENCES administration_routes(id),
            frequency               VARCHAR(50),
            start_date              DATE,
            end_date                DATE,
            notes                   TEXT,
            is_active               BOOLEAN NOT NULL DEFAULT TRUE,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by              INTEGER NOT NULL REFERENCES users(id)
        );

        CREATE INDEX animal_medications_animal_idx ON animal_medications (animal_id);
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS animal_medications_animal_idx;
        DROP TABLE IF EXISTS animal_medications;
        DROP INDEX IF EXISTS animal_diseases_animal_idx;
        DROP TABLE IF EXISTS animal_diseases;
        ALTER TABLE animals DROP COLUMN IF EXISTS neutered_date;
        ALTER TABLE animals DROP COLUMN IF EXISTS critical_info;
        ALTER TABLE animals DROP COLUMN IF EXISTS general_info;
        ALTER TABLE animals DROP COLUMN IF EXISTS blood_type_id;
        DROP TABLE IF EXISTS blood_types;
    """)
