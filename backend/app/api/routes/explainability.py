from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Any, Dict, List

from app.core.database import get_db
from app.models.dataset import ModelTrainingHistory
from app.services.explainability_service import explain_prediction, get_whatif_prediction

router = APIRouter(prefix="/api/explain", tags=["explainability"])


class ExplainRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    model_id: int
    input_data: Dict[str, Any]


class WhatIfRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    model_id: int
    scenarios: List[Dict[str, Any]]


@router.post("/predict")
async def explain(req: ExplainRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ModelTrainingHistory).where(ModelTrainingHistory.id == req.model_id))
    model = res.scalar_one_or_none()
    if not model or not model.model_path:
        raise HTTPException(404, "Trained model not found")
    try:
        return explain_prediction(model.model_path, req.input_data)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/whatif")
async def whatif(req: WhatIfRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ModelTrainingHistory).where(ModelTrainingHistory.id == req.model_id))
    model = res.scalar_one_or_none()
    if not model or not model.model_path:
        raise HTTPException(404, "Trained model not found")
    try:
        return get_whatif_prediction(model.model_path, req.scenarios)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/models")
async def list_models(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ModelTrainingHistory).where(ModelTrainingHistory.status == "completed"))
    models = res.scalars().all()
    return [
        {"id": m.id, "model_name": m.model_name, "task_type": m.task_type,
         "target_column": m.target_column, "feature_columns": m.feature_columns,
         "algorithm": m.algorithm, "metrics": m.metrics}
        for m in models
    ]
