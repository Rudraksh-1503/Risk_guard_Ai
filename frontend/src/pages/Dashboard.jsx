import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Database, Upload, Brain, Shield, TrendingUp, BarChart2,
  Lightbulb, FlaskConical, Activity, CheckCircle, AlertTriangle
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { datasetsAPI, explainAPI } from "../services/api";
import { fmtNumber, fmtDate } from "../utils/format";

const MODULES = [
  { to: "/datasets",   icon: Database,     label: "Dataset Management",    desc: "Upload, analyze and manage datasets",           color: "#2563eb" },
  { to: "/premium",    icon: TrendingUp,   label: "Premium Prediction",     desc: "Predict insurance premiums with ML",            color: "#7c3aed" },
  { to: "/fraud",      icon: Shield,       label: "Fraud Detection",        desc: "Detect fraudulent insurance claims",            color: "#ef4444" },
  { to: "/explainable",icon: Lightbulb,    label: "Explainable AI",         desc: "Understand model decisions with SHAP-style XAI",color: "#d97706" },
  { to: "/whatif",     icon: FlaskConical, label: "What-If Simulation",     desc: "Simulate scenarios with trained models",        color: "#0891b2" },
  { to: "/forecast",   icon: BarChart2,    label: "Claim Forecasting",      desc: "Forecast future claim volumes",                 color: "#059669" },
  { to: "/models",     icon: Brain,        label: "Model Registry",         desc: "View all trained AI models",                   color: "#db2777" },
];

export default function Dashboard() {
  const [datasets, setDatasets] = useState([]);
  const [models, setModels] = useState([]);

  useEffect(() => {
    datasetsAPI.list().then((r) => setDatasets(r.data)).catch(() => {});
    explainAPI.listModels().then((r) => setModels(r.data)).catch(() => {});
  }, []);

  const totalRows = datasets.reduce((s, d) => s + (d.row_count || 0), 0);
  const analyzed = datasets.filter((d) => d.is_analyzed).length;

  // Build a simple upload timeline from dataset dates
  const timeline = [...datasets]
    .sort((a, b) => new Date(a.upload_date) - new Date(b.upload_date))
    .slice(-10)
    .map((d, i) => ({ name: d.name.slice(0, 10), rows: d.row_count || 0, idx: i + 1 }));

  return (
    <div className="dashboard-page">
      {/* Hero */}
      <div className="dash-hero">
        <div>
          <h1>Risk Guard AI</h1>
          <p className="muted">Dynamic dataset analysis · Automated ML training · Healthcare insurance intelligence</p>
        </div>
        <Link to="/datasets" className="btn-primary lg">
          <Upload size={18} /> Upload Dataset
        </Link>
      </div>

      {/* KPI strip */}
      <div className="kpi-strip">
        {[
          { label: "Datasets", value: datasets.length, icon: Database, color: "#2563eb" },
          { label: "Analyzed", value: analyzed, icon: CheckCircle, color: "#22c55e" },
          { label: "Total Records", value: fmtNumber(totalRows), icon: Activity, color: "#7c3aed" },
          { label: "Trained Models", value: models.length, icon: Brain, color: "#d97706" },
          { label: "Quality Issues", value: datasets.filter(d => d.status === "error").length, icon: AlertTriangle, color: "#ef4444" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="kpi-strip-item">
            <div className="kpi-icon" style={{ background: color + "20", color }}><Icon size={18} /></div>
            <div>
              <div className="kpi-val">{value}</div>
              <div className="kpi-lbl">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + recent */}
      <div className="dash-two-col">
        <div className="chart-card dash-chart">
          <h4>Dataset Rows Over Time</h4>
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmtNumber(v)} />
                <Area type="monotone" dataKey="rows" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} name="Rows" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">
              <Upload size={32} color="#cbd5e1" />
              <p>Upload datasets to see the timeline.</p>
            </div>
          )}
        </div>

        <div className="dash-recent">
          <h4>Recent Datasets</h4>
          {datasets.length === 0 ? (
            <p className="muted">No datasets yet.</p>
          ) : (
            <div className="recent-list">
              {datasets.slice(0, 6).map((ds) => (
                <div key={ds.id} className="recent-item">
                  <div className="ri-info">
                    <span className="ri-name">{ds.name}</span>
                    <span className="ri-meta">{fmtNumber(ds.row_count)} rows · {fmtDate(ds.upload_date)}</span>
                  </div>
                  <span className={`badge badge-${ds.status}`}>{ds.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modules grid */}
      <div className="dash-modules">
        <h2>All Modules</h2>
        <div className="modules-grid">
          {MODULES.map(({ to, icon: Icon, label, desc, color }) => (
            <Link key={to} to={to} className="module-card" style={{ "--accent": color }}>
              <div className="module-icon" style={{ background: color + "20", color }}>
                <Icon size={22} />
              </div>
              <h3>{label}</h3>
              <p>{desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Trained models strip */}
      {models.length > 0 && (
        <div className="dash-models">
          <h2>Trained Models</h2>
          <div className="models-strip">
            {models.map((m) => (
              <div key={m.id} className="model-strip-card">
                <Brain size={16} color="#7c3aed" />
                <div>
                  <div className="ms-name">{m.model_name}</div>
                  <div className="ms-meta">{m.algorithm} · {m.task_type} · target: {m.target_column}</div>
                  {m.metrics && (
                    <div className="ms-metrics">
                      {Object.entries(m.metrics)
                        .filter(([k]) => !["actual_vs_predicted", "confusion_matrix"].includes(k))
                        .slice(0, 2)
                        .map(([k, v]) => (
                          <span key={k}>{k}: <strong>{typeof v === "number" ? v.toFixed(3) : v}</strong></span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
