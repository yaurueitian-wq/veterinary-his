"""assistant tables

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-07
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assistant_sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("clinic_id", sa.Integer, sa.ForeignKey("clinics.id"), nullable=False),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("ended_at", sa.TIMESTAMP(timezone=True)),
    )
    op.create_index("assistant_sessions_user_idx", "assistant_sessions", ["user_id"])
    op.create_index("assistant_sessions_clinic_idx", "assistant_sessions", ["clinic_id"])

    op.create_table(
        "assistant_messages",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("session_id", sa.Integer, sa.ForeignKey("assistant_sessions.id"), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("tools_called", sa.JSON),   # LLM 呼叫了哪些工具
        sa.Column("data_accessed", sa.JSON),  # 工具實際回傳的摘要
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.CheckConstraint("role IN ('user', 'assistant')", name="ck_assistant_messages_role"),
    )
    op.create_index("assistant_messages_session_idx", "assistant_messages", ["session_id"])

    op.create_table(
        "assistant_risk_flags",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("message_id", sa.Integer, sa.ForeignKey("assistant_messages.id"), nullable=False),
        sa.Column("flag_type", sa.String(50), nullable=False),
        sa.Column("detail", sa.Text),
        sa.Column("flagged_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("reviewed_by", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("reviewed_at", sa.TIMESTAMP(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("assistant_risk_flags")
    op.drop_index("assistant_messages_session_idx", "assistant_messages")
    op.drop_table("assistant_messages")
    op.drop_index("assistant_sessions_clinic_idx", "assistant_sessions")
    op.drop_index("assistant_sessions_user_idx", "assistant_sessions")
    op.drop_table("assistant_sessions")
