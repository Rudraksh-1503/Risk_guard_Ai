import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from "recharts";
import { FlaskConical, Plus, Trash2, Play, Brain, AlertCircle } from "lucide-react";
import { explainAPI } from "../services/api";
import { fmtNumber } from "../utils/format";

const DEFAULT_SCENARIO = (features) => {
  const s = { label: "Scenario" };
  features.forEach((f) => { s[f] = ""; });
  return s;
};

export default function WhatIfSimulation() {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    explainAPI.listModels().then((r) => {
      setModels(r.data);
      if (r.data.length > 0) initModel(r.data[0]);
    }).catch(() => {});
  }, []);

  const initModel = (m) => {
    setSelectedModel(m);
    setResults([]);
    const feats = m.feature_columns || [];
    setScenarios([
      { ...DEFAULT_SCENARIO(feats), label: "Baseline" },
      { ...DEFAULT_SCENARIO(feats), label: "Scenario A" },
    ]);
  };

  const addScenario = () => {
    if (!selectedModel) return;
    const feats = selectedModel.feature_columns || [];
    setScenarios((prev) => [...prev, { ...DEFAULT_SCENARIO(feats), label: `Scenario ${String.fromCharCode(65 + prev.length - 1)}` }]);
  };

  const removeScenario = (i) => setScenarios((prev) => prev.filter((_, idx) => idx !== i));

  const updateScenario = (i, field, val) => {
    setScenarios((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  };

  const runSimulation = async () => {
    if (!selectedModel || scenarios.length === 0) return;
    setLoading(true); setError(""); setResults([]);
    try {
      const payload = scenarios.map(({ label, ...feats }) => feats);
      const res = await explainAPI.whatif(selectedModel.id, payload);
      const enriched = res.data.map((r, i) => ({ ...r, label: scenarios[i].label }));
      setResults(enriched);
    } catch (e) {
      setError(e.response?.data?.detail || "Simulation failed.");
    }
    setLoading(false);
  };

  const isRegression = selectedModel?.task_type === "regression";
  const chartData = results.map((r) => ({
    name: r.label,
    value: isRegression ? r.prediction : (r.probabilities ? Math.max(...Object.values(r.probabilities)) * 100 : 0),
  }));
  const baseline = chartData[0]?.value || 0;

  return (
    <div className="module-page">
      <div className="module-header">
        <FlaskConical size={22} color="#0891b2" />
        <div>
          <h2>What-If Simulation</h2>
          <p className="muted">Simulate multiple scenarios through your trained model and compare predictions side-by-side.</p>
        </div>
      </div>

      {models.length === 0 ? (
        <div className="warn-banner">
          <Brain size={16} /> No trained models found.
          Go to <a href="/datasets">Dataset Management → Train Model</a> first.
        </div>
      ) : (
        <>
          <div className="form-group" style={{maxWidth:"400px", marginBottom:"1rem"}}>
            <label>Select Trained Model</label>
            <select value={selectedModel?.id || ""} onChange={(e) => {
              const m = models.find((m) => m.id === Number(e.target.value));
              if (m) initModel(m);
            }}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.model_name} ({m.task_type})</option>)}
            </select>
          </div>

          {/* Scenarios */}
          <div className="whatif-scenarios">
            {scenarios.map((scenario, si) => (
              <div key={si} className="scenario-card">
                <div className="scenario-header">
                  <input className="scenario-label-input" value={scenario.label}
                    onChange={(e) => updateScenario(si, "label", e.target.value)} />
                  {scenarios.length > 1 && (
                    <button className="btn-icon" onClick={() => removeScenario(si)}><Trash2 size={12} color="#ef4444" /></button>
                  )}
                </div>
                {(selectedModel?.feature_columns || []).slice(0, 10).map((f) => (
                  <div key={f} className="form-group" style={{marginBottom:".35rem"}}>
                    <label style={{fontSize:".72rem"}}>{f}</label>
                    <input className="input" style={{padding:".3rem .5rem", fontSize:".8rem"}}
                      value={scenario[f] || ""}
                      onChange={(e) => updateScenario(si, f, e.target.value)}
                      placeholder={f} />
                  </div>
                ))}
                {results[si] && (
                  <div className={`scenario-result ${isRegression ? "" : results[si].prediction === "1" || results[si].prediction === "Yes" || results[si].prediction === "fraud" ? "result-fraud" : "result-safe"}`}>
                    <span className="sr-label">Prediction</span>
                    <span className="sr-value">
                      {isRegression ? `$${Number(results[si].prediction).toLocaleString()}` : results[si].prediction}
                    </span>
                    {!isRegression && results[si].probabilities && (
                      <div className="prob-mini">
                        {Object.entries(results[si].probabilities).map(([cls, p]) => (
                          <span key={cls}>{cls}: {(p*100).toFixed(1)}%</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            <button className="add-scenario-btn" onClick={addScenario}>
              <Plus size={16} /> Add Scenario
            </button>
          </div>

          {error && <p className="error-msg"><AlertCircle size={14} /> {error}</p>}

          <button className="btn-primary" onClick={runSimulation} disabled={loading} style={{marginTop:"1rem"}}>
            <Play size={14} /> {loading ? "Running…" : `Run ${scenarios.length} Scenario${scenarios.length > 1 ? "s" : ""}`}
          </button>

          {/* Comparison chart */}
          {results.length > 0 && (
            <div className="chart-card" style={{marginTop:"1.5rem"}}>
              <h4>{isRegression ? "Predicted Values" : "Confidence Score (%)"} — Scenario Comparison</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => isRegression ? `$${(v/1000).toFixed(0)}k` : `${v.toFixed(0)}%`} />
                  <Tooltip formatter={(v) => isRegression ? `$${Number(v).toLocaleString()}` : `${v.toFixed(2)}%`} />
                  <ReferenceLine y={baseline} stroke="#94a3b8" strokeDasharray="4 4" label={{value:"Baseline", fill:"#64748b", fontSize:11}} />
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={i === 0 ? "#94a3b8" : entry.value > baseline ? "#ef4444" : "#22c55e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="muted" style={{marginTop:".5rem"}}>
                Grey = baseline · Red = higher than baseline · Green = lower than baseline
              </p>
            </div>
          )}

          {/* Results table */}
          {results.length > 0 && (
            <div className="table-wrap" style={{marginTop:"1rem"}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Prediction</th>
                    {isRegression && <th>vs Baseline</th>}
                    {!isRegression && <th>Probabilities</th>}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const diff = isRegression ? r.prediction - results[0]?.prediction : null;
                    return (
                      <tr key={i}>
                        <td><strong>{r.label}</strong></td>
                        <td><strong>{isRegression ? `$${Number(r.prediction).toLocaleString()}` : r.prediction}</strong></td>
                        {isRegression && (
                          <td style={{color: i === 0 ? "#64748b" : diff > 0 ? "#ef4444" : "#22c55e"}}>
                            {i === 0 ? "—" : `${diff > 0 ? "+" : ""}$${fmtNumber(Math.round(diff))}`}
                          </td>
                        )}
                        {!isRegression && r.probabilities && (
                          <td className="muted">
                            {Object.entries(r.probabilities).map(([c,p]) => `${c}: ${(p*100).toFixed(1)}%`).join(" | ")}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
