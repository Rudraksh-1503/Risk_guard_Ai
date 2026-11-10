import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { Lightbulb, Play, AlertCircle, Info, Brain, ChevronDown, ChevronUp } from "lucide-react";
import { explainAPI } from "../services/api";

export default function ExplainableAI() {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    explainAPI.listModels().then((r) => {
      setModels(r.data);
      if (r.data.length > 0) selectModel(r.data[0]);
    }).catch(() => {});
  }, []);

  const selectModel = (m) => {
    setSelectedModel(m);
    const init = {};
    (m.feature_columns || []).forEach((f) => { init[f] = ""; });
    setFormValues(init);
    setResult(null);
  };

  const handleExplain = async () => {
    if (!selectedModel) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await explainAPI.explain(selectedModel.id, formValues);
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Explanation failed.");
    }
    setLoading(false);
  };

  const contributions = result?.feature_contributions || [];
  const chartData = contributions
    .filter((c) => c.importance !== null)
    .slice(0, showAll ? 999 : 10)
    .map((c) => ({ name: c.feature.length > 25 ? c.feature.slice(0,25)+"…" : c.feature, value: c.importance }));

  return (
    <div className="module-page">
      <div className="module-header">
        <Lightbulb size={22} color="#d97706" />
        <div>
          <h2>Explainable AI</h2>
          <p className="muted">Understand how the model makes decisions using feature importance and rule-based explanations.</p>
        </div>
      </div>

      {models.length === 0 ? (
        <div className="warn-banner">
          <Brain size={16} /> No trained models found.
          Go to <a href="/datasets">Dataset Management → Train Model</a> to train a model first.
        </div>
      ) : (
        <>
          {/* Model selector */}
          <div className="form-group" style={{maxWidth:"400px", marginBottom:"1rem"}}>
            <label>Select Trained Model</label>
            <select value={selectedModel?.id || ""} onChange={(e) => {
              const m = models.find((m) => m.id === Number(e.target.value));
              if (m) selectModel(m);
            }}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.model_name} ({m.task_type})</option>)}
            </select>
          </div>

          {selectedModel && (
            <div className="explain-layout">
              {/* Input panel */}
              <div className="explain-input">
                <h3>Input Values</h3>
                <p className="muted" style={{marginBottom:".75rem"}}>Enter feature values to explain a prediction.</p>
                <div className="feature-form">
                  {Object.keys(formValues).map((f) => (
                    <div key={f} className="form-group">
                      <label>{f}</label>
                      <input className="input" value={formValues[f]}
                        onChange={(e) => setFormValues(p => ({...p, [f]: e.target.value}))}
                        placeholder={f} />
                    </div>
                  ))}
                </div>
                {error && <p className="error-msg"><AlertCircle size={14} /> {error}</p>}
                <button className="btn-primary" onClick={handleExplain} disabled={loading} style={{marginTop:".75rem"}}>
                  <Play size={14} /> {loading ? "Explaining…" : "Explain Prediction"}
                </button>
              </div>

              {/* Result panel */}
              {result && (
                <div className="explain-result">
                  <div className="pred-result">
                    <div className="pred-value">
                      <span className="pred-label">{result.task_type === "regression" ? "Predicted Value" : "Predicted Class"}</span>
                      <span className="pred-number">{result.task_type === "regression" ? `$${Number(result.prediction).toLocaleString()}` : result.prediction}</span>
                    </div>
                    {result.probabilities && (
                      <div className="prob-bars">
                        {Object.entries(result.probabilities).map(([cls, prob]) => (
                          <div key={cls} className="prob-row">
                            <span>{cls}</span>
                            <div className="prob-track"><div className="prob-fill" style={{width:`${prob*100}%`, background: cls === result.prediction ? "#2563eb" : "#94a3b8"}} /></div>
                            <span>{(prob*100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Explanation text */}
                  <div className="explanation-text">
                    <Info size={16} color="#2563eb" />
                    <p>{result.explanation}</p>
                  </div>

                  {/* Feature importance chart */}
                  {chartData.length > 0 && (
                    <div className="chart-card" style={{marginTop:"1rem"}}>
                      <h4>Feature Importance (Top {showAll ? "All" : "10"})</h4>
                      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 28)}>
                        <BarChart data={chartData} layout="vertical" margin={{left:120}}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" domain={[0, "auto"]} />
                          <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={110} />
                          <Tooltip formatter={(v) => v.toFixed(4)} />
                          <Bar dataKey="value" radius={[0,3,3,0]} name="Importance">
                            {chartData.map((_, i) => <Cell key={i} fill={i === 0 ? "#2563eb" : i < 3 ? "#7c3aed" : "#94a3b8"} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      {contributions.length > 10 && (
                        <button className="btn-secondary sm" style={{marginTop:".5rem"}} onClick={() => setShowAll(!showAll)}>
                          {showAll ? <><ChevronUp size={12}/> Show less</> : <><ChevronDown size={12}/> Show all {contributions.length}</>}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Feature values table */}
                  <div className="table-wrap" style={{marginTop:"1rem"}}>
                    <table className="data-table">
                      <thead><tr><th>Feature</th><th>Your Value</th><th>Importance</th></tr></thead>
                      <tbody>
                        {contributions.map((c, i) => (
                          <tr key={i}>
                            <td><code>{c.feature}</code></td>
                            <td>{String(result.input_values?.[c.feature.split("=")[0]] ?? "—")}</td>
                            <td>
                              {c.importance !== null ? (
                                <div style={{display:"flex",alignItems:"center",gap:".5rem"}}>
                                  <div style={{width:`${c.importance*200}px`,height:6,background:"#2563eb",borderRadius:3,maxWidth:80}} />
                                  <span>{c.importance.toFixed(4)}</span>
                                </div>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
