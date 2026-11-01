import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load .env file from backend root if it exists
_backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_env_path = os.path.join(_backend_root, ".env")
if os.path.exists(_env_path):
    load_dotenv(_env_path)

class Settings(BaseSettings):
    PROJECT_NAME: str = "RestroIQ API"
    API_V1_STR: str = "/api/v1"
    FRONTEND_URL: str = "https://restroiq.vercel.app,http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"

    # Supabase Configuration
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY", "") or os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
    SUPABASE_PUBLISHABLE_KEY: str = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "") or os.environ.get("SUPABASE_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_JWT_SECRET: str = os.environ.get("SUPABASE_JWT_SECRET", "")

    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    PROCESSED_DIR: str = os.path.join(DATA_DIR, "processed")
    EXTERNAL_DIR: str = os.path.join(DATA_DIR, "external")

settings = Settings()
