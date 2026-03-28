"""insight_dismissals 表（流程探勘評估的「已知」標記）

Revision ID: 0015
Revises: 0014
"""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "insight_dismissals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("insight_key", sa.String(200), nullable=False, unique=True),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("insight_dismissals")
