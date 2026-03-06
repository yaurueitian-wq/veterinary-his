"""
測試環境設定

在匯入任何 app 模組前，先設定必要的環境變數，
讓 pydantic-settings 的 Settings() 不會因缺少 .env 而失敗。
（Docker 容器內環境變數已存在，setdefault 不會覆蓋）
"""
import os

os.environ.setdefault("DATABASE_URL", "postgresql://placeholder:placeholder@localhost/placeholder")
os.environ.setdefault("SECRET_KEY", "test-secret-key-placeholder-for-unit-tests-only")
