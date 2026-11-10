from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.core.database import Base


class ClaimStatus(str, enum.Enum):
    SUBMITTED   = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED    = "approved"
    PARTIALLY_APPROVED = "partially_approved"
    REJECTED    = "rejected"
    INFO_REQUIRED = "info_required"


class ClaimType(str, enum.Enum):
    MEDICAL     = "medical"
    DENTAL      = "dental"
    VISION      = "vision"
    PHARMACY    = "pharmacy"
    EMERGENCY   = "emergency"
    SPECIALIST  = "specialist"
    HOSPITALIZATION = "hospitalization"
    MATERNITY   = "maternity"
    MENTAL_HEALTH = "mental_health"
    OTHER       = "other"


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    full_name     = Column(String(200), nullable=False)
    email         = Column(String(200), nullable=False, unique=True, index=True)
    phone         = Column(String(20), nullable=True)
    password_hash = Column(String(300), nullable=False)
    role          = Column(String(20), default="user")   # user | admin | authority
    policy_number = Column(String(50), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    is_active     = Column(Boolean, default=True)

    claims = relationship("InsuranceClaim", back_populates="user", foreign_keys="InsuranceClaim.user_id")


class InsuranceClaim(Base):
    __tablename__ = "insurance_claims"

    id              = Column(Integer, primary_key=True, index=True)
    claim_number    = Column(String(30), nullable=False, unique=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Claim details
    claim_type      = Column(String(50), nullable=False)
    incident_date   = Column(DateTime, nullable=False)
    description     = Column(Text, nullable=False)
    hospital_name   = Column(String(200), nullable=True)
    doctor_name     = Column(String(200), nullable=True)
    diagnosis       = Column(String(300), nullable=True)
    treatment       = Column(String(300), nullable=True)

    # Financial
    claimed_amount  = Column(Float, nullable=False)
    approved_amount = Column(Float, nullable=True)

    # Policy
    policy_number   = Column(String(50), nullable=True)
    policy_type     = Column(String(100), nullable=True)
    insured_name    = Column(String(200), nullable=True)
    insured_dob     = Column(String(20), nullable=True)
    insured_gender  = Column(String(10), nullable=True)
    insured_phone   = Column(String(20), nullable=True)

    # Status & admin
    status          = Column(String(30), default=ClaimStatus.SUBMITTED)
    priority        = Column(String(10), default="normal")  # low|normal|high|urgent
    admin_notes     = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    reviewed_by     = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at     = Column(DateTime, nullable=True)
    submitted_at    = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow)

    # Flags
    fraud_score     = Column(Float, nullable=True)
    is_flagged      = Column(Boolean, default=False)
    flag_reason     = Column(String(300), nullable=True)

    user     = relationship("User", back_populates="claims", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    documents = relationship("ClaimDocument", back_populates="claim", cascade="all, delete-orphan")
    history   = relationship("ClaimStatusHistory", back_populates="claim", cascade="all, delete-orphan")


class ClaimDocument(Base):
    __tablename__ = "claim_documents"

    id            = Column(Integer, primary_key=True, index=True)
    claim_id      = Column(Integer, ForeignKey("insurance_claims.id"), nullable=False)
    doc_type      = Column(String(100), nullable=False)  # bill, prescription, discharge, id_proof, etc.
    original_name = Column(String(255), nullable=False)
    stored_name   = Column(String(255), nullable=False, unique=True)
    file_path     = Column(String(500), nullable=False)
    file_size     = Column(Integer, nullable=False)
    mime_type     = Column(String(100), nullable=True)
    uploaded_at   = Column(DateTime, default=datetime.utcnow)

    claim = relationship("InsuranceClaim", back_populates="documents")


class ClaimStatusHistory(Base):
    __tablename__ = "claim_status_history"

    id         = Column(Integer, primary_key=True, index=True)
    claim_id   = Column(Integer, ForeignKey("insurance_claims.id"), nullable=False)
    old_status = Column(String(30), nullable=True)
    new_status = Column(String(30), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes      = Column(Text, nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow)

    claim = relationship("InsuranceClaim", back_populates="history")
