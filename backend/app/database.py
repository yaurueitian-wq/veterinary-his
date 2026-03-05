from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency：提供資料庫 session，請求結束後自動關閉"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
