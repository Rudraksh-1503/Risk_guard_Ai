import React, { useState, useEffect, useCallback } from "react";
import {
  Shield, RefreshCw, Eye, CheckCircle, XCircle, AlertTriangle,
  Clock, DollarSign, FileText, ChevronUp,
  Download, Flag, Search, Filter
} from "lucide-react";
import { claimsAPI } from "../services/api";
import { fmtDate, fmtNumber } from "../utils/format";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const STATUS_CONFIG = {
  submitted:          { color: "#2563eb", bg: "#dbeafe", label: "Submitted" },
  under_review:       { color: "#d97706", bg: "#fef3c7", label: "Under Review" },
  approved:           { color: "#22c55e", bg: "#dcfce7", label: "Approved" },
  partially_approved: { color: "#059669", bg: "#d1fae5", label: "Partially Approved" },
  rejected:           { color: "#ef4444", bg: "#fee2e2", label: "Rejected" },
  info_required:      { color: "#f59e0b", bg: "#fef3c7", label: "Info Required" },
};
const COLORS = ["#2563eb","#d97706","#22c55e","#059669","#ef4444","#f59e0b"];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: "#64748b", bg: "#f1f5f9", label: status };
  return <span className="status-badge" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>;
}

function ReviewModal({ claim, onClose, onSaved }) {
  const [form, setForm] = useState({
    status: claim.status,
    approved_amount: claim.approved_amount || claim.claimed_amount,
    admin_notes: claim.admin_notes || "",
    rejection_reason: claim.rejection_reason || "",
    priority: claim.priority || "normal",
    is_flagged: claim.is_flagged || false,
    flag_reason: claim.flag_reason || "",
    fraud_score: claim.fraud_score || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = k => e => setForm(p => ({...p, [k]: e.target.value}));

  const save = async () => {
    setSaving(true); setErr("");
    try {
      await claimsAPI.review(claim.id, {
        ...form,
        approved_amount: form.status !== "rejected" ? Number(form.approved_amount) : null,
        fraud_score: form.fraud_score ? Number(form.fraud_score) : null,
        is_flagged: form.is_flagged,
      });
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.detail || "Save failed");
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal review-modal">
        <div className="modal-header">
          <h3>Review Claim — {claim.claim_number}</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Claim summary */}
        <div className="review-summary">
          <div className="rs-row"><span>Claimant</span><strong>{claim.user_name}</strong></div>
          <div className="rs-row"><span>Type</span><span>{claim.claim_type}</span></div>
          <div className="rs-row"><span>Claimed</span><strong style={{color:"#2563eb"}}>${fmtNumber(claim.claimed_amount)}</strong></div>
          <div className="rs-row"><span>Hospital</span><span>{claim.hospital_name || "—"}</span></div>
          <div className="rs-row"><span>Diagnosis</span><span>{claim.diagnosis || "—"}</span></div>
          <div className="rs-row"><span>Submitted</span><span>{fmtDate(claim.submitted_at)}</span></div>
        </div>

        <p className="review-desc">{claim.description}</p>

        {/* Documents */}
        {claim.documents?.length > 0 && (
          <div className="review-docs">
            <h5>Documents ({claim.documents.length})</h5>
            {claim.documents.map(doc => (
              <div key={doc.id} className="doc-item">
                <FileText size={14} color="#7c3aed"/>
                <span className="doc-name">{doc.original_name}</span>
                <span className="badge badge-cat">{doc.doc_type}</span>
                <a href={claimsAPI.downloadDoc(doc.id)} className="btn-secondary sm" download><Download size={11}/></a>
              </div>
            ))}
          </div>
        )}

        <hr style={{margin:".75rem 0", border:"none", borderTop:"1px solid var(--border)"}}/>

        {/* Review form */}
        <div className="form-row">
          <div className="form-group">
            <label>Decision *</label>
            <select className="input" value={form.status} onChange={set("status")}>
              {Object.entries(STATUS_CONFIG).map(([v,c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Priority</label>
            <select className="input" value={form.priority} onChange={set("priority")}>
              {["low","normal","high","urgent"].map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Approved Amount</label>
            <input className="input" type="number" value={form.approved_amount} onChange={set("approved_amount")} disabled={form.status==="rejected"} />
          </div>
        </div>
        <div className="form-group">
          <label>Admin Notes</label>
          <textarea className="input textarea" rows={2} value={form.admin_notes} onChange={set("admin_notes")} placeholder="Internal notes visible to admins…"/>
        </div>
        {form.status === "rejected" && (
          <div className="form-group">
            <label>Rejection Reason (shown to claimant)</label>
            <textarea className="input textarea" rows={2} value={form.rejection_reason} onChange={set("rejection_reason")} placeholder="Explain why the claim is rejected…"/>
          </div>
        )}
        <div className="form-row">
          <div className="form-group">
            <label>Fraud Score (0–1)</label>
            <input className="input" type="number" min="0" max="1" step="0.01" value={form.fraud_score} onChange={set("fraud_score")} placeholder="0.0–1.0"/>
          </div>
          <div className="form-group" style={{justifyContent:"flex-end"}}>
            <label style={{display:"flex",alignItems:"center",gap:".4rem", cursor:"pointer"}}>
              <input type="checkbox" checked={form.is_flagged} onChange={e=>setForm(p=>({...p,is_flagged:e.target.checked}))}/>
              Flag for investigation
            </label>
            {form.is_flagged && <input className="input" value={form.flag_reason} onChange={set("flag_reason")} placeholder="Flag reason…" style={{marginTop:".25rem"}}/>}
          </div>
        </div>

        {err && <div className="error-banner" style={{marginTop:".5rem"}}><AlertTriangle size={14}/> {err}</div>}

        <div className="modal-actions" style={{marginTop:"1rem"}}>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving?"Saving…":"Save Decision"}</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterFlagged, setFilterFlagged] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState("claims");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        claimsAPI.adminStats(),
        claimsAPI.listAll({ status: filterStatus || undefined, flagged: filterFlagged === "true" ? true : filterFlagged === "false" ? false : undefined }),
      ]);
      setStats(sRes.data);
      setClaims(cRes.data);
    } catch {}
    setLoading(false);
  }, [filterStatus, filterFlagged]);

  useEffect(() => { load(); }, [load]);

  const filtered = claims.filter(c => {
    if (search && !c.claim_number.includes(search) && !c.user_name?.toLowerCase().includes(search.toLowerCase()) && !c.user_email?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && c.claim_type !== filterType) return false;
    return true;
  });

  const statusChartData = stats ? Object.entries(stats.by_status).map(([k, v]) => ({ name: STATUS_CONFIG[k]?.label || k, value: v })) : [];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <Shield size={24} color="#2563eb"/>
        <div>
          <h2>Authority & Admin Panel</h2>
          <p className="muted">Review insurance claims, approve or reject, and monitor fraud.</p>
        </div>
        <button className="btn-icon ml-auto" onClick={load}><RefreshCw size={16} className={loading?"spin":""}/></button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {["claims","analytics"].map(t=>(
          <button key={t} className={`tab${activeTab===t?" active":""}`} onClick={()=>setActiveTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      {/* KPI strip */}
      {stats && (
        <div className="kpi-strip" style={{marginTop:"1rem"}}>
          {[
            {label:"Total Claims",   value: fmtNumber(stats.total_claims),              icon: FileText,       color:"#2563eb"},
            {label:"Pending Review", value: fmtNumber((stats.by_status.submitted||0)+(stats.by_status.under_review||0)), icon: Clock, color:"#d97706"},
            {label:"Approved",       value: fmtNumber(stats.by_status.approved||0),     icon: CheckCircle,    color:"#22c55e"},
            {label:"Rejected",       value: fmtNumber(stats.by_status.rejected||0),     icon: XCircle,        color:"#ef4444"},
            {label:"Flagged",        value: fmtNumber(stats.flagged_claims),             icon: Flag,           color:"#f59e0b"},
            {label:"Total Claimed",  value: `$${fmtNumber(stats.total_claimed_amount)}`,icon: DollarSign,     color:"#7c3aed"},
            {label:"Total Approved", value: `$${fmtNumber(stats.total_approved_amount)}`,icon: DollarSign,    color:"#059669"},
          ].map(({label,value,icon:Icon,color})=>(
            <div key={label} className="kpi-strip-item">
              <div className="kpi-icon" style={{background:color+"20",color}}><Icon size={17}/></div>
              <div><div className="kpi-val">{value}</div><div className="kpi-lbl">{label}</div></div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "analytics" && stats && (
        <div className="charts-grid" style={{marginTop:"1rem"}}>
          <div className="chart-card">
            <h4>Claims by Status</h4>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}>
                  {statusChartData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-card">
            <h4>Claim Volume by Status</h4>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="name" tick={{fontSize:9}} angle={-20} textAnchor="end" height={45}/>
                <YAxis/>
                <Tooltip/>
                <Bar dataKey="value" fill="#2563eb" radius={[3,3,0,0]}>
                  {statusChartData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === "claims" && (
        <>
          {/* Filters */}
          <div className="admin-filters">
            <div className="filter-group">
              <Search size={14}/>
              <input className="input" placeholder="Search by claim # or name…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:"220px"}}/>
            </div>
            <div className="filter-group">
              <Filter size={14}/>
              <select className="input" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{width:"150px"}}>
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([v,c])=><option key={v} value={v}>{c.label}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <select className="input" value={filterType} onChange={e=>setFilterType(e.target.value)} style={{width:"130px"}}>
                <option value="">All Types</option>
                {["medical","dental","vision","pharmacy","emergency","specialist","hospitalization","maternity","mental_health","other"].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <select className="input" value={filterFlagged} onChange={e=>setFilterFlagged(e.target.value)} style={{width:"120px"}}>
                <option value="">All Claims</option>
                <option value="true">Flagged Only</option>
                <option value="false">Not Flagged</option>
              </select>
            </div>
          </div>

          {/* Claims table */}
          <div className="table-wrap" style={{marginTop:".5rem"}}>
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>Claim #</th><th>Claimant</th><th>Type</th><th>Amount</th>
                  <th>Submitted</th><th>Status</th><th>Priority</th><th>Docs</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={9} style={{textAlign:"center", padding:"2rem", color:"var(--muted)"}}>Loading…</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={9} style={{textAlign:"center", padding:"2rem", color:"var(--muted)"}}>No claims found.</td></tr>}
                {filtered.map(c=>(
                  <React.Fragment key={c.id}>
                    <tr className={c.is_flagged?"flagged-row":""}>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:".3rem"}}>
                          <strong>{c.claim_number}</strong>
                          {c.is_flagged && <span title="Flagged"><Flag size={12} color="#f59e0b"/></span>}
                          {c.fraud_score > 0.6 && <span title={`Fraud score: ${c.fraud_score}`}><AlertTriangle size={12} color="#ef4444"/></span>}
                        </div>
                      </td>
                      <td>
                        <div className="claimant-cell">
                          <span>{c.user_name}</span>
                          <span className="muted" style={{fontSize:".72rem"}}>{c.user_email}</span>
                        </div>
                      </td>
                      <td><span className="badge badge-cat">{c.claim_type?.replace(/_/g," ")}</span></td>
                      <td><strong>${fmtNumber(c.claimed_amount)}</strong>{c.approved_amount && <div className="muted" style={{fontSize:".72rem"}}>Approved: ${fmtNumber(c.approved_amount)}</div>}</td>
                      <td className="muted">{fmtDate(c.submitted_at)}</td>
                      <td><StatusBadge status={c.status}/></td>
                      <td><span className={`priority-badge priority-${c.priority}`}>{c.priority}</span></td>
                      <td>{c.documents?.length || 0}</td>
                      <td>
                        <div style={{display:"flex",gap:".3rem"}}>
                          <button className="btn-secondary sm" onClick={()=>setExpandedId(expandedId===c.id?null:c.id)}>
                            {expandedId===c.id?<ChevronUp size={12}/>:<Eye size={12}/>}
                          </button>
                          <button className="btn-primary sm" onClick={()=>setReviewing(c)}>Review</button>
                        </div>
                      </td>
                    </tr>
                    {expandedId===c.id && (
                      <tr>
                        <td colSpan={9} className="expanded-row">
                          <div className="expanded-content">
                            <p><strong>Description:</strong> {c.description}</p>
                            <div className="form-row" style={{marginTop:".5rem"}}>
                              <span><strong>Hospital:</strong> {c.hospital_name||"—"}</span>
                              <span><strong>Doctor:</strong> {c.doctor_name||"—"}</span>
                              <span><strong>Diagnosis:</strong> {c.diagnosis||"—"}</span>
                              <span><strong>Policy:</strong> {c.policy_number||"—"}</span>
                              {c.admin_notes && <span><strong>Notes:</strong> {c.admin_notes}</span>}
                              {c.rejection_reason && <span style={{color:"#ef4444"}}><strong>Rejection:</strong> {c.rejection_reason}</span>}
                            </div>
                            {c.documents?.length>0 && (
                              <div className="review-docs" style={{marginTop:".5rem"}}>
                                {c.documents.map(doc=>(
                                  <div key={doc.id} className="doc-item">
                                    <FileText size={13} color="#7c3aed"/>
                                    <span className="doc-name">{doc.original_name}</span>
                                    <span className="badge badge-cat">{doc.doc_type}</span>
                                    <a href={claimsAPI.downloadDoc(doc.id)} className="btn-secondary sm" download><Download size={11}/></a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {reviewing && (
        <ReviewModal claim={reviewing} onClose={()=>setReviewing(null)} onSaved={()=>{ setReviewing(null); load(); }}/>
      )}
    </div>
  );
}
