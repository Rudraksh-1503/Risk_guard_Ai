"""
Fraud detection analytics. All computed from the actual uploaded dataset.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any

from app.services.analysis_service import load_dataframe


def _safe(v):
    if isinstance(v, (np.integer,)): return int(v)
    if isinstance(v, (np.floating,)): return None if np.isnan(v) else float(v)
    return v


def get_fraud_analytics(file_path: str) -> Dict[str, Any]:
    df = load_dataframe(file_path)
    lower = {c.lower().replace("_", "").replace(" ", ""): c for c in df.columns}

    fraud_col = next((lower[k] for k in
                      ["fraud", "fraudlabel", "isfraud", "fraudulent", "potentialfraud", "label"]
                      if k in lower), None)
    amount_col = next((lower[k] for k in
                       ["claimamount", "amount", "reimbursedamount", "totalclaimamount", "charges", "cost"]
                       if k in lower), None)
    provider_col = next((lower[k] for k in
                         ["provider", "providerid", "physician", "doctor", "hospital"]
                         if k in lower), None)
    date_col = next((lower[k] for k in
                     ["claimdate", "date", "servicedate", "admissiondate"]
                     if k in lower), None)

    result: Dict[str, Any] = {}

    if not fraud_col:
        result["compatible"] = False
        result["message"] = "No fraud label column found. Upload a labeled fraud dataset."
        # still provide basic claim analytics if amount exists
        if amount_col:
            result["claim_summary"] = _claim_summary(df, amount_col, provider_col)
        return result

    result["compatible"] = True
    result["fraud_column"] = fraud_col

    # normalise fraud values to boolean
    fraud_series = df[fraud_col].astype(str).str.lower()
    fraud_mask = fraud_series.isin(["1", "yes", "true", "fraud", "1.0"])

    total = len(df)
    fraud_count = int(fraud_mask.sum())
    legit_count = total - fraud_count
    fraud_pct = round(fraud_count / total * 100, 2) if total else 0

    result["overview"] = {
        "total_claims": total,
        "fraud_count": fraud_count,
        "legitimate_count": legit_count,
        "fraud_percentage": fraud_pct,
        "legitimate_percentage": round(100 - fraud_pct, 2),
    }

    result["distribution"] = [
        {"label": "Fraudulent", "value": fraud_count},
        {"label": "Legitimate", "value": legit_count},
    ]

    # amount analysis
    if amount_col:
        df_a = df[amount_col]
        result["amount_analysis"] = {
            "fraud_avg": round(float(df.loc[fraud_mask, amount_col].mean()), 2) if fraud_count else 0,
            "legit_avg": round(float(df.loc[~fraud_mask, amount_col].mean()), 2) if legit_count else 0,
            "fraud_total": round(float(df.loc[fraud_mask, amount_col].sum()), 2) if fraud_count else 0,
            "legit_total": round(float(df.loc[~fraud_mask, amount_col].sum()), 2) if legit_count else 0,
        }

        # high value claims (top 5%)
        threshold = df[amount_col].quantile(0.95)
        high_val = df[df[amount_col] >= threshold]
        high_fraud = high_val[fraud_mask.reindex(high_val.index, fill_value=False)]
        result["high_value_analysis"] = {
            "threshold": round(float(threshold), 2),
            "high_value_count": len(high_val),
            "high_value_fraud_count": len(high_fraud),
            "high_value_fraud_pct": round(len(high_fraud) / len(high_val) * 100, 2) if len(high_val) else 0,
        }

    # provider analysis
    if provider_col:
        grp = df.groupby(provider_col).agg(
            total=(provider_col, "count"),
            fraud_count=(fraud_col, lambda x: (x.astype(str).str.lower().isin(["1","yes","true","fraud","1.0"])).sum())
        ).reset_index()
        grp["fraud_rate"] = (grp["fraud_count"] / grp["total"] * 100).round(2)
        top = grp.sort_values("fraud_rate", ascending=False).head(10)
        result["provider_analysis"] = [
            {"provider": str(r[provider_col]), "total": int(r["total"]),
             "fraud_count": int(r["fraud_count"]), "fraud_rate": float(r["fraud_rate"])}
            for _, r in top.iterrows()
        ]

    # monthly trend
    if date_col:
        try:
            df2 = df.copy()
            df2[date_col] = pd.to_datetime(df2[date_col], errors="coerce")
            df2 = df2.dropna(subset=[date_col])
            df2["month"] = df2[date_col].dt.to_period("M").astype(str)
            grp = df2.groupby("month").agg(
                total=(fraud_col, "count"),
                fraud_cnt=(fraud_col, lambda x: (x.astype(str).str.lower().isin(["1","yes","true","fraud","1.0"])).sum())
            ).reset_index()
            result["monthly_trend"] = [
                {"month": r["month"], "total": int(r["total"]), "fraud": int(r["fraud_cnt"])}
                for _, r in grp.tail(24).iterrows()
            ]
        except Exception:
            pass

    return result


def _claim_summary(df, amount_col, provider_col):
    summary = {
        "total_claims": len(df),
        "total_amount": round(float(df[amount_col].sum()), 2),
        "avg_amount": round(float(df[amount_col].mean()), 2),
        "max_amount": round(float(df[amount_col].max()), 2),
        "min_amount": round(float(df[amount_col].min()), 2),
    }
    if provider_col:
        grp = df.groupby(provider_col)[amount_col].sum().nlargest(10).reset_index()
        summary["top_providers"] = [
            {"provider": str(r[provider_col]), "total": round(float(r[amount_col]), 2)}
            for _, r in grp.iterrows()
        ]
    return summary
