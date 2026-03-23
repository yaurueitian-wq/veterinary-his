"""
集中定義業務常量（StrEnum）

DB 層維持 VARCHAR + CHECK 約束不變，
此模組僅供 Python 程式碼引用，提供型別安全與 IDE 自動補完。
"""
from enum import StrEnum


class VisitStatus(StrEnum):
    REGISTERED = "registered"
    TRIAGED = "triaged"
    IN_CONSULTATION = "in_consultation"
    PENDING_RESULTS = "pending_results"
    COMPLETED = "completed"
    ADMITTED = "admitted"
    CANCELLED = "cancelled"


class VisitPriority(StrEnum):
    NORMAL = "normal"
    URGENT = "urgent"


class LabOrderStatus(StrEnum):
    PENDING = "pending"
    RESULTED = "resulted"
    CANCELLED = "cancelled"
