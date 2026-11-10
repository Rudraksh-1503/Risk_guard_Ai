"""
Insurance claims submission, document upload, and admin review routes.
All relationship loading is explicit (selectinload) to work with async SQLAlchemy.
"""
import uuid
from pathlib import Path
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.config import settings
from app.models.claims import InsuranceClaim, ClaimDocument, ClaimStatusHistory, User, ClaimStatus
from app.api.routes.auth import get_current_user, require_admin

router = APIRouter(prefix="/api/claims", tags=["claims"])

DOCS_DIR = settings.UPLOAD_DIR / "claim_docs"
DOCS_DIR.mkdir(exist_ok=True)

ALLOWED_DOC_TYPES = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx", ".txt"}
MAX_DOC_SIZE = 20 * 1024 * 1024  # 20 MB


# ── helpers ────────────────────────────────────────────────────────────────

def _claim_number() -> str:
    import random, string
    return "CLM" + "".join(random.choices(string.digits, k=9))


def _claim_dict(c: InsuranceClaim, include_docs=True):
    """Serialise claim. Assumes relationships already eagerly loaded."""
    d = {
        "id": c.id, "claim_number": c.claim_number, "claim_type": c.claim_type,
        "incident_date": c.incident_date.isoformat() if c.incident_date else None,
        "description": c.description, "hospital_name": c.hospital_name,
        "doctor_name": c.doctor_name, "diagnosis": c.diagnosis, "treatment": c.treatment,
        "claimed_amount": c.claimed_amount, "approved_amount": c.approved_amount,
        "policy_number": c.policy_number, "policy_type": c.policy_type,
        "insured_name": c.insured_name, "insured_dob": c.insured_dob,
        "insured_gender": c.insured_gender, "insured_phone": c.insured_phone,
        "status": c.status, "priority": c.priority,
        "admin_notes": c.admin_notes, "rejection_reason": c.rejection_reason,
        "fraud_score": c.fraud_score, "is_flagged": c.is_flagged, "flag_reason": c.flag_reason,
        "submitted_at": c.submitted_at.isoformat() if c.submitted_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "reviewed_at": c.reviewed_at.isoformat() if c.reviewed_at else None,
        "user_id": c.user_id,
        "user_name": c.user.full_name if c.user else None,
        "user_email": c.user.email if c.user else None,
        "reviewer_name": c.reviewer.full_name if c.reviewer else None,
        "documents": [_doc_dict(doc) for doc in c.documents] if include_docs else [],
    }
    return d


def _doc_dict(doc: ClaimDocument):
    return {
        "id": doc.id, "doc_type": doc.doc_type,
        "original_name": doc.original_name, "file_size": doc.file_size,
        "mime_type": doc.mime_type,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        "download_url": f"/api/claims/documents/{doc.id}/download",
    }


async def _load_claim(claim_id: int, db: AsyncSession) -> InsuranceClaim:
    """Load claim with all relationships eagerly."""
    res = await db.execute(
        select(InsuranceClaim)
        .options(
            selectinload(InsuranceClaim.user),
            selectinload(InsuranceClaim.reviewer),
            selectinload(InsuranceClaim.documents),
        )
        .where(InsuranceClaim.id == claim_id)
    )
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Claim not found")
    return c


async def _load_claims(q, db: AsyncSession):
    """Execute a claims query with eager relationship loading."""
    q = q.options(
        selectinload(InsuranceClaim.user),
        selectinload(InsuranceClaim.reviewer),
        selectinload(InsuranceClaim.documents),
    )
    res = await db.execute(q)
    return res.scalars().all()


# ── USER: submit claim ─────────────────────────────────────────────────────

@router.post("")
async def submit_claim(
    claim_type:     str   = Form(...),
    incident_date:  str   = Form(...),
    description:    str   = Form(...),
    hospital_name:  str   = Form(""),
    doctor_name:    str   = Form(""),
    diagnosis:      str   = Form(""),
    treatment:      str   = Form(""),
    claimed_amount: float = Form(...),
    policy_number:  str   = Form(""),
    policy_type:    str   = Form(""),
    insured_name:   str   = Form(""),
    insured_dob:    str   = Form(""),
    insured_gender: str   = Form(""),
    insured_phone:  str   = Form(""),
    files:          List[UploadFile] = File(default=[]),
    doc_types:      str   = Form(""),
    db: AsyncSession     = Depends(get_db),
    current_user: User   = Depends(get_current_user),
):
    claim = InsuranceClaim(
        claim_number    = _claim_number(),
        user_id         = current_user.id,
        claim_type      = claim_type,
        incident_date   = datetime.fromisoformat(incident_date),
        description     = description,
        hospital_name   = hospital_name or None,
        doctor_name     = doctor_name or None,
        diagnosis       = diagnosis or None,
        treatment       = treatment or None,
        claimed_amount  = claimed_amount,
        policy_number   = policy_number or current_user.policy_number,
        policy_type     = policy_type or None,
        insured_name    = insured_name or current_user.full_name,
        insured_dob     = insured_dob or None,
        insured_gender  = insured_gender or None,
        insured_phone   = insured_phone or current_user.phone,
        status          = ClaimStatus.SUBMITTED,
        priority        = "normal",
    )
    db.add(claim)
    await db.flush()

    type_labels = [t.strip() for t in doc_types.split(",")] if doc_types else []
    for i, file in enumerate(files):
        if not file or not file.filename:
            continue
        suffix = Path(file.filename).suffix.lower()
        if suffix not in ALLOWED_DOC_TYPES:
            continue
        content = await file.read()
        if len(content) > MAX_DOC_SIZE:
            continue
        stored = f"{uuid.uuid4().hex}{suffix}"
        dest = DOCS_DIR / stored
        dest.write_bytes(content)
        label = type_labels[i] if i < len(type_labels) else "other"
        db.add(ClaimDocument(
            claim_id=claim.id, doc_type=label,
            original_name=file.filename, stored_name=stored,
            file_path=str(dest), file_size=len(content),
            mime_type=file.content_type,
        ))

    db.add(ClaimStatusHistory(
        claim_id=claim.id, old_status=None,
        new_status=ClaimStatus.SUBMITTED,
        changed_by=current_user.id,
        notes="Claim submitted by user.",
    ))

    await db.commit()
    return {"claim_id": claim.id, "claim_number": claim.claim_number, "status": claim.status}


# ── USER: list own claims ──────────────────────────────────────────────────

@router.get("/my")
async def my_claims(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (select(InsuranceClaim)
         .where(InsuranceClaim.user_id == current_user.id)
         .order_by(desc(InsuranceClaim.submitted_at)))
    claims = await _load_claims(q, db)
    return [_claim_dict(c) for c in claims]


# ── ADMIN: stats (must come BEFORE /{claim_id}) ────────────────────────────

@router.get("/admin/stats")
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    total = (await db.execute(select(func.count()).select_from(InsuranceClaim))).scalar() or 0

    by_status = {}
    for s in ClaimStatus:
        cnt = (await db.execute(
            select(func.count()).select_from(InsuranceClaim)
            .where(InsuranceClaim.status == s.value)
        )).scalar() or 0
        by_status[s.value] = cnt

    total_claimed = (await db.execute(
        select(func.sum(InsuranceClaim.claimed_amount))
    )).scalar() or 0.0

    total_approved = (await db.execute(
        select(func.sum(InsuranceClaim.approved_amount))
    )).scalar() or 0.0

    flagged = (await db.execute(
        select(func.count()).select_from(InsuranceClaim)
        .where(InsuranceClaim.is_flagged == True)  # noqa
    )).scalar() or 0

    # Recent 10 — eagerly loaded
    q = (select(InsuranceClaim)
         .order_by(desc(InsuranceClaim.submitted_at))
         .limit(10))
    recent = await _load_claims(q, db)

    return {
        "total_claims":          total,
        "by_status":             by_status,
        "total_claimed_amount":  round(float(total_claimed), 2),
        "total_approved_amount": round(float(total_approved), 2),
        "flagged_claims":        flagged,
        "recent_claims":         [_claim_dict(c, include_docs=False) for c in recent],
    }


# ── ADMIN: list all claims ─────────────────────────────────────────────────

@router.get("")
async def list_all_claims(
    status:   Optional[str]  = None,
    claim_type: Optional[str] = None,
    priority: Optional[str]  = None,
    flagged:  Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = select(InsuranceClaim).order_by(desc(InsuranceClaim.submitted_at))
    if status:
        q = q.where(InsuranceClaim.status == status)
    if claim_type:
        q = q.where(InsuranceClaim.claim_type == claim_type)
    if priority:
        q = q.where(InsuranceClaim.priority == priority)
    if flagged is not None:
        q = q.where(InsuranceClaim.is_flagged == flagged)
    q = q.offset(skip).limit(limit)
    claims = await _load_claims(q, db)
    return [_claim_dict(c) for c in claims]


# ── USER/ADMIN: single claim ───────────────────────────────────────────────

@router.get("/{claim_id}")
async def get_claim(
    claim_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = await _load_claim(claim_id, db)
    if c.user_id != current_user.id and current_user.role not in ("admin", "authority"):
        raise HTTPException(403, "Access denied")
    return _claim_dict(c)


# ── USER: add document ─────────────────────────────────────────────────────

@router.post("/{claim_id}/documents")
async def add_document(
    claim_id: int,
    file: UploadFile = File(...),
    doc_type: str = Form("other"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = await _load_claim(claim_id, db)
    if c.user_id != current_user.id and current_user.role not in ("admin", "authority"):
        raise HTTPException(403, "Access denied")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_DOC_TYPES:
        raise HTTPException(400, f"File type {suffix} not allowed")

    content = await file.read()
    if len(content) > MAX_DOC_SIZE:
        raise HTTPException(413, "File too large (max 20 MB)")

    stored = f"{uuid.uuid4().hex}{suffix}"
    dest = DOCS_DIR / stored
    dest.write_bytes(content)

    doc = ClaimDocument(
        claim_id=claim_id, doc_type=doc_type,
        original_name=file.filename, stored_name=stored,
        file_path=str(dest), file_size=len(content),
        mime_type=file.content_type,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return _doc_dict(doc)


# ── DOCUMENT download ──────────────────────────────────────────────────────

@router.get("/documents/{doc_id}/download")
async def download_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(select(ClaimDocument).where(ClaimDocument.id == doc_id))
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")

    # Verify access via claim
    res2 = await db.execute(
        select(InsuranceClaim)
        .options(selectinload(InsuranceClaim.user))
        .where(InsuranceClaim.id == doc.claim_id)
    )
    claim = res2.scalar_one_or_none()
    if claim and claim.user_id != current_user.id and current_user.role not in ("admin", "authority"):
        raise HTTPException(403, "Access denied")

    if not Path(doc.file_path).exists():
        raise HTTPException(404, "File not found on server")
    return FileResponse(doc.file_path, filename=doc.original_name,
                        media_type=doc.mime_type or "application/octet-stream")


# ── ADMIN: review / update claim ──────────────────────────────────────────

class ReviewRequest(BaseModel):
    status: str
    approved_amount: Optional[float] = None
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    priority: Optional[str] = None
    is_flagged: Optional[bool] = None
    flag_reason: Optional[str] = None
    fraud_score: Optional[float] = None


@router.patch("/{claim_id}/review")
async def review_claim(
    claim_id: int,
    req: ReviewRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # Load without selectinload for update (we only need the ORM object)
    res = await db.execute(select(InsuranceClaim).where(InsuranceClaim.id == claim_id))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Claim not found")

    old_status = c.status
    c.status      = req.status
    c.reviewed_by = admin.id
    c.reviewed_at = datetime.utcnow()
    c.updated_at  = datetime.utcnow()

    if req.approved_amount is not None:
        c.approved_amount = req.approved_amount
    if req.admin_notes is not None:
        c.admin_notes = req.admin_notes
    if req.rejection_reason is not None:
        c.rejection_reason = req.rejection_reason
    if req.priority is not None:
        c.priority = req.priority
    if req.is_flagged is not None:
        c.is_flagged = req.is_flagged
    if req.flag_reason is not None:
        c.flag_reason = req.flag_reason
    if req.fraud_score is not None:
        c.fraud_score = req.fraud_score

    db.add(ClaimStatusHistory(
        claim_id=claim_id,
        old_status=old_status,
        new_status=req.status,
        changed_by=admin.id,
        notes=req.admin_notes or f"Status changed to {req.status}",
    ))
    await db.commit()

    # Reload with relationships for response
    return _claim_dict(await _load_claim(claim_id, db))


# ── CLAIM status history ───────────────────────────────────────────────────

@router.get("/{claim_id}/history")
async def claim_history(
    claim_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify access
    res = await db.execute(select(InsuranceClaim).where(InsuranceClaim.id == claim_id))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Claim not found")
    if c.user_id != current_user.id and current_user.role not in ("admin", "authority"):
        raise HTTPException(403, "Access denied")

    res2 = await db.execute(
        select(ClaimStatusHistory)
        .where(ClaimStatusHistory.claim_id == claim_id)
        .order_by(ClaimStatusHistory.changed_at)
    )
    history = res2.scalars().all()
    return [
        {"id": h.id, "old_status": h.old_status, "new_status": h.new_status,
         "notes": h.notes, "changed_at": h.changed_at.isoformat()}
        for h in history
    ]
