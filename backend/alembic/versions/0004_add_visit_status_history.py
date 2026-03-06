"""add visit_status_history table (ADR-012)

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-06
"""
from typing import Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE visit_status_history (
            id          SERIAL PRIMARY KEY,
            visit_id    INTEGER NOT NULL REFERENCES visits(id),
            from_status VARCHAR(30),
            to_status   VARCHAR(30) NOT NULL,
            changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            changed_by  INTEGER REFERENCES users(id)
        );

        CREATE INDEX ix_visit_status_history_visit_changed
            ON visit_status_history (visit_id, changed_at);
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS ix_visit_status_history_visit_changed;
        DROP TABLE IF EXISTS visit_status_history;
    """)
