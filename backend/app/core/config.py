from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    APP_NAME: str = "Risk Guard AI"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "risk-guard-ai-secret-key-2024-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    DATABASE_URL: str = "sqlite+aiosqlite:///./risk_guard.db"
    
    UPLOAD_DIR: Path = Path("uploads")
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100 MB
    ALLOWED_EXTENSIONS: list = [".csv", ".xlsx", ".xls"]
    
    class Config:
        env_file = ".env"

settings = Settings()
settings.UPLOAD_DIR.mkdir(exist_ok=True)
