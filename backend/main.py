from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.database import init_db, AsyncSessionLocal
from app.api.routes import datasets, premium, fraud, forecast, explainability, auth, claims
from app.services.seed_service import seed_default_datasets
from app.services.auth_service import hash_password
from app.models.claims import User
from sqlalchemy import select


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with AsyncSessionLocal() as db:
        # Seed default demo accounts
        for acc in [
            {"full_name": "Admin User",     "email": "admin@riskguard.ai",     "password": "Admin@123",  "role": "admin",     "policy_number": "ADMIN001"},
            {"full_name": "Authority User", "email": "authority@riskguard.ai", "password": "Auth@123",   "role": "authority", "policy_number": "AUTH001"},
            {"full_name": "John Patient",   "email": "john@example.com",       "password": "User@123",   "role": "user",      "policy_number": "POL123456"},
        ]:
            res = await db.execute(select(User).where(User.email == acc["email"]))
            if not res.scalar_one_or_none():
                db.add(User(full_name=acc["full_name"], email=acc["email"],
                            password_hash=hash_password(acc["password"]),
                            role=acc["role"], policy_number=acc["policy_number"]))
        await db.commit()
        # Seed default datasets
        await seed_default_datasets(db)
    yield


app = FastAPI(
    title="Risk Guard AI",
    description="Dynamic dataset analysis, ML training and insurance claims platform.",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(claims.router)
app.include_router(datasets.router)
app.include_router(premium.router)
app.include_router(fraud.router)
app.include_router(forecast.router)
app.include_router(explainability.router)


@app.get("/")
async def root():
    return {"message": "Risk Guard AI API running", "version": "2.1.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
