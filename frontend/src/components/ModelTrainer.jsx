import React, { useState } from "react";
import { datasetsAPI } from "../services/api";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from "recharts";
import { Brain, Play, CheckCircle, AlertCircle } from "lucide-react";

const ALGORITHMS = {
  regression: ["Random Forest", "Gradient Boosting", "Linear Regression"],
  classification: ["Random Forest", "Logistic Regression"],
};

export default function ModelTrainer({ datasetId, recommendations, columns }) {
  const task = recommendations[0] || null;
  const [target, setTarget] = useState(task?.target_column || "");
  const [features, setFeatures] = useState(task?.feature_columns || []);
  const [taskType, setTaskType] = useState(task?.type || "regression");
  const [algo, setAlgo] = useState(ALGORITHMS[task?.type || "regression"][0]);
  const [training, setTraining] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const allCols = columns?.map((c) => c.name) || [];

  const handleTrain = async () => {
    if (!target) { setError("Select a target column."); return; }
    setTraining(true); setError(""); setResult(null);
    try {
      const res = await datasetsAPI.train(datasetId, {
        target_column: target,
        feature_columns: features.length ? features : null,
        task_type: taskType,
        algorithm: algo,
      });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Training failed.");
    } finally {
      setTraining(false);
    }
  };

  const toggleFeature = (col) => {
    setFeatures((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]);
  };

  const actVsPred = result?.metrics?.actual_vs_predicted;
  const cm = result?.metrics?.confusion_matrix;
  const fi = result?.feature_importances ? Object.entries(result.feature_importances).slice(0, 10) : [];

  return (
    <div className="trainer-wrap">
      <h3><Brain size={18} /> Train AI Model</h3>

      <div className="trainer-form">
        <div className="form-row">
          <div className="form-group">
            <label>Task Type</label>
            <select value={taskType} onChange={(e) => { setTaskType(e.target.value); setAlgo(ALGORITHMS[e.target.value][0]); }}>
              <option value="regression">Regression</option>
              <option value="classification">Classification</option>
            </select>
          </div>
          <div className="form-group">
            <label>Target Column *</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Select target…</option>
              {allCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Algorithm</label>
            <select value={algo} onChange={(e) => setAlgo(e.target.value)}>
              {ALGORITHMS[taskType].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Feature Columns (leave blank to use all suitable columns)</label>
          <div className="feature-chips">
            {allCols.filter((c) => c !== target).map((c) => (
              <button key={c} className={`chip${features.includes(c) ? " active" : ""}`} onClick={() => toggleFeature(c)}>{c}</button>
            ))}
          </div>
        </div>

        {error && <p className="error-msg"><AlertCircle size={14} /> {error}</p>}
        <button className="btn-primary" onClick={handleTrain} disabled={training || !target}>
          <Play size={16} /> {training ? "Training model…" : "Train AI Model on Uploaded Dataset"}
        </button>
      </div>

      {result && (
        <div className="metrics-panel">
          <h4><CheckCircle size={16} color="#22c55e" /> Training Complete</h4>
          <div className="metrics-grid">
            {Object.entries(result.metrics).filter(([k]) => !["actual_vs_predicted","confusion_matrix"].includes(k)).map(([k, v]) => (
              <div key={k} className="metric-card">
                <span className="metric-name">{k.replace(/_/g," ").toUpperCase()}</span>
                <span className="metric-value">{typeof v === "number" ? v.toFixed(4) : String(v)}</span>
              </div>
            ))}
          </div>
          <p className="muted">Train size: {result.train_size} · Test size: {result.test_size}</p>

          {actVsPred && (
            <div className="chart-card">
              <h4>Actual vs Predicted (first 100 samples)</h4>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart>
                  <CartesianGrid />
                  <XAxis type="number" dataKey="x" name="Actual" />
                  <YAxis type="number" dataKey="y" name="Predicted" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter
                    data={actVsPred.actual.map((a, i) => ({ x: a, y: actVsPred.predicted[i] }))}
                    fill="#2563eb" opacity={0.7}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}

          {cm && (
            <div className="chart-card">
              <h4>Confusion Matrix</h4>
              <div className="conf-matrix">
                {cm.map((row, i) => (
                  <div key={i} className="cm-row">
                    {row.map((val, j) => (
                      <div key={j} className="cm-cell" style={{ opacity: 0.3 + (val / Math.max(...cm.flat(), 1)) * 0.7 }}>
                        {val}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {fi.length > 0 && (
            <div className="chart-card">
              <h4>Feature Importance (Top 10)</h4>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={fi.map(([name, val]) => ({ name: name.length > 20 ? name.slice(0,20)+"…" : name, value: val }))} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#7c3aed" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
