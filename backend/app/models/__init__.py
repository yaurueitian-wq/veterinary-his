# 匯入所有 model，確保它們在 Base.metadata 中被註冊
# alembic/env.py 也會匯入此 package 以支援 autogenerate
from app.models import foundation, catalogs, owners, visits, clinical  # noqa: F401
