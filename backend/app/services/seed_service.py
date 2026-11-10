"""
Seeds the default datasets into the database on first run.
"""
import shutil
import uuid
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.dataset import Dataset
from app.core.config import settings

SEED_DIR = Path(__file__).parent.parent.parent / "seed_data"

SEED_FILES = [
    {"filename": "insurance_premium.csv",  "name": "Insurance Premium Dataset",      "description": "1,338 patient records with age, BMI, smoker status and insurance charges."},
    {"filename": "healthcare_claims.csv",  "name": "Healthcare Claims Dataset",       "description": "2,000 healthcare claims with provider, procedure, diagnosis and amounts."},
    {"filename": "fraud_detection.csv",    "name": "Fraud Detection Dataset",         "description": "5,000 labeled claims for training fraud detection models."},
    {"filename": "patient_records.csv",    "name": "Patient Records Dataset",         "description": "800 patient records with demographics, diagnoses and billing."},
]


async def seed_default_datasets(db: AsyncSession):
    """Called at startup — only seeds datasets that don't already exist by name."""
    if not SEED_DIR.exists():
        return

    for item in SEED_FILES:
        src = SEED_DIR / item["filename"]
        if not src.exists():
            continue
        # Check if already seeded by name
        existing = await db.execute(select(Dataset).where(Dataset.name == item["name"]))
        if existing.scalar_one_or_none():
            continue

        stored_name = f"{uuid.uuid4().hex}.csv"
        dest = settings.UPLOAD_DIR / stored_name
        shutil.copy2(src, dest)

        ds = Dataset(
            name=item["name"],
            description=item["description"],
            original_filename=item["filename"],
            stored_filename=stored_name,
            file_path=str(dest),
            file_size=dest.stat().st_size,
            file_type="csv",
            status="uploaded",
        )
        db.add(ds)

    await db.commit()
    print("[seed] Default datasets checked/inserted.")
