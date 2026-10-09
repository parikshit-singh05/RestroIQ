import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "RestroIQ API"
    API_V1_STR: str = "/api/v1"
    
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    PROCESSED_DIR: str = os.path.join(DATA_DIR, "processed")
    EXTERNAL_DIR: str = os.path.join(DATA_DIR, "external")
    
settings = Settings()
