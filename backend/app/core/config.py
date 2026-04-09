from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./ada_east.db"

    SECRET_KEY: str = "change-me-in-env"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 10

    APP_NAME: str = "Ada East District Assembly - Digital Filing System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    class Config:
        env_file = ".env"


settings = Settings()

# Ensure upload directories exist at startup.
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
Path(f"{settings.UPLOAD_DIR}/incoming").mkdir(parents=True, exist_ok=True)
Path(f"{settings.UPLOAD_DIR}/outgoing").mkdir(parents=True, exist_ok=True)
