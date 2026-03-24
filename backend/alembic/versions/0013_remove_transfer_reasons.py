"""移除 transfer_reasons 表和 bed_transfers.reason_id

轉移方向本身即原因，不需要額外記錄。

Revision ID: 0013
Revises: 0012
"""
from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("bed_transfers_reason_id_fkey", "bed_transfers", type_="foreignkey")
    op.drop_column("bed_transfers", "reason_id")
    op.drop_column("bed_transfers", "reason_notes")
    op.drop_table("transfer_reasons")


def downgrade() -> None:
    op.create_table(
        "transfer_reasons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("organization_id", "name", name="transfer_reasons_unique"),
    )
    op.add_column("bed_transfers", sa.Column("reason_notes", sa.Text(), nullable=True))
    op.add_column("bed_transfers", sa.Column("reason_id", sa.Integer(), nullable=True))
    op.create_foreign_key("bed_transfers_reason_id_fkey", "bed_transfers", "transfer_reasons", ["reason_id"], ["id"])
