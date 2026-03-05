from typing import Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    # 登入時用 str，允許內部 .local 等非標準網域；嚴格 EmailStr 驗證留在使用者建立時
    email: str
    password: str
    # 可選：若有多個可存取分院，前端在選完分院後帶入
    clinic_id: Optional[int] = None


class ClinicInfo(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class UserInfo(BaseModel):
    id: int
    full_name: str
    email: str
    organization_id: int

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo
    # 使用者可存取的分院清單（供前端顯示分院選擇器）
    accessible_clinics: list[ClinicInfo]
    # 已選定的分院（None = 尚未選擇，admin 多分院時會是 None）
    active_clinic_id: Optional[int] = None
