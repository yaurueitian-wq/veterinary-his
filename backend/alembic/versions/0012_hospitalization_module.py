"""住院管理模組（ADR-023）

- visits 加 related_visit_id
- 10 張住院 catalog 表
- 12 張住院業務表（wards, beds, admissions, ...）

Revision ID: 0012
Revises: 0011
"""
from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── visits 加 related_visit_id ─────────────────────────────
    op.add_column("visits", sa.Column(
        "related_visit_id", sa.Integer(),
        sa.ForeignKey("visits.id"), nullable=True,
    ))

    # ── 住院 catalog 表 ───────────────────────────────────────

    op.create_table(
        "ward_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("organization_id", "name", name="ward_types_unique"),
    )

    op.create_table(
        "bed_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("organization_id", "name", name="bed_types_unique"),
    )

    op.create_table(
        "equipment_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("organization_id", "name", name="equipment_items_unique"),
    )

    op.create_table(
        "admission_reasons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("organization_id", "name", name="admission_reasons_unique"),
    )

    op.create_table(
        "nursing_action_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("organization_id", "name", name="nursing_action_items_unique"),
    )

    op.create_table(
        "order_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("organization_id", "name", name="order_types_unique"),
    )

    op.create_table(
        "frequencies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("organization_id", "code", name="frequencies_unique"),
    )

    op.create_table(
        "transfer_reasons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("organization_id", "name", name="transfer_reasons_unique"),
    )

    op.create_table(
        "discharge_reasons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("organization_id", "name", name="discharge_reasons_unique"),
    )

    op.create_table(
        "discharge_conditions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("organization_id", "name", name="discharge_conditions_unique"),
    )

    # ── 住院業務表 ─────────────────────────────────────────────

    op.create_table(
        "wards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("clinics.id"), nullable=False),
        sa.Column("ward_type_id", sa.Integer(), sa.ForeignKey("ward_types.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("clinic_id", "code", name="wards_unique"),
    )

    op.create_table(
        "beds",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ward_id", sa.Integer(), sa.ForeignKey("wards.id"), nullable=False),
        sa.Column("bed_type_id", sa.Integer(), sa.ForeignKey("bed_types.id"), nullable=False),
        sa.Column("bed_number", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'available'")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("status IN ('available', 'occupied', 'maintenance', 'inactive')", name="beds_status_check"),
        sa.UniqueConstraint("ward_id", "bed_number", name="beds_number_unique"),
    )

    op.create_table(
        "ward_default_equipment",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ward_id", sa.Integer(), sa.ForeignKey("wards.id"), nullable=False),
        sa.Column("equipment_item_id", sa.Integer(), sa.ForeignKey("equipment_items.id"), nullable=False),
        sa.UniqueConstraint("ward_id", "equipment_item_id", name="ward_default_equipment_unique"),
    )

    op.create_table(
        "admissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("clinics.id"), nullable=False),
        sa.Column("visit_id", sa.Integer(), sa.ForeignKey("visits.id"), nullable=False),
        sa.Column("bed_id", sa.Integer(), sa.ForeignKey("beds.id"), nullable=False),
        sa.Column("admission_reason_id", sa.Integer(), sa.ForeignKey("admission_reasons.id"), nullable=False),
        sa.Column("reason_notes", sa.Text(), nullable=True),
        sa.Column("attending_vet_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'active'")),
        sa.Column("admitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("discharged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.CheckConstraint("status IN ('active', 'discharged')", name="admissions_status_check"),
        sa.UniqueConstraint("visit_id", name="admissions_visit_unique"),
    )

    op.create_table(
        "admission_equipment",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("admission_id", sa.Integer(), sa.ForeignKey("admissions.id"), nullable=False),
        sa.Column("equipment_item_id", sa.Integer(), sa.ForeignKey("equipment_items.id"), nullable=False),
        sa.Column("notes", sa.String(200), nullable=True),
        sa.UniqueConstraint("admission_id", "equipment_item_id", name="admission_equipment_unique"),
    )

    op.create_table(
        "daily_rounds",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("admission_id", sa.Integer(), sa.ForeignKey("admissions.id"), nullable=False),
        sa.Column("round_date", sa.Date(), nullable=False),
        sa.Column("assessment", sa.Text(), nullable=True),
        sa.Column("plan", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_superseded", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("superseded_by", sa.Integer(), sa.ForeignKey("daily_rounds.id"), nullable=True),
    )

    op.create_table(
        "inpatient_nursing_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("admission_id", sa.Integer(), sa.ForeignKey("admissions.id"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_superseded", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("superseded_by", sa.Integer(), sa.ForeignKey("inpatient_nursing_logs.id"), nullable=True),
    )

    op.create_table(
        "inpatient_nursing_log_actions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nursing_log_id", sa.Integer(), sa.ForeignKey("inpatient_nursing_logs.id"), nullable=False),
        sa.Column("action_item_id", sa.Integer(), sa.ForeignKey("nursing_action_items.id"), nullable=False),
        sa.UniqueConstraint("nursing_log_id", "action_item_id", name="nursing_log_actions_unique"),
    )

    op.create_table(
        "inpatient_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("admission_id", sa.Integer(), sa.ForeignKey("admissions.id"), nullable=False),
        sa.Column("order_type_id", sa.Integer(), sa.ForeignKey("order_types.id"), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("frequency_id", sa.Integer(), sa.ForeignKey("frequencies.id"), nullable=True),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'active'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_superseded", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("superseded_by", sa.Integer(), sa.ForeignKey("inpatient_orders.id"), nullable=True),
        sa.CheckConstraint("status IN ('active', 'completed', 'cancelled')", name="inpatient_orders_status_check"),
    )

    op.create_table(
        "inpatient_order_executions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("inpatient_orders.id"), nullable=False),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
    )

    op.create_table(
        "bed_transfers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("admission_id", sa.Integer(), sa.ForeignKey("admissions.id"), nullable=False),
        sa.Column("from_bed_id", sa.Integer(), sa.ForeignKey("beds.id"), nullable=False),
        sa.Column("to_bed_id", sa.Integer(), sa.ForeignKey("beds.id"), nullable=False),
        sa.Column("reason_id", sa.Integer(), sa.ForeignKey("transfer_reasons.id"), nullable=False),
        sa.Column("reason_notes", sa.Text(), nullable=True),
        sa.Column("transferred_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("transferred_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
    )

    op.create_table(
        "discharge_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("admission_id", sa.Integer(), sa.ForeignKey("admissions.id"), nullable=False),
        sa.Column("discharge_reason_id", sa.Integer(), sa.ForeignKey("discharge_reasons.id"), nullable=False),
        sa.Column("discharge_condition_id", sa.Integer(), sa.ForeignKey("discharge_conditions.id"), nullable=False),
        sa.Column("discharge_notes", sa.Text(), nullable=True),
        sa.Column("follow_up_plan", sa.Text(), nullable=True),
        sa.Column("discharged_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("discharged_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.UniqueConstraint("admission_id", name="discharge_records_admission_unique"),
    )


def downgrade() -> None:
    op.drop_table("discharge_records")
    op.drop_table("bed_transfers")
    op.drop_table("inpatient_order_executions")
    op.drop_table("inpatient_orders")
    op.drop_table("inpatient_nursing_log_actions")
    op.drop_table("inpatient_nursing_logs")
    op.drop_table("daily_rounds")
    op.drop_table("admission_equipment")
    op.drop_table("admissions")
    op.drop_table("ward_default_equipment")
    op.drop_table("beds")
    op.drop_table("wards")
    op.drop_table("discharge_conditions")
    op.drop_table("discharge_reasons")
    op.drop_table("transfer_reasons")
    op.drop_table("frequencies")
    op.drop_table("order_types")
    op.drop_table("nursing_action_items")
    op.drop_table("admission_reasons")
    op.drop_table("equipment_items")
    op.drop_table("bed_types")
    op.drop_table("ward_types")
    op.drop_column("visits", "related_visit_id")
