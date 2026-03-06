"""add admitted_at to visits

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-07

就診狀態時間戳記補充：
  visits.admitted_at — 轉入住院的時間點，status → 'admitted' 時寫入
  (completed_at 已存在，此 migration 僅新增 admitted_at)
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    ALTER TABLE visits
      ADD COLUMN IF NOT EXISTS admitted_at TIMESTAMPTZ;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE visits DROP COLUMN IF EXISTS admitted_at;")
