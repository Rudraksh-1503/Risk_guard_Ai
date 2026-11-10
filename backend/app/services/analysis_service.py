"""
Core dynamic dataset analysis engine.
All statistics are computed from the actual uploaded file.
"""
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import json
import re
from datetime import datetime


# ── helpers ────────────────────────────────────────────────────────────────

def _safe(val):
    """Convert numpy scalars to Python primitives for JSON serialisation."""
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return None if np.isnan(val) else float(val)
    if isinstance(val, (np.bool_,)):
        return bool(val)
    if isinstance(val, (np.ndarray,)):
        return val.tolist()
    return val


def load_dataframe(file_path: str) -> pd.DataFrame:
    p = Path(file_path)
    if p.suffix.lower() == ".csv":
        df = pd.read_csv(file_path, low_memory=False)
    else:
        df = pd.read_excel(file_path)
    return df


# ── column classification ──────────────────────────────────────────────────

def classify_columns(df: pd.DataFrame) -> Dict[str, str]:
    """Return {col_name: 'numerical' | 'categorical' | 'date' | 'text'}."""
    result = {}
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            result[col] = "date"
            continue
        if pd.api.types.is_numeric_dtype(df[col]):
            result[col] = "numerical"
            continue
        # Try parsing as date
        sample = df[col].dropna().head(50).astype(str)
        date_patterns = [
            r"\d{4}-\d{2}-\d{2}",
            r"\d{2}/\d{2}/\d{4}",
            r"\d{2}-\d{2}-\d{4}",
        ]
        is_date = any(sample.str.match(pat).mean() > 0.7 for pat in date_patterns)
        if is_date:
            result[col] = "date"
        elif df[col].nunique() / max(len(df), 1) < 0.5 and df[col].nunique() <= 100:
            result[col] = "categorical"
        else:
            result[col] = "text"
    return result


# ── dataset category detection ─────────────────────────────────────────────

CATEGORY_SIGNATURES = {
    "Health Insurance Premium Dataset": {
        "keywords": ["age", "bmi", "smoker", "charges", "premium", "region", "sex", "children"],
        "min_match": 3,
    },
    "Healthcare Claims Dataset": {
        "keywords": ["claim", "claimid", "provider", "reimbursement", "service", "procedure",
                     "diagnosis", "npi", "billing", "amount", "paid"],
        "min_match": 2,
    },
    "Healthcare Fraud Detection Dataset": {
        "keywords": ["fraud", "fraudulent", "label", "is_fraud", "claim", "provider",
                     "inpatient", "outpatient", "deductible", "reimbursed"],
        "min_match": 2,
    },
    "Patient Records Dataset": {
        "keywords": ["patient", "patientid", "dob", "gender", "diagnosis", "admission",
                     "discharge", "condition", "medication"],
        "min_match": 2,
    },
    "Hospital Billing Dataset": {
        "keywords": ["hospital", "billing", "invoice", "cost", "fee", "room", "ward",
                     "discharge", "insurance", "copay"],
        "min_match": 2,
    },
}


def detect_category(df: pd.DataFrame) -> Tuple[str, float]:
    normalised = [c.lower().replace(" ", "").replace("_", "") for c in df.columns]
    best_cat, best_score = "Unknown / Custom Dataset", 0.0

    for category, sig in CATEGORY_SIGNATURES.items():
        keywords = sig["keywords"]
        min_match = sig["min_match"]
        matches = sum(
            1 for kw in keywords
            if any(kw in nc for nc in normalised)
        )
        score = matches / len(keywords)
        if matches >= min_match and score > best_score:
            best_score = score
            best_cat = category

    confidence = round(min(best_score * 1.5, 1.0), 2)
    return best_cat, confidence


# ── statistical summaries ──────────────────────────────────────────────────

def numerical_stats(df: pd.DataFrame, col: str) -> Dict[str, Any]:
    s = df[col].dropna()
    if len(s) == 0:
        return {}
    q = s.quantile([0.25, 0.5, 0.75])
    iqr = float(q[0.75] - q[0.25])
    lower = float(q[0.25] - 1.5 * iqr)
    upper = float(q[0.75] + 1.5 * iqr)
    outliers = int(((s < lower) | (s > upper)).sum())
    return {
        "mean": _safe(s.mean()),
        "median": _safe(s.median()),
        "mode": _safe(s.mode().iloc[0]) if not s.mode().empty else None,
        "min": _safe(s.min()),
        "max": _safe(s.max()),
        "std": _safe(s.std()),
        "variance": _safe(s.var()),
        "q1": _safe(q[0.25]),
        "q3": _safe(q[0.75]),
        "iqr": _safe(iqr),
        "skewness": _safe(s.skew()),
        "kurtosis": _safe(s.kurt()),
        "outlier_count": outliers,
        "count": int(len(s)),
    }


def categorical_stats(df: pd.DataFrame, col: str) -> Dict[str, Any]:
    s = df[col].dropna().astype(str)
    vc = s.value_counts()
    total = len(s)
    top_n = min(10, len(vc))
    return {
        "unique_count": int(s.nunique()),
        "most_frequent": str(vc.index[0]) if len(vc) else None,
        "most_frequent_count": int(vc.iloc[0]) if len(vc) else 0,
        "least_frequent": str(vc.index[-1]) if len(vc) else None,
        "top_values": {str(k): int(v) for k, v in vc.head(top_n).items()},
        "top_percentages": {str(k): round(v / total * 100, 2) for k, v in vc.head(top_n).items()},
        "count": int(total),
    }


# ── quality score ──────────────────────────────────────────────────────────

def compute_quality_score(df: pd.DataFrame) -> float:
    total_cells = df.shape[0] * df.shape[1]
    if total_cells == 0:
        return 0.0
    missing_ratio = df.isnull().sum().sum() / total_cells
    dup_ratio = df.duplicated().sum() / max(len(df), 1)
    score = max(0.0, 1.0 - missing_ratio * 0.5 - dup_ratio * 0.3)
    return round(score * 100, 1)


# ── main analysis function ─────────────────────────────────────────────────

def analyze_dataset(file_path: str) -> Dict[str, Any]:
    df = load_dataframe(file_path)
    col_types = classify_columns(df)
    category, confidence = detect_category(df)

    num_cols = [c for c, t in col_types.items() if t == "numerical"]
    cat_cols = [c for c, t in col_types.items() if t == "categorical"]
    date_cols = [c for c, t in col_types.items() if t == "date"]

    # column-level info
    columns_info = []
    for col in df.columns:
        ctype = col_types.get(col, "text")
        null_count = int(df[col].isnull().sum())
        null_pct = round(null_count / len(df) * 100, 2) if len(df) else 0
        unique_count = int(df[col].nunique())
        stats: Dict[str, Any] = {}
        if ctype == "numerical":
            stats = numerical_stats(df, col)
        elif ctype == "categorical":
            stats = categorical_stats(df, col)
        columns_info.append({
            "name": col,
            "dtype": str(df[col].dtype),
            "category": ctype,
            "null_count": null_count,
            "null_percentage": null_pct,
            "unique_count": unique_count,
            "stats": stats,
        })

    # quality issues
    quality_issues: List[Dict] = []
    for col in df.columns:
        nc = int(df[col].isnull().sum())
        if nc > 0:
            quality_issues.append({
                "type": "missing_values",
                "column": col,
                "count": nc,
                "severity": "high" if nc / len(df) > 0.3 else "medium" if nc / len(df) > 0.05 else "low",
                "message": f"Column '{col}' has {nc} missing values ({round(nc/len(df)*100,1)}%).",
            })

    dup_count = int(df.duplicated().sum())
    if dup_count > 0:
        quality_issues.append({
            "type": "duplicate_rows",
            "column": "all",
            "count": dup_count,
            "severity": "medium",
            "message": f"{dup_count} duplicate rows detected.",
        })

    # ML recommendations
    ml_tasks = _recommend_ml_tasks(df, col_types, category)

    # insights
    insights = _generate_insights(df, col_types, category, quality_issues)

    # correlation matrix for numerical cols
    correlation = {}
    if len(num_cols) >= 2:
        corr_df = df[num_cols].corr().round(3)
        correlation = {col: {c2: _safe(v) for c2, v in row.items()}
                       for col, row in corr_df.to_dict().items()}

    return {
        "overview": {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "numerical_columns": len(num_cols),
            "categorical_columns": len(cat_cols),
            "date_columns": len(date_cols),
            "missing_values_total": int(df.isnull().sum().sum()),
            "duplicate_rows": dup_count,
            "quality_score": compute_quality_score(df),
            "memory_usage_mb": round(df.memory_usage(deep=True).sum() / 1024 / 1024, 3),
        },
        "columns": columns_info,
        "detected_category": category,
        "category_confidence": confidence,
        "quality_issues": quality_issues,
        "correlation": correlation,
        "ml_recommendations": ml_tasks,
        "insights": insights,
    }


# ── ML recommendation ──────────────────────────────────────────────────────

def _recommend_ml_tasks(df: pd.DataFrame, col_types: Dict, category: str) -> List[Dict]:
    tasks = []
    num_cols = [c for c, t in col_types.items() if t == "numerical"]
    cat_cols = [c for c, t in col_types.items() if t == "categorical"]

    lower_cols = {c.lower().replace(" ", "").replace("_", ""): c for c in df.columns}

    # Premium regression
    premium_keys = ["charges", "premium", "insurancecost", "totalcharges"]
    target_col = next((lower_cols[k] for k in premium_keys if k in lower_cols), None)
    if target_col and len(num_cols) >= 3:
        features = [c for c in num_cols + cat_cols if c != target_col]
        tasks.append({
            "task": "Insurance Premium Regression",
            "type": "regression",
            "target_column": target_col,
            "feature_columns": features[:15],
            "algorithms": ["Random Forest", "Gradient Boosting", "Linear Regression"],
            "suitability": "high",
            "description": "Predict insurance charges/premiums based on patient features.",
        })

    # Fraud classification
    fraud_keys = ["fraud", "fraudlabel", "isfraud", "fraudulent", "label"]
    fraud_col = next((lower_cols[k] for k in fraud_keys if k in lower_cols), None)
    if fraud_col:
        features = [c for c in num_cols + cat_cols if c != fraud_col]
        tasks.append({
            "task": "Fraud Detection Classification",
            "type": "classification",
            "target_column": fraud_col,
            "feature_columns": features[:15],
            "algorithms": ["Random Forest", "XGBoost", "Logistic Regression"],
            "suitability": "high",
            "description": "Classify claims as fraudulent or legitimate.",
        })

    # Generic classification — categorical target with <=10 unique values
    if not tasks:
        for col in cat_cols:
            if df[col].nunique() <= 10 and len(num_cols) >= 2:
                features = [c for c in num_cols + cat_cols if c != col]
                tasks.append({
                    "task": "General Classification",
                    "type": "classification",
                    "target_column": col,
                    "feature_columns": features[:15],
                    "algorithms": ["Random Forest", "Logistic Regression", "Decision Tree"],
                    "suitability": "medium",
                    "description": f"Classify records by '{col}'.",
                })
                break

    # Generic regression — numerical target
    if not tasks and num_cols:
        target = num_cols[-1]
        features = num_cols[:-1] + cat_cols
        tasks.append({
            "task": "General Regression",
            "type": "regression",
            "target_column": target,
            "feature_columns": features[:15],
            "algorithms": ["Random Forest", "Linear Regression", "Gradient Boosting"],
            "suitability": "medium",
            "description": f"Predict '{target}' using available features.",
        })

    return tasks


# ── insight generation ─────────────────────────────────────────────────────

def _generate_insights(df: pd.DataFrame, col_types: Dict,
                        category: str, quality_issues: List) -> List[str]:
    insights: List[str] = []
    n_rows, n_cols = len(df), len(df.columns)
    insights.append(f"The dataset contains {n_rows:,} records and {n_cols} features.")

    num_cols = [c for c, t in col_types.items() if t == "numerical"]
    cat_cols = [c for c, t in col_types.items() if t == "categorical"]

    if num_cols:
        insights.append(f"There are {len(num_cols)} numerical features: {', '.join(num_cols[:5])}{'...' if len(num_cols)>5 else ''}.")
    if cat_cols:
        insights.append(f"There are {len(cat_cols)} categorical features: {', '.join(cat_cols[:5])}{'...' if len(cat_cols)>5 else ''}.")

    # missing values
    total_missing = int(df.isnull().sum().sum())
    if total_missing == 0:
        insights.append("No missing values detected — the dataset is complete.")
    else:
        pct = round(total_missing / (n_rows * n_cols) * 100, 1)
        insights.append(f"{total_missing:,} missing values found ({pct}% of all cells). Consider imputation before modelling.")

    # duplicates
    dups = int(df.duplicated().sum())
    if dups:
        insights.append(f"{dups} duplicate rows found. Review and remove them before training.")

    # insurance-specific
    lower_map = {c.lower().replace("_", ""): c for c in df.columns}
    if "smoker" in lower_map and "charges" in lower_map:
        try:
            smokers = df[df[lower_map["smoker"]].astype(str).str.lower() == "yes"][lower_map["charges"]].mean()
            non_smokers = df[df[lower_map["smoker"]].astype(str).str.lower() == "no"][lower_map["charges"]].mean()
            if not np.isnan(smokers) and not np.isnan(non_smokers):
                ratio = round(smokers / non_smokers, 1)
                insights.append(
                    f"Smokers have on average {ratio}x higher insurance charges than non-smokers — smoking is a strong premium driver."
                )
        except Exception:
            pass

    if "bmi" in lower_map and "charges" in lower_map:
        try:
            corr = df[lower_map["bmi"]].corr(df[lower_map["charges"]])
            if abs(corr) > 0.3:
                direction = "positive" if corr > 0 else "negative"
                insights.append(
                    f"BMI shows a {direction} correlation ({round(corr,2)}) with insurance charges."
                )
        except Exception:
            pass

    if "age" in lower_map and "charges" in lower_map:
        try:
            corr = df[lower_map["age"]].corr(df[lower_map["charges"]])
            if abs(corr) > 0.2:
                insights.append(f"Age has a correlation of {round(corr,2)} with insurance charges.")
        except Exception:
            pass

    return insights
