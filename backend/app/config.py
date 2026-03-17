from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    environment: str = "development"

    # JWT
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 小時

    # CORS：逗號分隔的允許來源（Railway 部署時設定 ALLOWED_ORIGINS）
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # AI Assistant（系統小幫手）
    llm_api_key: str = "ollama"          # Ollama 不驗證 key，填任意值即可
    llm_base_url: str = "http://host.docker.internal:11434/v1"
    llm_model: str = "llama3.2:3b"

    model_config = {"env_file": ".env"}


settings = Settings()
