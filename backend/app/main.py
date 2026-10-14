from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router
from app.core.config import settings
from app.services.data_service import data_service
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    _ = data_service
    yield

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# Build clean list of allowed origins, ensuring production Vercel URL and local dev are always present
raw_origins = [o.strip() for o in settings.FRONTEND_URL.split(",") if o.strip()]
default_origins = [
    "https://restroiq.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
]
allowed_origins = list(dict.fromkeys(raw_origins + default_origins))
# Also normalize any with/without trailing slash
for o in list(allowed_origins):
    if o.endswith("/"):
        allowed_origins.append(o.rstrip("/"))
    else:
        allowed_origins.append(f"{o}/")
allowed_origins = list(dict.fromkeys(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https:\/\/restroiq(-[a-z0-9-]+)?\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"message": "Welcome to the RestroIQ API."}
