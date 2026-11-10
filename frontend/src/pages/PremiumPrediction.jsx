import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { TrendingUp, DollarSign, Users, Activity, Play, AlertCircle } from "lucide-react";
import DatasetSelector from "../components/DatasetSelector";
import StatCard from "../components/StatCard";
import { premiumAPI, datasetsAPI } from "../services/api";
import { fmtNumber } from "../utils/format";

const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#059669", "#d97706", "#0891b2"];

export default function PremiumPrediction() {
  const [dataset, setDataset] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // prediction form
  const [selectedModel, setSelectedModel] = useState("");
  const [formValues, setFormValues] = useState({});
  const [predResult, setPredResult] = useState(null);
  const [predLoading, setPredLoading] = useState(false);

  const loadAnalytics = async (ds) => {
    if (!ds) return;
    setLoading(true); setError(""); setAnalytics(null); setPredResult(null);
    try {
      const [aRes, mRes] = await Promise.all([
        premiumAPI.analytics(ds.id),
        datasetsAPI.getModels(ds.id),
      ]);
      setAnalytics(aRes.data);
      const premiumModels = mRes.data.filter((m) => m.task_type === "regression");
      setModels(premiumModels);
      if (premiumModels.length > 0) {
        setSelectedModel(String(premiumModels[0].id));
        const feats = premiumModels[0].feature_columns || [];
        const init = {};
        feats.forEach((f) => { init[f] = ""; });
        setFormValues(init);
      }
    } catch (e) {
      setError("Could not load analytics for this dataset.");
    }
    setLoading(false);
  };

  const handleDatasetChange = (ds) => { setDataset(ds); loadAnalytics(ds); };

  const handlePredict = async () => {
    if (!selectedModel) return;
    setPredLoading(true); setPredResult(null);
    try {
      const res = await premiumAPI.predict(Number(selectedModel), formValues);
      setPredResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Prediction failed.");
    }
    setPredLoading(false);
  };

  const s = analytics?.summary;

  return (
    <div className="module-page">
      <div className="module-header">
        <TrendingUp size={22} color="#7c3aed" />
        <div>
          <h2>Premium Prediction</h2>
          <p className="muted">Insurance premium analysis and ML prediction — computed from your uploaded dataset.</p>
        </div>
      </div>

      <DatasetSelector onSelect={handleDatasetChange} selectedId={dataset?.id} />

      {loading && <div className="loading-banner"><Activity size={16} className="spin" /> Loading analytics…</div>}
      {error && <div className="error-banner"><AlertCircle size={16} /> {error}</div>}

      {analytics && !analytics.compatible && (
        <div className="warn-banner">
          <AlertCircle size={16} /> {analytics.message}
          <p className="muted" style={{marginTop:".25rem"}}>Upload a dataset with premium/charges, age, BMI, smoker columns to activate this module.</p>
        </div>
      )}

      {analytics && analytics.compatible && (
        <>
          {/* Summary cards */}
          <div className="stats-grid" style={{marginTop:"1rem"}}>
            <StatCard label="Avg Premium" value={`$${fmtNumber(s?.avg_premium)}`} icon={DollarSign} color="#7c3aed" />
            <StatCard label="Median Premium" value={`$${fmtNumber(s?.median_premium)}`} icon={TrendingUp} color="#2563eb" />
            <StatCard label="Min Premium" value={`$${fmtNumber(s?.min_premium)}`} icon={Activity} color="#059669" />
            <StatCard label="Max Premium" value={`$${fmtNumber(s?.max_premium)}`} icon={DollarSign} color="#ef4444" />
            <StatCard label="Total Records" value={fmtNumber(s?.total_records)} icon={Users} color="#d97706" />
            <StatCard label="Std Deviation" value={`$${fmtNumber(s?.std_premium)}`} icon={Activity} color="#0891b2" />
          </div>

          <div className="charts-grid" style={{marginTop:"1rem"}}>
            {/* Premium distribution */}
            {analytics.premium_distribution && (
              <div className="chart-card">
                <h4>Premium Distribution</h4>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.premium_distribution} margin={{bottom:40}}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" angle={-30} textAnchor="end" tick={{fontSize:9}} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#7c3aed" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Age analysis */}
            {analytics.age_analysis && (
              <div className="chart-card">
                <h4>Average Premium by Age Group</h4>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.age_analysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="age_group" />
                    <YAxis />
                    <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
                    <Bar dataKey="avg_charge" fill="#2563eb" radius={[3,3,0,0]} name="Avg Premium" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Smoker analysis */}
            {analytics.smoker_analysis && (
              <div className="chart-card">
                <h4>Smoking Status vs Premium</h4>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.smoker_analysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="smoker" />
                    <YAxis />
                    <Tooltip formatter={(v) => typeof v === "number" ? `$${v.toLocaleString()}` : v} />
                    <Bar dataKey="avg_charge" fill="#db2777" radius={[3,3,0,0]} name="Avg Premium" />
                    <Bar dataKey="count" fill="#94a3b8" radius={[3,3,0,0]} name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* BMI analysis */}
            {analytics.bmi_analysis && (
              <div className="chart-card">
                <h4>BMI Category vs Premium</h4>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.bmi_analysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bmi_category" />
                    <YAxis />
                    <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
                    <Bar dataKey="avg_charge" fill="#059669" radius={[3,3,0,0]} name="Avg Premium" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Region analysis */}
            {analytics.region_analysis && (
              <div className="chart-card">
                <h4>Region-wise Premium Comparison</h4>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.region_analysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="region" />
                    <YAxis />
                    <Tooltip formatter={(v) => typeof v === "number" ? `$${v.toLocaleString()}` : v} />
                    <Bar dataKey="avg" fill="#d97706" radius={[3,3,0,0]} name="Avg Premium" />
                    <Bar dataKey="count" fill="#94a3b8" radius={[3,3,0,0]} name="Count" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Gender analysis */}
            {analytics.gender_analysis && (
              <div className="chart-card">
                <h4>Gender vs Premium</h4>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={analytics.gender_analysis} dataKey="avg_charge" nameKey="gender"
                      cx="50%" cy="50%" outerRadius={90} label={({gender, avg_charge}) => `${gender}: $${avg_charge?.toLocaleString()}`}>
                      {analytics.gender_analysis.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Children analysis */}
            {analytics.children_analysis && (
              <div className="chart-card">
                <h4>Number of Dependents vs Premium</h4>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={analytics.children_analysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="children" label={{value:"Dependents", position:"insideBottom", offset:-5}} />
                    <YAxis />
                    <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
                    <Line type="monotone" dataKey="avg_charge" stroke="#2563eb" strokeWidth={2} dot={{r:5}} name="Avg Premium" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Prediction panel */}
          {models.length > 0 && (
            <div className="prediction-panel">
              <h3><Play size={16} /> Predict Insurance Premium</h3>
              <p className="muted">Enter values below to get a real-time prediction from your trained model.</p>

              <div className="form-row" style={{marginTop:".75rem"}}>
                <div className="form-group">
                  <label>Trained Model</label>
                  <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                    {models.map((m) => <option key={m.id} value={m.id}>{m.model_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="feature-form">
                {Object.keys(formValues).map((f) => (
                  <div key={f} className="form-group">
                    <label>{f}</label>
                    <input className="input" value={formValues[f]} onChange={(e) => setFormValues(p => ({...p, [f]: e.target.value}))} placeholder={f} />
                  </div>
                ))}
              </div>

              <button className="btn-primary" onClick={handlePredict} disabled={predLoading} style={{marginTop:".75rem"}}>
                <Play size={14} /> {predLoading ? "Predicting…" : "Predict Premium"}
              </button>

              {predResult && (
                <div className="pred-result">
                  <div className="pred-value">
                    <span className="pred-label">Predicted Premium</span>
                    <span className="pred-number">${Number(predResult.prediction).toLocaleString()}</span>
                  </div>
                  <p className="muted">Computed by {models.find(m=>String(m.id)===selectedModel)?.algorithm} · Features used: {predResult.features_used?.join(", ")}</p>
                </div>
              )}
            </div>
          )}

          {models.length === 0 && (
            <div className="warn-banner" style={{marginTop:"1rem"}}>
              No trained regression model found for this dataset. Go to <a href="/datasets">Dataset Management → Train Model</a> to train one first.
            </div>
          )}
        </>
      )}
    </div>
  );
}
