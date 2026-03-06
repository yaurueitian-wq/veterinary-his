from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    environment: str = "development"

    # JWT
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 小時

    model_config = {"env_file": ".env"}


settings = Settings()
