from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    environment: str = "development"

    # JWT
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8 小時（一個診所工作日）

    model_config = {"env_file": ".env"}


settings = Settings()
