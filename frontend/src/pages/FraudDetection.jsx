import React, { useState } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from "recharts";
import { Shield, AlertTriangle, CheckCircle, TrendingUp, Users, DollarSign, Activity } from "lucide-react";
import DatasetSelector from "../components/DatasetSelector";
import StatCard from "../components/StatCard";
import { fraudAPI } from "../services/api";
import { fmtNumber } from "../utils/format";

const COLORS = ["#ef4444", "#22c55e", "#f59e0b", "#2563eb", "#7c3aed", "#0891b2"];

export default function FraudDetection() {
  const [dataset, setDataset] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAnalytics = async (ds) => {
    if (!ds) return;
    setLoading(true); setError(""); setAnalytics(null);
    try {
      const res = await fraudAPI.analytics(ds.id);
      setAnalytics(res.data);
    } catch (e) {
      setError("Could not load fraud analytics.");
    }
    setLoading(false);
  };

  const ov = analytics?.overview;

  return (
    <div className="module-page">
      <div className="module-header">
        <Shield size={22} color="#ef4444" />
        <div>
          <h2>Fraud Detection</h2>
          <p className="muted">Detect fraudulent insurance claims — all analytics from your uploaded dataset.</p>
        </div>
      </div>

      <DatasetSelector onSelect={(ds) => { setDataset(ds); loadAnalytics(ds); }} selectedId={dataset?.id} />

      {loading && <div className="loading-banner"><Activity size={16} className="spin" /> Analyzing fraud patterns…</div>}
      {error && <div className="error-banner"><AlertTriangle size={16} /> {error}</div>}

      {analytics && !analytics.compatible && (
        <div className="warn-banner">
          <AlertTriangle size={16} /> {analytics.message}
          {analytics.claim_summary && (
            <>
              <h4 style={{marginTop:"1rem"}}>Claim Summary (no fraud labels)</h4>
              <div className="stats-grid" style={{marginTop:".5rem"}}>
                <StatCard label="Total Claims" value={fmtNumber(analytics.claim_summary.total_claims)} icon={Users} color="#2563eb" />
                <StatCard label="Total Amount" value={`$${fmtNumber(analytics.claim_summary.total_amount)}`} icon={DollarSign} color="#059669" />
                <StatCard label="Avg Amount" value={`$${fmtNumber(analytics.claim_summary.avg_amount)}`} icon={TrendingUp} color="#d97706" />
              </div>
            </>
          )}
        </div>
      )}

      {analytics && analytics.compatible && ov && (
        <>
          <div className="stats-grid" style={{marginTop:"1rem"}}>
            <StatCard label="Total Claims" value={fmtNumber(ov.total_claims)} icon={Users} color="#2563eb" />
            <StatCard label="Fraud Cases" value={fmtNumber(ov.fraud_count)} icon={AlertTriangle} color="#ef4444" />
            <StatCard label="Legitimate" value={fmtNumber(ov.legitimate_count)} icon={CheckCircle} color="#22c55e" />
            <StatCard label="Fraud Rate" value={`${ov.fraud_percentage}%`} icon={Shield} color="#f59e0b" />
          </div>

          <div className="charts-grid" style={{marginTop:"1rem"}}>
            {/* Fraud distribution pie */}
            <div className="chart-card">
              <h4>Fraud vs Legitimate Distribution</h4>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={analytics.distribution} dataKey="value" nameKey="label"
                    cx="50%" cy="50%" outerRadius={100} innerRadius={50}
                    label={({label, percent}) => `${label} ${(percent*100).toFixed(1)}%`}>
                    {analytics.distribution.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Amount analysis */}
            {analytics.amount_analysis && (
              <div className="chart-card">
                <h4>Avg Claim Amount: Fraud vs Legitimate</h4>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={[
                    {name: "Fraudulent", amount: analytics.amount_analysis.fraud_avg},
                    {name: "Legitimate", amount: analytics.amount_analysis.legit_avg},
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
                    <Bar dataKey="amount" radius={[4,4,0,0]}>
                      <Cell fill="#ef4444" />
                      <Cell fill="#22c55e" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="stats-mini-row">
                  <div className="sm-stat">
                    <span className="sm-label">Fraud Total</span>
                    <span className="sm-val" style={{color:"#ef4444"}}>${fmtNumber(analytics.amount_analysis.fraud_total)}</span>
                  </div>
                  <div className="sm-stat">
                    <span className="sm-label">Legit Total</span>
                    <span className="sm-val" style={{color:"#22c55e"}}>${fmtNumber(analytics.amount_analysis.legit_total)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Provider analysis */}
            {analytics.provider_analysis && analytics.provider_analysis.length > 0 && (
              <div className="chart-card full-width">
                <h4>Top Providers by Fraud Rate</h4>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.provider_analysis} margin={{bottom:40}}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="provider" angle={-30} textAnchor="end" tick={{fontSize:9}} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" unit="%" />
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="fraud_count" fill="#ef4444" name="Fraud Count" radius={[3,3,0,0]} />
                    <Bar yAxisId="right" dataKey="fraud_rate" fill="#f59e0b" name="Fraud Rate %" radius={[3,3,0,0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Monthly trend */}
            {analytics.monthly_trend && analytics.monthly_trend.length > 0 && (
              <div className="chart-card full-width">
                <h4>Monthly Fraud Trend</h4>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={analytics.monthly_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" angle={-30} textAnchor="end" tick={{fontSize:9}} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="total" stroke="#2563eb" name="Total Claims" strokeWidth={2} />
                    <Line type="monotone" dataKey="fraud" stroke="#ef4444" name="Fraud" strokeWidth={2} dot={{r:3}} />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* High-value analysis */}
            {analytics.high_value_analysis && (
              <div className="chart-card">
                <h4>High-Value Claim Analysis (Top 5%)</h4>
                <div className="kpi-grid">
                  <div className="kpi-item">
                    <span className="kpi-label">Amount Threshold</span>
                    <span className="kpi-val">${fmtNumber(analytics.high_value_analysis.threshold)}</span>
                  </div>
                  <div className="kpi-item">
                    <span className="kpi-label">High-Value Claims</span>
                    <span className="kpi-val">{fmtNumber(analytics.high_value_analysis.high_value_count)}</span>
                  </div>
                  <div className="kpi-item">
                    <span className="kpi-label">Fraud in High-Value</span>
                    <span className="kpi-val" style={{color:"#ef4444"}}>{fmtNumber(analytics.high_value_analysis.high_value_fraud_count)}</span>
                  </div>
                  <div className="kpi-item">
                    <span className="kpi-label">High-Value Fraud Rate</span>
                    <span className="kpi-val" style={{color:"#ef4444"}}>{analytics.high_value_analysis.high_value_fraud_pct}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
