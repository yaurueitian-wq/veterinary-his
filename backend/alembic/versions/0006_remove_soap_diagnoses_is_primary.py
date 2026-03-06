"""remove is_primary from soap_diagnoses

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-06
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        -- M2 index was only in SCHEMA.md design but never applied to DB; drop defensively
        DROP INDEX IF EXISTS soap_diagnoses_primary_idx;

        -- 移除主/副診斷欄位；MVP 診斷為平等列表
        ALTER TABLE soap_diagnoses DROP COLUMN IF EXISTS is_primary;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE soap_diagnoses
          ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;
    """)
