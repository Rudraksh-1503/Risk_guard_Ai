import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FileText, Plus, Eye, Download, Clock, CheckCircle, XCircle,
  AlertTriangle, Info, ChevronDown, ChevronUp, RefreshCw
} from "lucide-react";
import { claimsAPI } from "../services/api";
import { fmtDate, fmtNumber } from "../utils/format";

const STATUS_CONFIG = {
  submitted:          { color: "#2563eb", bg: "#dbeafe", icon: Clock,         label: "Submitted" },
  under_review:       { color: "#d97706", bg: "#fef3c7", icon: Eye,           label: "Under Review" },
  approved:           { color: "#22c55e", bg: "#dcfce7", icon: CheckCircle,   label: "Approved" },
  partially_approved: { color: "#059669", bg: "#d1fae5", icon: CheckCircle,   label: "Partially Approved" },
  rejected:           { color: "#ef4444", bg: "#fee2e2", icon: XCircle,       label: "Rejected" },
  info_required:      { color: "#f59e0b", bg: "#fef3c7", icon: AlertTriangle, label: "Info Required" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: "#64748b", bg: "#f1f5f9", label: status };
  const Icon = cfg.icon || Info;
  return (
    <span className="status-badge" style={{ color: cfg.color, background: cfg.bg }}>
      <Icon size={12}/> {cfg.label}
    </span>
  );
}

function ClaimCard({ claim }) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState([]);

  const loadHistory = async () => {
    if (!expanded) {
      try {
        const res = await claimsAPI.getHistory(claim.id);
        setHistory(res.data);
      } catch {}
    }
    setExpanded(e => !e);
  };

  return (
    <div className="claim-card">
      <div className="claim-card-header" onClick={loadHistory}>
        <div className="claim-card-id">
          <FileText size={16} color="#2563eb"/>
          <strong>{claim.claim_number}</strong>
          <StatusBadge status={claim.status}/>
          {claim.is_flagged && <span className="badge badge-error">⚠ Flagged</span>}
        </div>
        <div className="claim-card-meta">
          <span className="badge badge-cat">{claim.claim_type?.replace(/_/g," ")}</span>
          <span className="muted">{fmtDate(claim.submitted_at)}</span>
          <span className="claim-amount">${fmtNumber(claim.claimed_amount)}</span>
          {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </div>
      </div>

      {expanded && (
        <div className="claim-card-body">
          <div className="claim-details-grid">
            <div className="cd-row"><span>Hospital</span><span>{claim.hospital_name || "—"}</span></div>
            <div className="cd-row"><span>Doctor</span><span>{claim.doctor_name || "—"}</span></div>
            <div className="cd-row"><span>Diagnosis</span><span>{claim.diagnosis || "—"}</span></div>
            <div className="cd-row"><span>Treatment</span><span>{claim.treatment || "—"}</span></div>
            <div className="cd-row"><span>Policy #</span><span>{claim.policy_number || "—"}</span></div>
            <div className="cd-row"><span>Incident Date</span><span>{claim.incident_date?.slice(0,10)}</span></div>
            {claim.approved_amount && (
              <div className="cd-row highlight"><span>Approved Amount</span><strong style={{color:"#22c55e"}}>${fmtNumber(claim.approved_amount)}</strong></div>
            )}
            {claim.rejection_reason && (
              <div className="cd-row highlight"><span>Rejection Reason</span><span style={{color:"#ef4444"}}>{claim.rejection_reason}</span></div>
            )}
            {claim.admin_notes && (
              <div className="cd-row highlight"><span>Admin Notes</span><span>{claim.admin_notes}</span></div>
            )}
          </div>

          {/* Documents */}
          {claim.documents?.length > 0 && (
            <div className="claim-docs">
              <h5>Attached Documents ({claim.documents.length})</h5>
              <div className="doc-list">
                {claim.documents.map((doc) => (
                  <div key={doc.id} className="doc-item">
                    <FileText size={15} color="#7c3aed"/>
                    <div className="doc-info">
                      <span className="doc-name">{doc.original_name}</span>
                      <span className="badge badge-cat">{doc.doc_type}</span>
                    </div>
                    <a href={claimsAPI.downloadDoc(doc.id)} className="btn-secondary sm" download>
                      <Download size={12}/> Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {history.length > 0 && (
            <div className="claim-timeline">
              <h5>Status History</h5>
              {history.map((h, i) => (
                <div key={i} className="timeline-item">
                  <div className="timeline-dot" style={{background: STATUS_CONFIG[h.new_status]?.color || "#64748b"}}/>
                  <div>
                    <span><strong>{h.new_status?.replace(/_/g," ")}</strong>{h.old_status ? ` ← ${h.old_status.replace(/_/g," ")}` : ""}</span>
                    <span className="muted" style={{marginLeft:".5rem"}}>{fmtDate(h.changed_at)}</span>
                    {h.notes && <p className="muted" style={{marginTop:".15rem"}}>{h.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MyClaims() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await claimsAPI.myClaims();
      setClaims(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? claims : claims.filter(c => c.status === filter);

  const counts = {};
  claims.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });

  return (
    <div className="page-content">
      <div className="page-title" style={{justifyContent:"space-between",flexWrap:"wrap",gap:".75rem"}}>
        <div style={{display:"flex",alignItems:"center",gap:".5rem"}}>
          <FileText size={22}/>
          <h2>My Claims</h2>
          <span className="muted">({claims.length} total)</span>
        </div>
        <div style={{display:"flex",gap:".5rem"}}>
          <button className="btn-icon" onClick={load}><RefreshCw size={15}/></button>
          <Link to="/submit-claim" className="btn-primary"><Plus size={15}/> New Claim</Link>
        </div>
      </div>

      {/* Status filter */}
      <div className="status-filter">
        {[["all","All"],["submitted","Submitted"],["under_review","Under Review"],["approved","Approved"],["rejected","Rejected"],["info_required","Info Required"]].map(([v,l]) => (
          <button key={v} className={`chip${filter===v?" active":""}`} onClick={() => setFilter(v)}>
            {l} {v!=="all" && counts[v] ? <span className="chip-count">{counts[v]}</span> : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-banner"><RefreshCw size={15} className="spin"/> Loading claims…</div>
      ) : filtered.length === 0 ? (
        <div className="ds-empty">
          <FileText size={48} color="#cbd5e1"/>
          <h3>{filter === "all" ? "No claims yet" : `No ${filter.replace(/_/g," ")} claims`}</h3>
          {filter === "all" && <Link to="/submit-claim" className="btn-primary"><Plus size={15}/> Submit Your First Claim</Link>}
        </div>
      ) : (
        <div className="claims-list">
          {filtered.map(c => <ClaimCard key={c.id} claim={c}/>)}
        </div>
      )}
    </div>
  );
}
