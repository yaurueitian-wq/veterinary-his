from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import create_access_token, verify_password
from app.database import get_db
from app.dependencies import get_current_user
from app.models.catalogs import Species  # noqa: F401（確保 model 已載入）
from app.models.foundation import Clinic, RoleDefinition, User, UserRole
from app.schemas.auth import ClinicInfo, LoginRequest, TokenResponse, UserInfo

router = APIRouter(prefix="/auth", tags=["認證"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    登入流程（ADR-007）：
    1. 驗證帳號密碼
    2. 查詢可存取分院清單
    3. 若只有一個分院 → 自動選擇；多個分院 → 回傳清單讓前端選擇
    4. 若 request.clinic_id 已帶入 → 驗證後直接選定
    5. 回傳 JWT（含 active_clinic_id + roles）
    """
    # 1. 驗證帳號密碼
    user = db.execute(
        select(User).where(
            User.email == request.email,
            User.is_active.is_(True),
        )
    ).scalar_one_or_none()

    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="電子郵件或密碼錯誤",
        )

    # 2. 查詢有效角色（revoked_at IS NULL）
    role_rows = db.execute(
        select(UserRole, RoleDefinition)
        .join(RoleDefinition, UserRole.role_definition_id == RoleDefinition.id)
        .where(
            UserRole.user_id == user.id,
            UserRole.revoked_at.is_(None),
        )
    ).all()

    # clinic_id → [role_key, ...]（None key = 全集團授權）
    clinic_role_map: dict[Optional[int], list[str]] = {}
    for user_role, role_def in role_rows:
        clinic_role_map.setdefault(user_role.clinic_id, []).append(role_def.role_key)

    if not clinic_role_map:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="此帳號尚未被指派任何角色",
        )

    # 3. 取得可存取的分院清單
    has_org_wide = None in clinic_role_map
    if has_org_wide:
        # 全集團授權（admin）→ 所有有效分院
        clinics = db.execute(
            select(Clinic).where(
                Clinic.organization_id == user.organization_id,
                Clinic.is_active.is_(True),
            )
        ).scalars().all()
    else:
        specific_ids = [cid for cid in clinic_role_map if cid is not None]
        clinics = db.execute(
            select(Clinic).where(
                Clinic.id.in_(specific_ids),
                Clinic.is_active.is_(True),
            )
        ).scalars().all()

    accessible_clinics = [ClinicInfo.model_validate(c) for c in clinics]

    # 4. 確定 active_clinic_id
    valid_ids = {c.id for c in clinics}

    if request.clinic_id is not None:
        if request.clinic_id not in valid_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="無此分院的存取權限",
            )
        active_clinic_id: Optional[int] = request.clinic_id
    elif len(accessible_clinics) == 1:
        # 只有一個分院 → 自動選擇
        active_clinic_id = accessible_clinics[0].id
    else:
        # 多個分院，前端需要再帶 clinic_id 重新呼叫
        active_clinic_id = None

    # 5. 組成 roles 清單（特定分院角色 + 全集團角色）
    roles: list[str] = []
    if active_clinic_id is not None:
        roles += clinic_role_map.get(active_clinic_id, [])
    roles += clinic_role_map.get(None, [])  # org-wide roles 永遠加入
    roles = list(dict.fromkeys(roles))  # 去重，保留順序

    # 6. 簽發 JWT
    token = create_access_token(
        {
            "sub": str(user.id),
            "org_id": user.organization_id,
            "clinic_id": active_clinic_id,
            "roles": roles,
        }
    )

    return TokenResponse(
        access_token=token,
        user=UserInfo.model_validate(user),
        accessible_clinics=accessible_clinics,
        active_clinic_id=active_clinic_id,
    )


@router.get("/me", response_model=UserInfo)
def get_me(current_user: User = Depends(get_current_user)):
    """回傳目前登入的使用者資訊"""
    return UserInfo.model_validate(current_user)
