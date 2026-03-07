from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth
from app.routers import catalogs
from app.routers.owners import animals_router, router as owners_router
from app.routers import visits
from app.routers import clinical
from app.routers import assistant

app = FastAPI(
    title="獸醫診所 HIS",
    version="0.1.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url="/redoc" if settings.environment == "development" else None,
)

# CORS：開發環境允許前端 dev server 連線
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(catalogs.router)
app.include_router(owners_router)
app.include_router(animals_router)
app.include_router(visits.router)
app.include_router(clinical.router)
app.include_router(assistant.router)


@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok"}
