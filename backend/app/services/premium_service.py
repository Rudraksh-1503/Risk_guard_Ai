"""
Premium prediction service.
Works on any compatible dataset loaded from the database.
"""
import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from typing import Dict, Any, List, Optional

from app.services.analysis_service import load_dataframe, classify_columns
from app.core.config import settings

MODELS_DIR = settings.UPLOAD_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)


def _safe(v):
    if isinstance(v, (np.integer,)): return int(v)
    if isinstance(v, (np.floating,)): return None if np.isnan(v) else float(v)
    if isinstance(v, (np.ndarray,)): return v.tolist()
    return v


def predict_single(model_path: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Run a single-row prediction on a saved pipeline."""
    obj = joblib.load(model_path)
    pipeline = obj["pipeline"]
    task_type = obj["task_type"]
    features = obj["features"]
    le = obj.get("label_encoder")

    row = pd.DataFrame([{f: input_data.get(f) for f in features}])
    pred = pipeline.predict(row)[0]

    result: Dict[str, Any] = {}
    if task_type == "regression":
        result["prediction"] = round(float(pred), 2)
        result["task_type"] = "regression"
    else:
        label = le.inverse_transform([pred])[0] if le else str(pred)
        result["prediction"] = label
        result["task_type"] = "classification"
        try:
            proba = pipeline.predict_proba(row)[0]
            classes = le.classes_ if le else pipeline.classes_
            result["probabilities"] = {str(c): round(float(p), 4) for c, p in zip(classes, proba)}
        except Exception:
            pass

    result["features_used"] = features
    return result


def get_premium_analytics(file_path: str) -> Dict[str, Any]:
    """
    Insurance-specific analytics. All computed from the actual file.
    Returns {} if the file is not a compatible premium dataset.
    """
    df = load_dataframe(file_path)
    lower = {c.lower().replace("_", "").replace(" ", ""): c for c in df.columns}

    result: Dict[str, Any] = {}

    # charges / premium
    charge_col = next((lower[k] for k in ["charges", "premium", "totalcharges", "insurancecost"] if k in lower), None)
    age_col = next((lower[k] for k in ["age"] if k in lower), None)
    bmi_col = next((lower[k] for k in ["bmi", "bodymassindex"] if k in lower), None)
    smoker_col = next((lower[k] for k in ["smoker", "smoking", "smokingstatus"] if k in lower), None)
    region_col = next((lower[k] for k in ["region", "area", "location"] if k in lower), None)
    sex_col = next((lower[k] for k in ["sex", "gender"] if k in lower), None)
    children_col = next((lower[k] for k in ["children", "dependents", "numchildren"] if k in lower), None)

    if not charge_col:
        return {"compatible": False, "message": "No premium/charges column found in dataset."}

    result["compatible"] = True
    result["charge_column"] = charge_col
    charges = df[charge_col].dropna()
    result["summary"] = {
        "avg_premium": round(float(charges.mean()), 2),
        "median_premium": round(float(charges.median()), 2),
        "min_premium": round(float(charges.min()), 2),
        "max_premium": round(float(charges.max()), 2),
        "std_premium": round(float(charges.std()), 2),
        "total_records": len(df),
    }

    # premium distribution buckets
    bins = pd.cut(charges, bins=10)
    dist = bins.value_counts().sort_index()
    result["premium_distribution"] = [
        {"range": str(interval), "count": int(cnt)}
        for interval, cnt in dist.items()
    ]

    # age analysis
    if age_col:
        result["age_analysis"] = _age_analysis(df, age_col, charge_col)

    # BMI analysis
    if bmi_col:
        result["bmi_analysis"] = _bmi_analysis(df, bmi_col, charge_col)

    # smoker analysis
    if smoker_col:
        result["smoker_analysis"] = _smoker_analysis(df, smoker_col, charge_col)

    # region analysis
    if region_col:
        grp = df.groupby(region_col)[charge_col].agg(["mean", "median", "count"]).reset_index()
        result["region_analysis"] = [
            {"region": str(r[region_col]), "avg": round(float(r["mean"]), 2),
             "median": round(float(r["median"]), 2), "count": int(r["count"])}
            for _, r in grp.iterrows()
        ]

    # gender analysis
    if sex_col:
        grp = df.groupby(sex_col)[charge_col].mean().reset_index()
        result["gender_analysis"] = [
            {"gender": str(r[sex_col]), "avg_charge": round(float(r[charge_col]), 2)}
            for _, r in grp.iterrows()
        ]

    # children analysis
    if children_col:
        grp = df.groupby(children_col)[charge_col].mean().reset_index()
        result["children_analysis"] = [
            {"children": int(r[children_col]), "avg_charge": round(float(r[charge_col]), 2)}
            for _, r in grp.iterrows()
        ]

    return result


def _age_analysis(df, age_col, charge_col):
    df2 = df[[age_col, charge_col]].dropna()
    df2 = df2.copy()
    df2["age_group"] = pd.cut(df2[age_col], bins=[0, 18, 30, 40, 50, 60, 100],
                               labels=["<18", "18-30", "31-40", "41-50", "51-60", "60+"])
    grp = df2.groupby("age_group", observed=True)[charge_col].mean().reset_index()
    return [{"age_group": str(r["age_group"]), "avg_charge": round(float(r[charge_col]), 2)}
            for _, r in grp.iterrows()]


def _bmi_analysis(df, bmi_col, charge_col):
    df2 = df[[bmi_col, charge_col]].dropna()
    df2 = df2.copy()
    df2["bmi_cat"] = pd.cut(df2[bmi_col], bins=[0, 18.5, 25, 30, 100],
                             labels=["Underweight", "Normal", "Overweight", "Obese"])
    grp = df2.groupby("bmi_cat", observed=True)[charge_col].mean().reset_index()
    return [{"bmi_category": str(r["bmi_cat"]), "avg_charge": round(float(r[charge_col]), 2)}
            for _, r in grp.iterrows()]


def _smoker_analysis(df, smoker_col, charge_col):
    grp = df.groupby(smoker_col)[charge_col].agg(["mean", "count"]).reset_index()
    return [
        {"smoker": str(r[smoker_col]), "avg_charge": round(float(r["mean"]), 2), "count": int(r["count"])}
        for _, r in grp.iterrows()
    ]
