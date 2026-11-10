from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.dataset import Dataset
from app.services.fraud_service import get_fraud_analytics

router = APIRouter(prefix="/api/fraud", tags=["fraud"])


@router.get("/analytics/{dataset_id}")
async def fraud_analytics(dataset_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    ds = res.scalar_one_or_none()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    return get_fraud_analytics(ds.file_path)
