"""Auth service — bcrypt + PyJWT, fully compatible with Python 3.12."""
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
import jwt as pyjwt
from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_token(data: dict, expires_minutes: int = None) -> str:
    exp_mins = expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    payload = {
        **data,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=exp_mins),
        "iat": datetime.now(timezone.utc),
    }
    return pyjwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return pyjwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        return None
    except pyjwt.InvalidTokenError:
        return None
