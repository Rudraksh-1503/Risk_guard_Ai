"""Dataset upload, analysis and management routes."""
import uuid
import shutil
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.config import settings
from app.models.dataset import Dataset, DatasetColumn, DatasetAnalysis, ModelTrainingHistory, AnalysisReport
from app.services.analysis_service import analyze_dataset
from app.services.ml_service import train_model
from app.services.report_service import generate_pdf_report, export_cleaned_csv

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


# ── schemas ────────────────────────────────────────────────────────────────

class CategoryUpdateRequest(BaseModel):
    category: str


class TrainRequest(BaseModel):
    target_column: str
    feature_columns: Optional[List[str]] = None
    task_type: str = "regression"
    algorithm: str = "Random Forest"


# ── upload ─────────────────────────────────────────────────────────────────

@router.post("")
async def upload_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {settings.ALLOWED_EXTENSIONS}")

    stored_name = f"{uuid.uuid4().hex}{suffix}"
    file_path = settings.UPLOAD_DIR / stored_name

    total = 0
    with open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 256):
            total += len(chunk)
            if total > settings.MAX_FILE_SIZE:
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File too large (max 100 MB).")
            f.write(chunk)

    ds = Dataset(
        name=name,
        description=description,
        original_filename=file.filename,
        stored_filename=stored_name,
        file_path=str(file_path),
        file_size=total,
        file_type=suffix.lstrip("."),
        status="uploaded",
    )
    db.add(ds)
    await db.commit()
    await db.refresh(ds)

    background_tasks.add_task(_run_analysis, ds.id, str(file_path))

    return {"id": ds.id, "name": ds.name, "status": "processing", "message": "Dataset uploaded. Analysis started."}


async def _run_analysis(dataset_id: int, file_path: str):
    """Run in background after upload."""
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
            ds = result.scalar_one_or_none()
            if not ds:
                return

            data = analyze_dataset(file_path)

            ds.row_count = data["overview"]["total_rows"]
            ds.column_count = data["overview"]["total_columns"]
            ds.detected_category = data["detected_category"]
            ds.category_confidence = data["category_confidence"]
            ds.is_analyzed = True
            ds.status = "analyzed"

            # save columns
            for col_info in data["columns"]:
                col = DatasetColumn(
                    dataset_id=dataset_id,
                    column_name=col_info["name"],
                    data_type=col_info["dtype"],
                    column_category=col_info["category"],
                    null_count=col_info["null_count"],
                    null_percentage=col_info["null_percentage"],
                    unique_count=col_info["unique_count"],
                    stats=col_info["stats"],
                )
                db.add(col)

            # save analysis
            analysis = DatasetAnalysis(
                dataset_id=dataset_id,
                total_rows=data["overview"]["total_rows"],
                total_columns=data["overview"]["total_columns"],
                numerical_columns=data["overview"]["numerical_columns"],
                categorical_columns=data["overview"]["categorical_columns"],
                date_columns=data["overview"]["date_columns"],
                missing_values_total=data["overview"]["missing_values_total"],
                duplicate_rows=data["overview"]["duplicate_rows"],
                quality_score=data["overview"]["quality_score"],
                memory_usage_mb=data["overview"]["memory_usage_mb"],
                statistical_summary=data,
                data_quality_issues=data["quality_issues"],
                insights=data["insights"],
                recommended_ml_tasks=data["ml_recommendations"],
            )
            db.add(analysis)
            await db.commit()
        except Exception as e:
            result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
            ds = result.scalar_one_or_none()
            if ds:
                ds.status = f"error: {str(e)[:200]}"
                await db.commit()


# ── list ───────────────────────────────────────────────────────────────────

@router.get("")
async def list_datasets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).order_by(Dataset.upload_date.desc()))
    datasets = result.scalars().all()
    return [_ds_summary(ds) for ds in datasets]


def _ds_summary(ds: Dataset):
    return {
        "id": ds.id,
        "name": ds.name,
        "description": ds.description,
        "original_filename": ds.original_filename,
        "file_size": ds.file_size,
        "file_type": ds.file_type,
        "row_count": ds.row_count,
        "column_count": ds.column_count,
        "detected_category": ds.detected_category,
        "category_confidence": ds.category_confidence,
        "user_category": ds.user_category,
        "upload_date": ds.upload_date.isoformat() if ds.upload_date else None,
        "status": ds.status,
        "is_analyzed": ds.is_analyzed,
    }


# ── get one ────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}")
async def get_dataset(dataset_id: int, db: AsyncSession = Depends(get_db)):
    ds = await _get_or_404(dataset_id, db)
    return _ds_summary(ds)


# ── preview ────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/preview")
async def preview_dataset(dataset_id: int, rows: int = 10, db: AsyncSession = Depends(get_db)):
    ds = await _get_or_404(dataset_id, db)
    from app.services.analysis_service import load_dataframe
    df = load_dataframe(ds.file_path)
    preview = df.head(rows).fillna("").to_dict(orient="records")
    return {"columns": list(df.columns), "data": preview, "total_rows": len(df)}


# ── analysis ───────────────────────────────────────────────────────────────

@router.post("/{dataset_id}/analyze")
async def trigger_analysis(dataset_id: int, db: AsyncSession = Depends(get_db)):
    ds = await _get_or_404(dataset_id, db)
    # delete existing analysis to re-run
    res = await db.execute(select(DatasetAnalysis).where(DatasetAnalysis.dataset_id == dataset_id))
    existing = res.scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.commit()
    await _run_analysis(dataset_id, ds.file_path)
    return {"message": "Analysis complete."}


@router.get("/{dataset_id}/analysis")
async def get_analysis(dataset_id: int, db: AsyncSession = Depends(get_db)):
    await _get_or_404(dataset_id, db)
    res = await db.execute(select(DatasetAnalysis).where(DatasetAnalysis.dataset_id == dataset_id))
    analysis = res.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found. Upload and trigger analysis first.")
    return analysis.statistical_summary


# ── category update ────────────────────────────────────────────────────────

@router.patch("/{dataset_id}/category")
async def update_category(dataset_id: int, body: CategoryUpdateRequest, db: AsyncSession = Depends(get_db)):
    ds = await _get_or_404(dataset_id, db)
    ds.user_category = body.category
    await db.commit()
    return {"message": "Category updated."}


# ── train ──────────────────────────────────────────────────────────────────

@router.post("/{dataset_id}/train")
async def train(dataset_id: int, req: TrainRequest, db: AsyncSession = Depends(get_db)):
    ds = await _get_or_404(dataset_id, db)
    try:
        result = train_model(
            file_path=ds.file_path,
            target_column=req.target_column,
            feature_columns=req.feature_columns,
            task_type=req.task_type,
            algorithm=req.algorithm,
            dataset_id=dataset_id,
        )
        record = ModelTrainingHistory(
            dataset_id=dataset_id,
            model_name=f"{req.algorithm} — {req.target_column}",
            task_type=req.task_type,
            target_column=req.target_column,
            feature_columns=result["feature_columns"],
            algorithm=req.algorithm,
            metrics=result["metrics"],
            model_path=result["model_path"],
            status="completed",
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        result["model_id"] = record.id
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


# ── models list ────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/models")
async def get_models(dataset_id: int, db: AsyncSession = Depends(get_db)):
    await _get_or_404(dataset_id, db)
    res = await db.execute(select(ModelTrainingHistory).where(ModelTrainingHistory.dataset_id == dataset_id))
    models = res.scalars().all()
    return [
        {
            "id": m.id,
            "model_name": m.model_name,
            "task_type": m.task_type,
            "target_column": m.target_column,
            "algorithm": m.algorithm,
            "metrics": m.metrics,
            "training_date": m.training_date.isoformat() if m.training_date else None,
            "status": m.status,
        }
        for m in models
    ]


# ── insights ───────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/insights")
async def get_insights(dataset_id: int, db: AsyncSession = Depends(get_db)):
    await _get_or_404(dataset_id, db)
    res = await db.execute(select(DatasetAnalysis).where(DatasetAnalysis.dataset_id == dataset_id))
    analysis = res.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return {"insights": analysis.insights, "recommendations": analysis.recommended_ml_tasks}


# ── report ─────────────────────────────────────────────────────────────────

@router.post("/{dataset_id}/report")
async def create_report(dataset_id: int, db: AsyncSession = Depends(get_db)):
    ds = await _get_or_404(dataset_id, db)
    res = await db.execute(select(DatasetAnalysis).where(DatasetAnalysis.dataset_id == dataset_id))
    analysis_rec = res.scalar_one_or_none()
    if not analysis_rec:
        raise HTTPException(status_code=400, detail="Run analysis first.")

    model_metrics = None
    res2 = await db.execute(
        select(ModelTrainingHistory)
        .where(ModelTrainingHistory.dataset_id == dataset_id)
        .order_by(ModelTrainingHistory.training_date.desc())
    )
    latest_model = res2.scalars().first()
    if latest_model:
        model_metrics = {"metrics": latest_model.metrics}

    pdf_path = generate_pdf_report(
        dataset_meta={"id": ds.id, "name": ds.name, "upload_date": str(ds.upload_date)},
        analysis=analysis_rec.statistical_summary,
        model_metrics=model_metrics,
    )
    report = AnalysisReport(dataset_id=dataset_id, report_path=pdf_path, report_format="pdf")
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return {"report_id": report.id, "message": "Report generated.", "download_url": f"/api/datasets/{dataset_id}/report/{report.id}/download"}


@router.get("/{dataset_id}/report/{report_id}/download")
async def download_report(dataset_id: int, report_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(AnalysisReport).where(AnalysisReport.id == report_id, AnalysisReport.dataset_id == dataset_id))
    report = res.scalar_one_or_none()
    if not report or not Path(report.report_path).exists():
        raise HTTPException(status_code=404, detail="Report not found.")
    return FileResponse(report.report_path, media_type="application/pdf", filename=Path(report.report_path).name)


@router.get("/{dataset_id}/export/csv")
async def export_csv(dataset_id: int, db: AsyncSession = Depends(get_db)):
    ds = await _get_or_404(dataset_id, db)
    path = export_cleaned_csv(ds.file_path, dataset_id)
    return FileResponse(path, media_type="text/csv", filename=f"cleaned_{ds.name}.csv")


# ── delete ─────────────────────────────────────────────────────────────────

@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: int, db: AsyncSession = Depends(get_db)):
    ds = await _get_or_404(dataset_id, db)
    Path(ds.file_path).unlink(missing_ok=True)
    await db.delete(ds)
    await db.commit()
    return {"message": "Dataset deleted."}


# ── helper ─────────────────────────────────────────────────────────────────

async def _get_or_404(dataset_id: int, db: AsyncSession) -> Dataset:
    res = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    ds = res.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return ds
