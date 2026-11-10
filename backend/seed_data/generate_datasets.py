"""
Generate realistic default seed datasets for Risk Guard AI.
Run once: python seed_data/generate_datasets.py
"""
import pandas as pd
import numpy as np
from pathlib import Path

rng = np.random.default_rng(42)
OUT = Path(__file__).parent

# ── 1. Health Insurance Premium Dataset (1 338 rows) ─────────────────────────
n = 1338
age    = rng.integers(18, 65, n)
sex    = rng.choice(["male", "female"], n)
bmi    = np.round(rng.normal(30.6, 6.1, n).clip(15, 55), 1)
children = rng.choice([0,1,2,3,4,5], n, p=[0.43,0.24,0.18,0.10,0.03,0.02])
smoker = rng.choice(["yes","no"], n, p=[0.20, 0.80])
region = rng.choice(["northeast","northwest","southeast","southwest"], n)
charges = (
    age * 230
    + bmi * 180
    + children * 500
    + (smoker == "yes") * 23_000
    + rng.normal(0, 2500, n)
).clip(1121, 63770).round(2)

premium_df = pd.DataFrame({
    "age": age, "sex": sex, "bmi": bmi,
    "children": children, "smoker": smoker,
    "region": region, "charges": charges
})
premium_df.to_csv(OUT / "insurance_premium.csv", index=False)
print(f"✓ insurance_premium.csv  ({len(premium_df)} rows)")

# ── 2. Healthcare Claims Dataset (2 000 rows) ─────────────────────────────────
n = 2000
claim_ids    = [f"CLM{100000+i}" for i in range(n)]
providers    = [f"PROV{rng.integers(1,50):03d}" for _ in range(n)]
dates        = pd.date_range("2022-01-01", periods=n, freq="8h")
procedures   = rng.choice(["OP001","OP002","IP001","IP002","ER001","LAB001","IMG001","PHY001"], n)
diagnoses    = rng.choice(["Z00.00","J18.9","I10","E11.9","M54.5","K21.0","F32.9","N39.0"], n)
billed       = np.round(rng.exponential(2500, n).clip(100, 80000), 2)
approved_pct = rng.uniform(0.5, 1.0, n)
approved     = np.round(billed * approved_pct, 2)
denied       = np.round(billed - approved, 2)
status       = rng.choice(["Approved","Partially Approved","Denied","Pending"], n, p=[0.55,0.20,0.15,0.10])

claims_df = pd.DataFrame({
    "claim_id": claim_ids,
    "provider_id": providers,
    "claim_date": dates.date,
    "procedure_code": procedures,
    "diagnosis_code": diagnoses,
    "billed_amount": billed,
    "approved_amount": approved,
    "denied_amount": denied,
    "claim_status": status,
})
claims_df.to_csv(OUT / "healthcare_claims.csv", index=False)
print(f"✓ healthcare_claims.csv  ({len(claims_df)} rows)")

# ── 3. Healthcare Fraud Detection Dataset (5 000 rows) ───────────────────────
n = 5000
providers_f  = [f"PROV{rng.integers(1,80):03d}" for _ in range(n)]
patient_ids  = [f"PAT{rng.integers(10000,99999)}" for _ in range(n)]
claim_dates  = pd.date_range("2021-01-01", periods=n, freq="4h")
billed_f     = np.round(rng.exponential(3000, n).clip(50, 100000), 2)
reimb        = np.round(billed_f * rng.uniform(0.4, 1.0, n), 2)
deductible   = np.round(rng.uniform(0, 500, n), 2)
admit_days   = rng.integers(0, 15, n)
num_claims   = rng.integers(1, 25, n)
# fraud logic: high billing + many claims + short admit → more likely fraud
fraud_prob   = (
    0.05
    + (billed_f > 15000) * 0.25
    + (num_claims > 15) * 0.20
    + (admit_days < 1) * (billed_f > 8000) * 0.15
)
fraud        = (rng.random(n) < fraud_prob).astype(int)

fraud_df = pd.DataFrame({
    "claim_id":        [f"FC{200000+i}" for i in range(n)],
    "provider_id":     providers_f,
    "patient_id":      patient_ids,
    "claim_date":      claim_dates.date,
    "billed_amount":   billed_f,
    "reimbursed_amount": reimb,
    "deductible":      deductible,
    "admit_days":      admit_days,
    "num_claims":      num_claims,
    "fraud_label":     fraud,
})
fraud_df.to_csv(OUT / "fraud_detection.csv", index=False)
print(f"✓ fraud_detection.csv    ({len(fraud_df)} rows, {fraud.sum()} fraud cases)")

# ── 4. Patient Records Dataset (800 rows) ────────────────────────────────────
n = 800
patient_df = pd.DataFrame({
    "patient_id":   [f"P{10000+i}" for i in range(n)],
    "age":          rng.integers(1, 95, n),
    "gender":       rng.choice(["Male","Female","Other"], n, p=[0.49,0.49,0.02]),
    "bmi":          np.round(rng.normal(27.5, 5.5, n).clip(14, 50), 1),
    "blood_pressure": rng.choice(["Normal","Elevated","High Stage 1","High Stage 2"], n, p=[0.45,0.25,0.20,0.10]),
    "smoker":       rng.choice(["Yes","No"], n, p=[0.18,0.82]),
    "diabetes":     rng.choice(["Yes","No"], n, p=[0.12,0.88]),
    "region":       rng.choice(["North","South","East","West","Central"], n),
    "admission_date": pd.date_range("2020-01-01", periods=n, freq="11h").date,
    "discharge_date": pd.date_range("2020-01-03", periods=n, freq="11h").date,
    "diagnosis":    rng.choice(["Hypertension","Diabetes","Fracture","Pneumonia","Appendicitis","Cardiac"], n),
    "total_charges": np.round(rng.exponential(4000, n).clip(200, 50000), 2),
})
patient_df.to_csv(OUT / "patient_records.csv", index=False)
print(f"✓ patient_records.csv    ({len(patient_df)} rows)")

print("\nAll seed datasets generated successfully.")
