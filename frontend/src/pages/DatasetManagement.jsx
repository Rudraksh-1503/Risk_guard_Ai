import React, { useState, useEffect, useCallback } from "react";
import {
  Database, RefreshCw, Trash2, Eye, BarChart2, Brain, FileText,
  AlertTriangle, CheckCircle, Download, Edit2, ChevronDown, ChevronUp,
  TrendingUp, AlertCircle, Info, Lightbulb
} from "lucide-react";
import UploadZone from "../components/UploadZone";
import DynamicCharts from "../components/DynamicCharts";
import CorrelationHeatmap from "../components/CorrelationHeatmap";
import ModelTrainer from "../components/ModelTrainer";
import StatCard from "../components/StatCard";
import { datasetsAPI } from "../services/api";
import { fmtBytes, fmtDate, fmtNumber, qualityColor, severityColor } from "../utils/format";

const TABS = ["Overview", "Statistics", "Data Quality", "Visualizations", "Correlation", "AI Insights", "Train Model"];
const CATEGORIES = [
  "Health Insurance Premium Dataset",
  "Healthcare Claims Dataset",
  "Healthcare Fraud Detection Dataset",
  "Patient Records Dataset",
  "Hospital Billing Dataset",
  "Unknown / Custom Dataset",
];

export default function DatasetManagement() {
  const [datasets, setDatasets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [preview, setPreview] = useState(null);
  const [models, setModels] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [loading, setLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportUrl, setReportUrl] = useState(null);
  const [editCategory, setEditCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedCol, setExpandedCol] = useState(null);

  const loadDatasets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await datasetsAPI.list();
      setDatasets(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadDatasets(); }, [loadDatasets]);

  const selectDataset = async (ds) => {
    setSelected(ds);
    setAnalysis(null);
    setPreview(null);
    setModels([]);
    setActiveTab("Overview");
    setReportUrl(null);

    if (ds.is_analyzed) {
      try {
        const [aRes, pRes, mRes] = await Promise.all([
          datasetsAPI.getAnalysis(ds.id),
          datasetsAPI.preview(ds.id, 500),
          datasetsAPI.getModels(ds.id),
        ]);
        setAnalysis(aRes.data);
        setPreview(pRes.data);
        setModels(mRes.data);
      } catch (e) { console.error(e); }
    }
  };

  const handleUploaded = useCallback(async () => {
    await loadDatasets();
    let tries = 0;
    const poll = setInterval(async () => {
      tries++;
      try {
        const res = await datasetsAPI.list();
        setDatasets(res.data);
        const newest = res.data[0];
        if (newest?.is_analyzed || tries > 30) {
          clearInterval(poll);
          if (newest?.is_analyzed) {
            setSelected(newest);
            const [aRes, pRes, mRes] = await Promise.all([
              datasetsAPI.getAnalysis(newest.id),
              datasetsAPI.preview(newest.id, 500),
              datasetsAPI.getModels(newest.id),
            ]);
            setAnalysis(aRes.data);
            setPreview(pRes.data);
            setModels(mRes.data);
            setActiveTab("Overview");
          }
        }
      } catch { clearInterval(poll); }
    }, 2000);
  }, [loadDatasets]);

  const handleAnalyze = async () => {
    if (!selected) return;
    setAnalyzeLoading(true);
    try {
      await datasetsAPI.analyze(selected.id);
      const aRes = await datasetsAPI.getAnalysis(selected.id);
      const pRes = await datasetsAPI.preview(selected.id, 500);
      setAnalysis(aRes.data);
      setPreview(pRes.data);
      await loadDatasets();
    } catch (e) { console.error(e); }
    setAnalyzeLoading(false);
  };

  const handleReport = async () => {
    setReportLoading(true);
    try {
      const res = await datasetsAPI.createReport(selected.id);
      setReportUrl(datasetsAPI.downloadReport(selected.id, res.data.report_id));
    } catch (e) { alert("Report generation failed."); }
    setReportLoading(false);
  };

  const handleDelete = async (id) => {
    await datasetsAPI.delete(id);
    setConfirmDelete(null);
    if (selected?.id === id) { setSelected(null); setAnalysis(null); }
    await loadDatasets();
  };

  const handleUpdateCategory = async () => {
    if (!newCategory) return;
    await datasetsAPI.updateCategory(selected.id, newCategory);
    setSelected((prev) => ({ ...prev, user_category: newCategory }));
    setEditCategory(false);
  };

  const ov = analysis?.overview;
  const cols = analysis?.columns || [];
  const issues = analysis?.quality_issues || [];
  const insights = analysis?.insights || [];
  const recommendations = analysis?.ml_recommendations || [];
  const correlation = analysis?.correlation || {};

  return (
    <div className="page-layout">
      {/* Left sidebar — dataset list */}
      <div className="ds-sidebar">
        <div className="ds-sidebar-header">
          <Database size={18} />
          <span>Dataset Library</span>
          <button className="btn-icon ml-auto" onClick={loadDatasets}><RefreshCw size={14} /></button>
        </div>

        <UploadZone onUploaded={handleUploaded} />

        <div className="ds-list">
          {loading && <p className="muted">Loading…</p>}
          {datasets.map((ds) => (
            <div
              key={ds.id}
              className={`ds-item${selected?.id === ds.id ? " selected" : ""}`}
              onClick={() => selectDataset(ds)}
            >
              <div className="ds-item-name">{ds.name}</div>
              <div className="ds-item-meta">
                {ds.file_type.toUpperCase()} · {fmtBytes(ds.file_size)}
                {ds.row_count && ` · ${fmtNumber(ds.row_count)} rows`}
              </div>
              <div className="ds-item-status">
                <span className={`badge badge-${ds.status}`}>{ds.status}</span>
                {ds.detected_category && <span className="badge badge-cat">{ds.detected_category.split(" ")[0]}</span>}
              </div>
              <button
                className="btn-icon ds-delete"
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(ds.id); }}
              ><Trash2 size={12} /></button>
            </div>
          ))}
          {!loading && datasets.length === 0 && <p className="muted" style={{ textAlign: "center", padding: "1rem" }}>No datasets yet. Upload one above.</p>}
        </div>
      </div>

      {/* Main content */}
      <div className="ds-main">
        {!selected ? (
          <div className="ds-empty">
            <Database size={64} color="#cbd5e1" />
            <h2>Dataset Management & AI Analysis</h2>
            <p>Upload a CSV or Excel file to automatically analyze, visualize and train AI models on your data.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="ds-header">
              <div>
                <h2>{selected.name}</h2>
                <p className="muted">{selected.original_filename} · Uploaded {fmtDate(selected.upload_date)}</p>
              </div>
              <div className="ds-header-actions">
                {selected.is_analyzed && (
                  <>
                    <a href={datasetsAPI.exportCsv(selected.id)} className="btn-secondary" download>
                      <Download size={14} /> Export CSV
                    </a>
                    <button className="btn-secondary" onClick={handleReport} disabled={reportLoading}>
                      <FileText size={14} /> {reportLoading ? "Generating…" : "Generate Report"}
                    </button>
                    {reportUrl && <a href={reportUrl} className="btn-primary" download><Download size={14} /> Download PDF</a>}
                  </>
                )}
                {!selected.is_analyzed && (
                  <button className="btn-primary" onClick={handleAnalyze} disabled={analyzeLoading}>
                    <BarChart2 size={14} /> {analyzeLoading ? "Analyzing…" : "Analyze Dataset"}
                  </button>
                )}
              </div>
            </div>

            {/* Category badge */}
            <div className="category-row">
              <div className="cat-badge">
                <span>Detected: <strong>{selected.user_category || selected.detected_category || "Unknown"}</strong></span>
                {selected.category_confidence && (
                  <span className="confidence">Confidence: {Math.round(selected.category_confidence * 100)}%</span>
                )}
                <button className="btn-icon" onClick={() => { setEditCategory(true); setNewCategory(selected.user_category || selected.detected_category || ""); }}>
                  <Edit2 size={12} />
                </button>
              </div>
              {editCategory && (
                <div className="edit-cat">
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button className="btn-primary sm" onClick={handleUpdateCategory}>Save</button>
                  <button className="btn-secondary sm" onClick={() => setEditCategory(false)}>Cancel</button>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="tabs">
              {TABS.map((t) => (
                <button key={t} className={`tab${activeTab === t ? " active" : ""}`} onClick={() => setActiveTab(t)}>{t}</button>
              ))}
            </div>

            {/* Tab content */}
            <div className="tab-content">
              {/* OVERVIEW */}
              {activeTab === "Overview" && (
                <div>
                  {!ov ? (
                    <div className="analyzing-banner">
                      <RefreshCw size={18} className="spin" />
                      <span>Analysis {selected.status === "processing" ? "in progress…" : "pending. Click Analyze Dataset."}</span>
                      {selected.status !== "processing" && (
                        <button className="btn-primary sm" onClick={handleAnalyze} disabled={analyzeLoading}>
                          {analyzeLoading ? "…" : "Analyze Now"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="stats-grid">
                        <StatCard label="Total Records" value={fmtNumber(ov.total_rows)} icon={Database} color="#2563eb" />
                        <StatCard label="Total Features" value={ov.total_columns} icon={BarChart2} color="#7c3aed" />
                        <StatCard label="Numerical Features" value={ov.numerical_columns} icon={TrendingUp} color="#059669" />
                        <StatCard label="Categorical Features" value={ov.categorical_columns} icon={Eye} color="#d97706" />
                        <StatCard label="Missing Values" value={fmtNumber(ov.missing_values_total)} icon={AlertTriangle} color="#ef4444" />
                        <StatCard label="Duplicate Rows" value={fmtNumber(ov.duplicate_rows)} icon={AlertCircle} color="#f59e0b" />
                        <StatCard label="Quality Score" value={`${ov.quality_score}%`} icon={CheckCircle} color={qualityColor(ov.quality_score)} />
                        <StatCard label="Memory Usage" value={`${ov.memory_usage_mb} MB`} icon={Info} color="#0891b2" />
                      </div>

                      {/* Column table */}
                      <h3 style={{ marginTop: "1.5rem" }}>Column Information</h3>
                      <div className="table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Column</th><th>Type</th><th>Category</th>
                              <th>Missing</th><th>Unique</th><th>Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cols.map((col) => (
                              <React.Fragment key={col.name}>
                                <tr onClick={() => setExpandedCol(expandedCol === col.name ? null : col.name)} style={{ cursor: "pointer" }}>
                                  <td><strong>{col.name}</strong></td>
                                  <td><code>{col.dtype}</code></td>
                                  <td><span className={`badge badge-${col.category}`}>{col.category}</span></td>
                                  <td style={{ color: col.null_count > 0 ? "#ef4444" : "#22c55e" }}>
                                    {col.null_count} ({col.null_percentage}%)
                                  </td>
                                  <td>{fmtNumber(col.unique_count)}</td>
                                  <td>{expandedCol === col.name ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                                </tr>
                                {expandedCol === col.name && col.stats && (
                                  <tr>
                                    <td colSpan={6} className="col-detail">
                                      {col.category === "numerical" && (
                                        <div className="stat-mini-grid">
                                          {Object.entries(col.stats).filter(([k]) => !["outlier_count","count"].includes(k)).map(([k, v]) => (
                                            <span key={k}><b>{k}:</b> {v !== null ? Number(v).toFixed(3) : "—"}</span>
                                          ))}
                                        </div>
                                      )}
                                      {col.category === "categorical" && col.stats.top_values && (
                                        <div className="top-values">
                                          {Object.entries(col.stats.top_values).map(([k, v]) => (
                                            <span key={k} className="tv-item">{k}: <strong>{v}</strong> ({col.stats.top_percentages?.[k]}%)</span>
                                          ))}
                                        </div>
                                      )}
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
                </div>
              )}

              {/* STATISTICS */}
              {activeTab === "Statistics" && (
                <div>
                  <h3>Statistical Summary</h3>
                  {cols.filter((c) => c.category === "numerical").map((col) => (
                    <div key={col.name} className="stat-block">
                      <h4>{col.name}</h4>
                      <div className="stat-mini-grid">
                        {Object.entries(col.stats || {}).map(([k, v]) => (
                          <div key={k} className="sm-stat">
                            <span className="sm-label">{k.replace(/_/g," ")}</span>
                            <span className="sm-val">{v !== null && v !== undefined ? (typeof v === "number" ? v.toLocaleString(undefined, {maximumFractionDigits:4}) : v) : "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <h3 style={{ marginTop: "1.5rem" }}>Categorical Summary</h3>
                  {cols.filter((c) => c.category === "categorical").map((col) => (
                    <div key={col.name} className="stat-block">
                      <h4>{col.name}</h4>
                      <div className="top-values">
                        {Object.entries(col.stats?.top_values || {}).map(([k, v]) => (
                          <div key={k} className="tv-bar">
                            <span className="tv-label">{k}</span>
                            <div className="tv-track">
                              <div className="tv-fill" style={{ width: `${col.stats?.top_percentages?.[k] || 0}%` }} />
                            </div>
                            <span className="tv-count">{fmtNumber(v)} ({col.stats?.top_percentages?.[k]}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* DATA QUALITY */}
              {activeTab === "Data Quality" && (
                <div>
                  <div className="quality-header">
                    <div className="quality-score-circle" style={{ borderColor: qualityColor(ov?.quality_score || 0) }}>
                      <span style={{ color: qualityColor(ov?.quality_score || 0) }}>{ov?.quality_score ?? "—"}%</span>
                      <small>Quality</small>
                    </div>
                    <div>
                      <h3>Data Quality Report</h3>
                      <p className="muted">{issues.length} issue(s) detected</p>
                    </div>
                  </div>
                  {issues.length === 0 ? (
                    <div className="success-banner"><CheckCircle size={18} /> No data quality issues detected.</div>
                  ) : (
                    issues.map((issue, i) => (
                      <div key={i} className="quality-issue" style={{ borderLeft: `4px solid ${severityColor(issue.severity)}` }}>
                        <div className="issue-header">
                          <span className="issue-type">{issue.type.replace(/_/g," ")}</span>
                          <span className="issue-col">{issue.column}</span>
                          <span className="issue-sev" style={{ color: severityColor(issue.severity) }}>{issue.severity.toUpperCase()}</span>
                        </div>
                        <p className="issue-msg">{issue.message}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* VISUALIZATIONS */}
              {activeTab === "Visualizations" && (
                <div>
                  {preview && analysis ? (
                    <DynamicCharts columns={cols} previewData={preview.data} />
                  ) : (
                    <p className="muted">Run analysis first to see visualizations.</p>
                  )}
                </div>
              )}

              {/* CORRELATION */}
              {activeTab === "Correlation" && (
                <div>
                  <h3>Correlation Heatmap</h3>
                  <p className="muted">Computed from actual numerical columns in the uploaded dataset.</p>
                  <CorrelationHeatmap correlation={correlation} />
                </div>
              )}

              {/* AI INSIGHTS */}
              {activeTab === "AI Insights" && (
                <div>
                  <h3><Lightbulb size={18} /> AI Dataset Intelligence</h3>
                  <div className="insights-list">
                    {insights.map((ins, i) => (
                      <div key={i} className="insight-card">
                        <div className="insight-icon"><Info size={16} /></div>
                        <p>{ins}</p>
                      </div>
                    ))}
                  </div>
                  {recommendations.length > 0 && (
                    <>
                      <h3 style={{ marginTop: "1.5rem" }}>Recommended ML Tasks</h3>
                      {recommendations.map((rec, i) => (
                        <div key={i} className="rec-card">
                          <div className="rec-header">
                            <Brain size={16} />
                            <strong>{rec.task}</strong>
                            <span className={`badge badge-${rec.type}`}>{rec.type}</span>
                            <span className={`badge badge-${rec.suitability}`}>{rec.suitability} suitability</span>
                          </div>
                          <p>{rec.description}</p>
                          <p className="muted">Target: <code>{rec.target_column}</code> · Algorithms: {rec.algorithms?.join(", ")}</p>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Previous models */}
                  {models.length > 0 && (
                    <>
                      <h3 style={{ marginTop: "1.5rem" }}>Trained Models</h3>
                      {models.map((m) => (
                        <div key={m.id} className="model-hist-card">
                          <div className="mh-header">
                            <Brain size={14} />
                            <strong>{m.model_name}</strong>
                            <span className="badge badge-analyzed">{m.status}</span>
                            <span className="muted">{fmtDate(m.training_date)}</span>
                          </div>
                          <div className="metrics-grid">
                            {m.metrics && Object.entries(m.metrics).filter(([k]) => !["actual_vs_predicted","confusion_matrix"].includes(k)).map(([k, v]) => (
                              <div key={k} className="metric-card">
                                <span className="metric-name">{k.replace(/_/g," ").toUpperCase()}</span>
                                <span className="metric-value">{typeof v === "number" ? v.toFixed(4) : String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* TRAIN MODEL */}
              {activeTab === "Train Model" && (
                <div>
                  {analysis ? (
                    <ModelTrainer datasetId={selected.id} recommendations={recommendations} columns={cols} />
                  ) : (
                    <p className="muted">Run analysis first to enable model training.</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Delete Dataset</h3>
            <p>This will permanently delete the dataset and all associated analyses. This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-danger" onClick={() => handleDelete(confirmDelete)}>Delete</button>
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
