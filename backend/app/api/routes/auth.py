from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.models.claims import User
from app.services.auth_service import hash_password, verify_password, create_token, decode_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ── schemas ────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    password: str
    policy_number: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ── helpers ────────────────────────────────────────────────────────────────

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    res = await db.execute(select(User).where(User.id == payload.get("sub")))
    user = res.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


async def require_admin(user: User = Depends(get_current_user)):
    if user.role not in ("admin", "authority"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _user_dict(u: User):
    return {"id": u.id, "full_name": u.full_name, "email": u.email,
            "role": u.role, "policy_number": u.policy_number, "phone": u.phone}


# ── routes ─────────────────────────────────────────────────────────────────

@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.email == req.email))
    if res.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")
    user = User(
        full_name=req.full_name,
        email=req.email,
        phone=req.phone,
        password_hash=hash_password(req.password),
        policy_number=req.policy_number or f"POL{hash(req.email) % 900000 + 100000}",
        role="user",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_token({"sub": user.id, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": _user_dict(user)}


@router.post("/login", response_model=LoginResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.email == form.username))
    user = res.scalar_one_or_none()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token({"sub": user.id, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": _user_dict(user)}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return _user_dict(user)


@router.post("/seed-admin")
async def seed_admin(db: AsyncSession = Depends(get_db)):
    """Create default admin and demo user accounts (idempotent)."""
    accounts = [
        {"full_name": "Admin User",      "email": "admin@riskguard.ai",     "password": "Admin@123",  "role": "admin",     "policy_number": "ADMIN001"},
        {"full_name": "Authority User",  "email": "authority@riskguard.ai", "password": "Auth@123",   "role": "authority", "policy_number": "AUTH001"},
        {"full_name": "John Patient",    "email": "john@example.com",       "password": "User@123",   "role": "user",      "policy_number": "POL123456"},
        {"full_name": "Jane Smith",      "email": "jane@example.com",       "password": "User@123",   "role": "user",      "policy_number": "POL789012"},
    ]
    created = []
    for acc in accounts:
        res = await db.execute(select(User).where(User.email == acc["email"]))
        if res.scalar_one_or_none():
            continue
        u = User(full_name=acc["full_name"], email=acc["email"],
                 password_hash=hash_password(acc["password"]),
                 role=acc["role"], policy_number=acc["policy_number"])
        db.add(u); created.append(acc["email"])
    await db.commit()
    return {"created": created, "message": "Demo accounts ready"}
