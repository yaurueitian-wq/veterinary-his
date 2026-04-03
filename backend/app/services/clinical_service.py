"""
臨床記錄 Service 層

檢驗結果提交（跨表 + supersede 邏輯）和取消醫囑的業務規則。
"""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import LabOrderStatus as LOS
from app.models.clinical import LabOrder, LabResultItem


class LabOrderNotFoundError(Exception):
    """檢驗醫囑不存在"""


class LabOrderCancelledError(Exception):
    """已取消的醫囑無法操作"""


class LabOrderAlreadyResultedError(Exception):
    """已有結果的醫囑無法取消"""


def submit_lab_results(
    *,
    order: LabOrder,
    items: list[dict],
    user_id: int,
    db: Session,
) -> list[LabResultItem]:
    """
    提交檢驗結果：
    1. 驗證 order 狀態
    2. 舊的同 analyte 結果 → is_superseded=True
    3. 批次 INSERT 新結果
    4. order status → resulted
    """
    if order.status == LOS.CANCELLED:
        raise LabOrderCancelledError("已取消的醫囑無法填入結果")

    # 舊的同 analyte → supersede
    analyte_ids = [item["analyte_id"] for item in items]
    if analyte_ids:
        for old_ri in db.execute(
            select(LabResultItem).where(
                LabResultItem.lab_order_id == order.id,
                LabResultItem.analyte_id.in_(analyte_ids),
                LabResultItem.is_superseded.is_(False),
            )
        ).scalars():
            old_ri.is_superseded = True

    # 批次 INSERT
    new_items: list[LabResultItem] = []
    for item in items:
        ri = LabResultItem(
            lab_order_id=order.id,
            analyte_id=item["analyte_id"],
            value_numeric=item.get("value_numeric"),
            value_text=item.get("value_text"),
            is_abnormal=item.get("is_abnormal"),
            notes=item.get("notes"),
            created_by=user_id,
        )
        db.add(ri)
        new_items.append(ri)

    # order → resulted
    order.status = LOS.RESULTED
    order.resulted_at = datetime.now(timezone.utc)
    order.resulted_by = user_id

    db.commit()
    for ri in new_items:
        db.refresh(ri)
    db.refresh(order)
    return new_items


def cancel_lab_order(
    *,
    order: LabOrder,
    db: Session,
) -> LabOrder:
    """
    取消檢驗醫囑：
    1. 驗證狀態（不能已取消、不能已有結果）
    2. status → cancelled
    """
    if order.status == LOS.CANCELLED:
        raise LabOrderCancelledError("此醫囑已取消")
    if order.status == LOS.RESULTED:
        raise LabOrderAlreadyResultedError("已有結果的醫囑無法取消")

    order.status = LOS.CANCELLED
    db.commit()
    db.refresh(order)
    return order
