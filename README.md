# Risk Guard AI v2.1

A complete healthcare insurance intelligence platform with dynamic dataset analysis, ML training, and a full insurance claims portal with admin review.

---

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm start
```

- Frontend: http://localhost:3000  
- API Docs: http://localhost:8000/docs

---

## Default Demo Accounts

| Role      | Email                     | Password   |
|-----------|---------------------------|------------|
| Admin     | admin@riskguard.ai        | Admin@123  |
| Authority | authority@riskguard.ai    | Auth@123   |
| User      | john@example.com          | User@123   |

---

## Default Datasets (auto-loaded on startup)

| Dataset | Rows | Category |
|---------|------|----------|
| Insurance Premium | 1,338 | Health Insurance Premium |
| Healthcare Claims | 2,000 | Healthcare Claims |
| Fraud Detection | 5,000 | Fraud Detection (637 fraud cases) |
| Patient Records | 800 | Patient Records |

---

## Application Modules

### Claims Portal
| Page | Role | Description |
|------|------|-------------|
| `/login` | All | Sign in |
| `/register` | All | Create account |
| `/submit-claim` | User | 5-step claim submission with document upload |
| `/my-claims` | User | View all own claims + status history |
| `/admin` | Admin/Authority | Review all claims, approve/reject, flag fraud |

### AI Analytics
| Page | Description |
|------|-------------|
| `/datasets` | Upload CSV/Excel, auto-analyze, train models |
| `/premium` | Insurance premium analytics + live prediction |
| `/fraud` | Fraud pattern detection and visualization |
| `/forecast` | Time-series claim volume forecasting |
| `/explainable` | Feature importance explanation |
| `/whatif` | Multi-scenario model simulation |
| `/models` | Trained model registry |

---

## Claims Workflow

```
User submits claim (5-step form + document upload)
        ↓
Claim visible in Admin Panel with status = "submitted"
        ↓
Admin/Authority reviews: sets status, approved amount, notes
        ↓
User sees updated status in My Claims with full history
```

## Claim Statuses
- `submitted` → `under_review` → `approved` / `partially_approved` / `rejected` / `info_required`

---

## API Endpoints (32 total)

### Auth
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — get JWT token
- `GET  /api/auth/me` — current user

### Claims
- `POST   /api/claims` — submit claim (multipart with documents)
- `GET    /api/claims/my` — user's own claims
- `GET    /api/claims` — all claims (admin only)
- `GET    /api/claims/admin/stats` — dashboard stats (admin only)
- `GET    /api/claims/{id}` — single claim
- `PATCH  /api/claims/{id}/review` — approve/reject (admin only)
- `POST   /api/claims/{id}/documents` — add document
- `GET    /api/claims/{id}/history` — status timeline
- `GET    /api/claims/documents/{id}/download` — download document

### Datasets (13 endpoints), Premium, Fraud, Forecast, Explain (8 endpoints)

---

## Tech Stack

**Backend:** FastAPI, SQLAlchemy (async), pandas, scikit-learn, ReportLab, PyJWT, bcrypt, SQLite  
**Frontend:** React 18, Recharts, React Router, React Dropzone, Lucide Icons, Axios
# Risk_guard_Ai
