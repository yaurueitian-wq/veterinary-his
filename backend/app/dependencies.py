"""
FastAPI 共用 dependency：
  get_current_user  → 驗證 JWT，回傳 User ORM 物件
  get_token_data    → 回傳 JWT payload（dict）
  require_roles     → factory，產生「需要指定角色才能存取」的 dependency
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.auth import decode_token
from app.database import get_db
from app.models.foundation import User

# tokenUrl 指向登入端點（Swagger Authorize 按鈕使用）
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_token_data(token: str = Depends(oauth2_scheme)) -> dict:
    """解析 JWT，回傳 payload dict"""
    try:
        return decode_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無效的認證憑證",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    token_data: dict = Depends(get_token_data),
    db: Session = Depends(get_db),
) -> User:
    """從 JWT 取出 user_id，查詢 DB 確認使用者仍有效"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="無效的認證憑證",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        user_id = int(token_data.get("sub", 0))
    except (ValueError, TypeError):
        raise credentials_exception

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise credentials_exception
    return user


def require_roles(*role_keys: str):
    """
    用法：
        @router.get("/...", dependencies=[Depends(require_roles("vet", "nurse"))])
        或
        current_user = Depends(require_roles("admin"))

    邏輯：token 的 roles 清單中，至少有一個符合 role_keys 才放行。
    """
    def dependency(
        token_data: dict = Depends(get_token_data),
        current_user: User = Depends(get_current_user),
    ) -> User:
        user_roles: list[str] = token_data.get("roles", [])
        if not any(r in user_roles for r in role_keys):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"需要角色：{' 或 '.join(role_keys)}",
            )
        return current_user

    return dependency
