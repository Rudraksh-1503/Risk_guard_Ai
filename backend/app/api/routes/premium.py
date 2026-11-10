from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Any, Dict, Optional

from app.core.database import get_db
from app.models.dataset import Dataset, ModelTrainingHistory
from app.services.premium_service import get_premium_analytics, predict_single

router = APIRouter(prefix="/api/premium", tags=["premium"])


@router.get("/analytics/{dataset_id}")
async def premium_analytics(dataset_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    ds = res.scalar_one_or_none()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    return get_premium_analytics(ds.file_path)


class PredictRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    model_id: int
    input_data: Dict[str, Any]


@router.post("/predict")
async def predict(req: PredictRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ModelTrainingHistory).where(ModelTrainingHistory.id == req.model_id))
    model = res.scalar_one_or_none()
    if not model or not model.model_path:
        raise HTTPException(404, "Model not found or not trained yet")
    try:
        return predict_single(model.model_path, req.input_data)
    except Exception as e:
        raise HTTPException(500, str(e))
