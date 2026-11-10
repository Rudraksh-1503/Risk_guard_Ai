"""
ML training service — trains real models on the uploaded dataset.
No fake metrics. All results are computed from actual train/test splits.
"""
import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from typing import Dict, Any, List, Optional
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_auc_score
)
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer

from app.services.analysis_service import load_dataframe, classify_columns
from app.core.config import settings


MODELS_DIR = settings.UPLOAD_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)


def _safe(val):
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return None if np.isnan(val) else float(val)
    if isinstance(val, (np.bool_,)):
        return bool(val)
    if isinstance(val, (np.ndarray, list)):
        return [_safe(v) for v in val]
    return val


def train_model(
    file_path: str,
    target_column: str,
    feature_columns: Optional[List[str]],
    task_type: str,
    algorithm: str = "Random Forest",
    dataset_id: int = 0,
) -> Dict[str, Any]:

    df = load_dataframe(file_path)

    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")

    col_types = classify_columns(df)

    if feature_columns:
        features = [c for c in feature_columns if c in df.columns and c != target_column]
    else:
        features = [c for c in df.columns if c != target_column and col_types.get(c) in ("numerical", "categorical")]

    if not features:
        raise ValueError("No usable feature columns found.")

    df_model = df[features + [target_column]].dropna(subset=[target_column])

    num_features = [c for c in features if col_types.get(c) == "numerical"]
    cat_features = [c for c in features if col_types.get(c) == "categorical"]

    X = df_model[features]
    y = df_model[target_column]

    # encode target for classification
    le = None
    if task_type == "classification":
        le = LabelEncoder()
        y = le.fit_transform(y.astype(str))

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # preprocessing pipeline
    transformers = []
    if num_features:
        num_pipe = Pipeline([("imputer", SimpleImputer(strategy="median")),
                              ("scaler", StandardScaler())])
        transformers.append(("num", num_pipe, num_features))
    if cat_features:
        cat_pipe = Pipeline([("imputer", SimpleImputer(strategy="most_frequent")),
                              ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False))])
        transformers.append(("cat", cat_pipe, cat_features))

    preprocessor = ColumnTransformer(transformers, remainder="drop")

    # select estimator
    estimator = _select_estimator(task_type, algorithm)

    pipeline = Pipeline([("preprocessor", preprocessor), ("model", estimator)])
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)

    metrics: Dict[str, Any] = {}
    if task_type == "regression":
        mae = mean_absolute_error(y_test, y_pred)
        rmse = mean_squared_error(y_test, y_pred) ** 0.5
        r2 = r2_score(y_test, y_pred)
        metrics = {
            "mae": round(float(mae), 4),
            "rmse": round(float(rmse), 4),
            "r2": round(float(r2), 4),
            "actual_vs_predicted": {
                "actual": _safe(list(y_test[:100])),
                "predicted": _safe(list(y_pred[:100])),
            },
        }
    else:
        acc = accuracy_score(y_test, y_pred)
        avg = "binary" if len(np.unique(y)) == 2 else "weighted"
        prec = precision_score(y_test, y_pred, average=avg, zero_division=0)
        rec = recall_score(y_test, y_pred, average=avg, zero_division=0)
        f1 = f1_score(y_test, y_pred, average=avg, zero_division=0)
        cm = confusion_matrix(y_test, y_pred).tolist()
        metrics = {
            "accuracy": round(float(acc), 4),
            "precision": round(float(prec), 4),
            "recall": round(float(rec), 4),
            "f1_score": round(float(f1), 4),
            "confusion_matrix": cm,
        }
        if len(np.unique(y)) == 2:
            try:
                y_prob = pipeline.predict_proba(X_test)[:, 1]
                roc = roc_auc_score(y_test, y_prob)
                metrics["roc_auc"] = round(float(roc), 4)
            except Exception:
                pass

    # save model
    model_filename = f"model_ds{dataset_id}_{target_column}_{task_type}.joblib"
    model_path = MODELS_DIR / model_filename
    joblib.dump({"pipeline": pipeline, "label_encoder": le, "features": features, "task_type": task_type}, model_path)

    # feature importances
    feature_importances = {}
    try:
        raw = pipeline.named_steps["model"].feature_importances_
        # map back to original feature names
        feature_names = []
        if hasattr(preprocessor, "transformers_"):
            for name, trans, cols in preprocessor.transformers_:
                if name == "num":
                    feature_names.extend(cols)
                elif name == "cat":
                    ohe = trans.named_steps["ohe"]
                    for col_i, cats in zip(cols, ohe.categories_):
                        feature_names.extend([f"{col_i}_{c}" for c in cats])
        if len(feature_names) == len(raw):
            feature_importances = dict(sorted(
                {f: round(float(v), 4) for f, v in zip(feature_names, raw)}.items(),
                key=lambda x: x[1], reverse=True
            ))
    except Exception:
        pass

    return {
        "metrics": metrics,
        "model_path": str(model_path),
        "feature_columns": features,
        "feature_importances": feature_importances,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "algorithm": algorithm,
        "task_type": task_type,
        "target_column": target_column,
    }


def _select_estimator(task_type: str, algorithm: str):
    name = algorithm.lower()
    if task_type == "regression":
        if "gradient" in name:
            return GradientBoostingRegressor(n_estimators=100, random_state=42)
        if "linear" in name:
            return LinearRegression()
        return RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    else:
        if "logistic" in name:
            return LogisticRegression(max_iter=500, random_state=42)
        return RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
