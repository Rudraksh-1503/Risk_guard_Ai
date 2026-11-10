"""
Claim volume forecasting using simple time-series methods.
Works on any dataset with a date column and a numeric value column.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional

from app.services.analysis_service import load_dataframe, classify_columns


def get_forecast_analytics(file_path: str, periods: int = 6) -> Dict[str, Any]:
    df = load_dataframe(file_path)
    col_types = classify_columns(df)
    lower = {c.lower().replace("_", "").replace(" ", ""): c for c in df.columns}

    date_cols = [c for c, t in col_types.items() if t == "date"]
    num_cols = [c for c, t in col_types.items() if t == "numerical"]

    # Try to find date column
    date_col = None
    for key in ["claimdate", "date", "servicedate", "admissiondate", "dischargedate",
                "transactiondate", "invoicedate", "month", "year"]:
        if key in lower:
            date_col = lower[key]
            break
    if not date_col and date_cols:
        date_col = date_cols[0]

    # Try to parse date column even if not classified
    if not date_col:
        for col in df.columns:
            try:
                parsed = pd.to_datetime(df[col], errors="coerce")
                if parsed.notna().mean() > 0.7:
                    date_col = col
                    break
            except Exception:
                pass

    if not date_col:
        return {"compatible": False, "message": "No date column found for forecasting."}

    amount_col = None
    for key in ["claimamount", "amount", "charges", "totalcharges", "cost", "reimbursedamount"]:
        if key in lower:
            amount_col = lower[key]
            break
    if not amount_col and num_cols:
        amount_col = num_cols[0]

    if not amount_col:
        return {"compatible": False, "message": "No numeric column found for forecasting."}

    # Build monthly time series
    df2 = df[[date_col, amount_col]].copy()
    df2[date_col] = pd.to_datetime(df2[date_col], errors="coerce")
    df2 = df2.dropna(subset=[date_col, amount_col])
    df2["period"] = df2[date_col].dt.to_period("M")
    monthly = df2.groupby("period")[amount_col].agg(["sum", "count", "mean"]).reset_index()
    monthly["period_str"] = monthly["period"].astype(str)
    monthly = monthly.sort_values("period")

    if len(monthly) < 3:
        return {"compatible": False, "message": "Need at least 3 months of data for forecasting."}

    history = [
        {"month": r["period_str"], "total": round(float(r["sum"]), 2),
         "count": int(r["count"]), "avg": round(float(r["mean"]), 2)}
        for _, r in monthly.iterrows()
    ]

    # Simple moving average forecast
    values = monthly["sum"].values
    window = min(3, len(values))
    ma = float(np.mean(values[-window:]))
    trend = float((values[-1] - values[0]) / max(len(values) - 1, 1))

    forecast = []
    last_period = monthly["period"].iloc[-1]
    for i in range(1, periods + 1):
        next_p = last_period + i
        projected = max(0, ma + trend * i * 0.5)
        lower_b = projected * 0.85
        upper_b = projected * 1.15
        forecast.append({
            "month": str(next_p),
            "forecast": round(float(projected), 2),
            "lower_bound": round(float(lower_b), 2),
            "upper_bound": round(float(upper_b), 2),
        })

    # YoY comparison
    yoy = []
    if len(monthly) >= 13:
        for i in range(12, len(monthly)):
            curr = float(monthly["sum"].iloc[i])
            prev = float(monthly["sum"].iloc[i - 12])
            change = round((curr - prev) / prev * 100, 2) if prev else 0
            yoy.append({
                "month": monthly["period_str"].iloc[i],
                "current": round(curr, 2),
                "previous_year": round(prev, 2),
                "change_pct": change,
            })

    summary = {
        "total_months": len(monthly),
        "total_amount": round(float(values.sum()), 2),
        "avg_monthly": round(float(values.mean()), 2),
        "trend_direction": "increasing" if trend > 0 else "decreasing",
        "trend_amount": round(float(trend), 2),
        "date_column": date_col,
        "amount_column": amount_col,
    }

    return {
        "compatible": True,
        "summary": summary,
        "history": history,
        "forecast": forecast,
        "yoy_comparison": yoy,
    }
