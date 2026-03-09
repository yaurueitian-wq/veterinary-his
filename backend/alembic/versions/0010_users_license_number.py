"""users.license_number

新增獸醫師執照字號欄位至 users 表，供病歷合規顯示使用。
（動物診療業管理辦法第 22 條）

Revision ID: 0010
Revises: 0009
Create Date: 2026-03-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("license_number", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "license_number")
