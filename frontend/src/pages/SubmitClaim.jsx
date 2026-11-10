import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import {
  FileText, Upload, Trash2, CheckCircle, AlertCircle,
  User, DollarSign, FileSpreadsheet
} from "lucide-react";
import { claimsAPI } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { fmtBytes } from "../utils/format";

const CLAIM_TYPES = ["medical","dental","vision","pharmacy","emergency","specialist","hospitalization","maternity","mental_health","other"];
const DOC_TYPES   = ["Hospital Bill","Doctor Prescription","Discharge Summary","Lab Report","ID Proof","Policy Document","X-Ray / Scan","Other"];

const STEPS = ["Claim Details", "Medical Info", "Policy & Insured", "Documents", "Review & Submit"];

export default function SubmitClaim() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState("");
  const [files, setFiles] = useState([]);  // [{file, docType}]

  const [form, setForm] = useState({
    claim_type: "medical",
    incident_date: "",
    description: "",
    hospital_name: "",
    doctor_name: "",
    diagnosis: "",
    treatment: "",
    claimed_amount: "",
    policy_number: user?.policy_number || "",
    policy_type: "",
    insured_name: user?.full_name || "",
    insured_dob: "",
    insured_gender: "",
    insured_phone: user?.phone || "",
  });

  const set = (k) => (e) => setForm(p => ({...p, [k]: e.target.value}));

  const onDrop = useCallback((accepted) => {
    setFiles(prev => [...prev, ...accepted.map(f => ({ file: f, docType: "Other" }))]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "image/*": [".jpg",".jpeg",".png",".webp"], "application/msword": [".doc"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    maxSize: 20 * 1024 * 1024,
    multiple: true,
  });

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));
  const setDocType = (i, type) => setFiles(prev => prev.map((f, idx) => idx === i ? {...f, docType: type} : f));

  const handleSubmit = async () => {
    setSubmitting(true); setError("");
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    files.forEach(({ file }) => fd.append("files", file));
    fd.append("doc_types", files.map(f => f.docType).join(","));
    try {
      const res = await claimsAPI.submit(fd);
      setSubmitted(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Submission failed. Please try again.");
    }
    setSubmitting(false);
  };

  if (submitted) return (
    <div className="submit-success">
      <CheckCircle size={64} color="#22c55e" />
      <h2>Claim Submitted Successfully!</h2>
      <div className="claim-ref">
        <span>Claim Number</span>
        <strong>{submitted.claim_number}</strong>
      </div>
      <p className="muted">Your claim is now under review. You can track its status in My Claims.</p>
      <div className="success-actions">
        <button className="btn-primary" onClick={() => nav("/my-claims")}>View My Claims</button>
        <button className="btn-secondary" onClick={() => { setSubmitted(null); setStep(0); setFiles([]); setForm(f=>({...f, incident_date:"", description:"", claimed_amount:""})); }}>Submit Another</button>
      </div>
    </div>
  );

  const canNext = () => {
    if (step === 0) return form.claim_type && form.incident_date && form.description && form.claimed_amount;
    return true;
  };

  return (
    <div className="submit-claim-page">
      <div className="claim-header">
        <FileText size={22} color="#2563eb" />
        <div>
          <h2>Submit Insurance Claim</h2>
          <p className="muted">Fill in all required details and upload supporting documents.</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="steps-bar">
        {STEPS.map((s, i) => (
          <div key={i} className={`step-item${i === step ? " active" : i < step ? " done" : ""}`} onClick={() => i < step && setStep(i)}>
            <div className="step-num">{i < step ? <CheckCircle size={14}/> : i + 1}</div>
            <span>{s}</span>
          </div>
        ))}
      </div>

      <div className="claim-form-card">

        {/* Step 0 — Claim Details */}
        {step === 0 && (
          <div className="step-content">
            <h3><FileText size={16}/> Claim Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Claim Type *</label>
                <select className="input" value={form.claim_type} onChange={set("claim_type")}>
                  {CLAIM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Incident / Service Date *</label>
                <input className="input" type="date" value={form.incident_date} onChange={set("incident_date")} max={new Date().toISOString().split("T")[0]} required />
              </div>
              <div className="form-group">
                <label>Claimed Amount (USD) *</label>
                <input className="input" type="number" min="1" value={form.claimed_amount} onChange={set("claimed_amount")} placeholder="e.g. 2500.00" required />
              </div>
            </div>
            <div className="form-group">
              <label>Description of Incident / Services *</label>
              <textarea className="input textarea" rows={4} value={form.description} onChange={set("description")} placeholder="Describe what happened, the services received, or why you are filing this claim…" required />
            </div>
          </div>
        )}

        {/* Step 1 — Medical Info */}
        {step === 1 && (
          <div className="step-content">
            <h3><User size={16}/> Medical Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Hospital / Clinic Name</label>
                <input className="input" value={form.hospital_name} onChange={set("hospital_name")} placeholder="City General Hospital" />
              </div>
              <div className="form-group">
                <label>Attending Doctor</label>
                <input className="input" value={form.doctor_name} onChange={set("doctor_name")} placeholder="Dr. Jane Smith" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Diagnosis / Condition</label>
                <input className="input" value={form.diagnosis} onChange={set("diagnosis")} placeholder="e.g. Acute Appendicitis" />
              </div>
              <div className="form-group">
                <label>Treatment / Procedure</label>
                <input className="input" value={form.treatment} onChange={set("treatment")} placeholder="e.g. Appendectomy" />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Policy & Insured */}
        {step === 2 && (
          <div className="step-content">
            <h3><DollarSign size={16}/> Policy & Insured Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Policy Number</label>
                <input className="input" value={form.policy_number} onChange={set("policy_number")} placeholder="POL123456" />
              </div>
              <div className="form-group">
                <label>Policy Type</label>
                <select className="input" value={form.policy_type} onChange={set("policy_type")}>
                  <option value="">Select…</option>
                  {["Individual","Family","Group","Senior Citizen","Critical Illness","Accident"].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Insured Person Name</label>
                <input className="input" value={form.insured_name} onChange={set("insured_name")} placeholder="Full name" />
              </div>
              <div className="form-group">
                <label>Date of Birth</label>
                <input className="input" type="date" value={form.insured_dob} onChange={set("insured_dob")} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Gender</label>
                <select className="input" value={form.insured_gender} onChange={set("insured_gender")}>
                  <option value="">Select…</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Contact Phone</label>
                <input className="input" value={form.insured_phone} onChange={set("insured_phone")} placeholder="+1 555 000 0000" />
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Documents */}
        {step === 3 && (
          <div className="step-content">
            <h3><FileSpreadsheet size={16}/> Upload Documents</h3>
            <p className="muted" style={{marginBottom:".75rem"}}>Upload hospital bills, prescriptions, discharge summaries or any supporting documents. PDF, JPG, PNG up to 20 MB each.</p>

            <div {...getRootProps()} className={`dropzone${isDragActive?" drag-active":""}`} style={{marginBottom:"1rem"}}>
              <input {...getInputProps()} />
              <div className="dropzone-idle">
                <Upload size={36} color="#94a3b8" />
                <p className="dz-title">{isDragActive ? "Drop files here…" : "Drag & drop documents or click to browse"}</p>
                <p className="dz-sub">PDF · JPG · PNG · DOC · Max 20 MB per file</p>
              </div>
            </div>

            {files.length > 0 && (
              <div className="doc-list">
                {files.map((f, i) => (
                  <div key={i} className="doc-item">
                    <FileText size={18} color="#2563eb" />
                    <div className="doc-info">
                      <span className="doc-name">{f.file.name}</span>
                      <span className="doc-size">{fmtBytes(f.file.size)}</span>
                    </div>
                    <select className="input" style={{width:"auto",padding:".25rem .5rem",fontSize:".78rem"}}
                      value={f.docType} onChange={(e) => setDocType(i, e.target.value)}>
                      {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button className="btn-icon" onClick={() => removeFile(i)}><Trash2 size={14} color="#ef4444"/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 4 && (
          <div className="step-content">
            <h3><CheckCircle size={16}/> Review & Submit</h3>
            <div className="review-grid">
              <div className="review-section">
                <h4>Claim Details</h4>
                <table className="review-table">
                  <tbody>
                    <tr><td>Type</td><td><strong>{form.claim_type}</strong></td></tr>
                    <tr><td>Date</td><td>{form.incident_date}</td></tr>
                    <tr><td>Amount</td><td><strong>${Number(form.claimed_amount).toLocaleString()}</strong></td></tr>
                    <tr><td>Description</td><td>{form.description}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="review-section">
                <h4>Medical Info</h4>
                <table className="review-table">
                  <tbody>
                    <tr><td>Hospital</td><td>{form.hospital_name || "—"}</td></tr>
                    <tr><td>Doctor</td><td>{form.doctor_name || "—"}</td></tr>
                    <tr><td>Diagnosis</td><td>{form.diagnosis || "—"}</td></tr>
                    <tr><td>Treatment</td><td>{form.treatment || "—"}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="review-section">
                <h4>Policy Info</h4>
                <table className="review-table">
                  <tbody>
                    <tr><td>Policy #</td><td>{form.policy_number || "—"}</td></tr>
                    <tr><td>Policy Type</td><td>{form.policy_type || "—"}</td></tr>
                    <tr><td>Insured</td><td>{form.insured_name}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="review-section">
                <h4>Documents ({files.length})</h4>
                {files.length === 0 ? <p className="muted">No documents attached.</p> :
                  files.map((f, i) => <div key={i} className="doc-mini">{f.file.name} <span className="badge badge-uploaded">{f.docType}</span></div>)
                }
              </div>
            </div>
            {error && <div className="error-banner"><AlertCircle size={15}/> {error}</div>}
          </div>
        )}

        {/* Navigation */}
        <div className="step-nav">
          {step > 0 && <button className="btn-secondary" onClick={() => setStep(s => s - 1)}>← Back</button>}
          <div style={{flex:1}}/>
          {step < STEPS.length - 1 && (
            <button className="btn-primary" onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
              Next →
            </button>
          )}
          {step === STEPS.length - 1 && (
            <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Claim"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
