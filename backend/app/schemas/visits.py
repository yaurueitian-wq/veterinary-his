from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


# ── 建立掛號 ──────────────────────────────────────────────

class VisitCreate(BaseModel):
    animal_id: int
    chief_complaint: str
    priority: Literal["normal", "urgent"] = "normal"


# ── 更新掛號（狀態轉換 / 優先度 / 負責獸醫） ────────────────

class VisitUpdate(BaseModel):
    status: Optional[
        Literal[
            "registered",
            "triaged",
            "in_consultation",
            "pending_results",
            "completed",
            "admitted",
            "cancelled",
        ]
    ] = None
    priority: Optional[Literal["normal", "urgent"]] = None
    attending_vet_id: Optional[int] = None
    chief_complaint: Optional[str] = None


# ── 清單項目（候診清單顯示用） ────────────────────────────────

class VisitListItem(BaseModel):
    id: int
    animal_id: Optional[int]
    animal_name: Optional[str]
    species_name: Optional[str]
    owner_id: Optional[int]
    owner_name: Optional[str]
    attending_vet_id: Optional[int]
    attending_vet_name: Optional[str]
    status: str
    priority: str
    chief_complaint: str
    is_emergency: bool
    registered_at: datetime

    model_config = {"from_attributes": True}


class VisitListResponse(BaseModel):
    items: list[VisitListItem]
    total: int
