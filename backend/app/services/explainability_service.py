"""
Rule-based explainability. Explains predictions using feature contributions
derived from the trained model's feature importances.
No SHAP required — works with any sklearn pipeline.
"""
import pandas as pd
import numpy as np
import joblib
from typing import Dict, Any, List


def explain_prediction(model_path: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
    obj = joblib.load(model_path)
    pipeline = obj["pipeline"]
    task_type = obj["task_type"]
    features = obj["features"]
    le = obj.get("label_encoder")

    row = pd.DataFrame([{f: input_data.get(f) for f in features}])
    pred = pipeline.predict(row)[0]

    # Get prediction value
    if task_type == "regression":
        pred_label = round(float(pred), 2)
    else:
        pred_label = le.inverse_transform([pred])[0] if le else str(pred)

    # Get feature importances from the model
    model = pipeline.named_steps["model"]
    preprocessor = pipeline.named_steps["preprocessor"]

    importances = []
    try:
        fi = model.feature_importances_
        # Reconstruct feature names after transformation
        feature_names = []
        for name, trans, cols in preprocessor.transformers_:
            if name == "num":
                feature_names.extend(cols)
            elif name == "cat":
                ohe = trans.named_steps["ohe"]
                for col_i, cats in zip(cols, ohe.categories_):
                    feature_names.extend([f"{col_i}={c}" for c in cats])

        # Get transformed row
        X_transformed = preprocessor.transform(row)

        # Pair importances with transformed values
        for i, (fname, imp) in enumerate(zip(feature_names, fi)):
            if imp > 0.001:
                val = float(X_transformed[0][i]) if i < X_transformed.shape[1] else 0
                importances.append({
                    "feature": fname,
                    "importance": round(float(imp), 4),
                    "value": round(val, 4),
                    "contribution": round(float(imp * val), 4),
                })

        importances.sort(key=lambda x: abs(x["importance"]), reverse=True)
        importances = importances[:15]
    except Exception:
        # Fallback: list input features and their values
        for f in features:
            importances.append({
                "feature": f,
                "importance": None,
                "value": input_data.get(f),
                "contribution": None,
            })

    # Natural language explanation
    explanation_text = _build_explanation(pred_label, importances, task_type)

    return {
        "prediction": pred_label,
        "task_type": task_type,
        "feature_contributions": importances,
        "explanation": explanation_text,
        "input_values": {f: input_data.get(f) for f in features},
    }


def _build_explanation(pred, importances, task_type):
    lines = []
    if task_type == "regression":
        lines.append(f"The model predicts a value of {pred}.")
    else:
        lines.append(f"The model classified this record as '{pred}'.")

    top = [i for i in importances if i["importance"] and i["importance"] > 0.05][:3]
    if top:
        factors = ", ".join([f"'{f['feature']}'" for f in top])
        lines.append(f"The most influential features are: {factors}.")

    high_imp = [i for i in importances if i["importance"] and i["importance"] > 0.15]
    for f in high_imp[:2]:
        lines.append(f"Feature '{f['feature']}' has an importance score of {f['importance']:.3f}.")

    return " ".join(lines)


def get_whatif_prediction(model_path: str, scenarios: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Run multiple what-if scenarios through the saved model."""
    obj = joblib.load(model_path)
    pipeline = obj["pipeline"]
    task_type = obj["task_type"]
    features = obj["features"]
    le = obj.get("label_encoder")

    results = []
    for scenario in scenarios:
        row = pd.DataFrame([{f: scenario.get(f) for f in features}])
        pred = pipeline.predict(row)[0]
        if task_type == "regression":
            results.append({"scenario": scenario, "prediction": round(float(pred), 2)})
        else:
            label = le.inverse_transform([pred])[0] if le else str(pred)
            try:
                proba = pipeline.predict_proba(row)[0]
                classes = le.classes_ if le else pipeline.classes_
                probs = {str(c): round(float(p), 4) for c, p in zip(classes, proba)}
            except Exception:
                probs = {}
            results.append({"scenario": scenario, "prediction": label, "probabilities": probs})

    return results
