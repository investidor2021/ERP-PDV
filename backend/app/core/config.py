from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "ERP PEPS API"
    API_V1_STR: str = "/api"
    
    # Database configuration
    # By default, use sqlite database in the backend folder
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        f"sqlite:///{os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'erp_peps.db')}"
    )

    class Config:
        case_sensitive = True

settings = Settings()
