"""remove visits.is_emergency

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-06
"""
from typing import Union

from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE visits DROP COLUMN IF EXISTS is_emergency;")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE visits ADD COLUMN IF NOT EXISTS"
        " is_emergency BOOLEAN NOT NULL DEFAULT FALSE;"
    )
