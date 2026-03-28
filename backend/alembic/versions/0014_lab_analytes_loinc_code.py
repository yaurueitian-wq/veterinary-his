"""lab_analytes 加 loinc_code 欄位（ADR-025）

Revision ID: 0014
Revises: 0013
"""
from alembic import op
import sqlalchemy as sa

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lab_analytes", sa.Column(
        "loinc_code", sa.String(20), nullable=True,
    ))


def downgrade() -> None:
    op.drop_column("lab_analytes", "loinc_code")
