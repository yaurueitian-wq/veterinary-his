"""diagnosis_codes: add source_ref column

Revision ID: 0011
Revises: 0010
Create Date: 2026-03-12

ADR-020: 外部匯入型 catalog 條目需追蹤資料來源。
source_ref 為可選欄位，NULL 代表內部自訂，有值代表匯入來源（版本標記或 URL）。
"""

from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "diagnosis_codes",
        sa.Column("source_ref", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("diagnosis_codes", "source_ref")
