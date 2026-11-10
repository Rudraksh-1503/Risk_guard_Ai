from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.dataset import Dataset
from app.services.forecast_service import get_forecast_analytics

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


@router.get("/analytics/{dataset_id}")
async def forecast_analytics(dataset_id: int, periods: int = 6, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    ds = res.scalar_one_or_none()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    return get_forecast_analytics(ds.file_path, periods)
