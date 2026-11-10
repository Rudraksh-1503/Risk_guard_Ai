import React, { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, BarChart, Bar
} from "recharts";
import { BarChart2, TrendingUp, TrendingDown, Calendar, DollarSign, Activity, AlertCircle } from "lucide-react";
import DatasetSelector from "../components/DatasetSelector";
import StatCard from "../components/StatCard";
import { forecastAPI } from "../services/api";
import { fmtNumber } from "../utils/format";

export default function ClaimForecasting() {
  const [dataset, setDataset] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [periods, setPeriods] = useState(6);

  const loadAnalytics = async (ds, p = periods) => {
    if (!ds) return;
    setLoading(true); setError(""); setAnalytics(null);
    try {
      const res = await forecastAPI.analytics(ds.id, p);
      setAnalytics(res.data);
    } catch (e) {
      setError("Could not load forecast analytics.");
    }
    setLoading(false);
  };

  const s = analytics?.summary;

  // Merge history + forecast for combined chart
  const combinedData = [
    ...(analytics?.history || []).map((h) => ({ ...h, type: "historical" })),
    ...(analytics?.forecast || []).map((f) => ({ month: f.month, total: f.forecast, lower: f.lower_bound, upper: f.upper_bound, type: "forecast" })),
  ];

  return (
    <div className="module-page">
      <div className="module-header">
        <BarChart2 size={22} color="#059669" />
        <div>
          <h2>Claim Forecasting</h2>
          <p className="muted">Time-series analysis and volume forecasting from your uploaded claims dataset.</p>
        </div>
      </div>

      <DatasetSelector onSelect={(ds) => { setDataset(ds); loadAnalytics(ds); }} selectedId={dataset?.id} />

      {loading && <div className="loading-banner"><Activity size={16} className="spin" /> Building forecast…</div>}
      {error && <div className="error-banner"><AlertCircle size={16} /> {error}</div>}

      {analytics && !analytics.compatible && (
        <div className="warn-banner"><AlertCircle size={16} /> {analytics.message}</div>
      )}

      {analytics && analytics.compatible && (
        <>
          <div className="stats-grid" style={{marginTop:"1rem"}}>
            <StatCard label="Total Months" value={s.total_months} icon={Calendar} color="#059669" />
            <StatCard label="Total Amount" value={`$${fmtNumber(s.total_amount)}`} icon={DollarSign} color="#2563eb" />
            <StatCard label="Avg Monthly" value={`$${fmtNumber(s.avg_monthly)}`} icon={Activity} color="#7c3aed" />
            <StatCard label="Trend" value={s.trend_direction}
              icon={s.trend_direction === "increasing" ? TrendingUp : TrendingDown}
              color={s.trend_direction === "increasing" ? "#ef4444" : "#22c55e"} />
          </div>

          {/* Forecast controls */}
          <div className="forecast-controls">
            <label>Forecast periods (months):</label>
            {[3, 6, 12].map((p) => (
              <button key={p} className={`chip${periods === p ? " active" : ""}`}
                onClick={() => { setPeriods(p); loadAnalytics(dataset, p); }}>
                {p} months
              </button>
            ))}
          </div>

          <div className="charts-grid" style={{marginTop:"1rem"}}>
            {/* Combined history + forecast */}
            <div className="chart-card full-width">
              <h4>Historical Trend + Forecast (blue = history, dashed = forecast)</h4>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={combinedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" angle={-30} textAnchor="end" tick={{fontSize:9}} height={50} />
                  <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                  <Legend />
                  <ReferenceLine
                    x={analytics.history[analytics.history.length - 1]?.month}
                    stroke="#94a3b8" strokeDasharray="4 4" label="Now"
                  />
                  <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={false} name="Actual / Forecast" connectNulls />
                  <Line type="monotone" dataKey="upper" stroke="#059669" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Upper Bound" />
                  <Line type="monotone" dataKey="lower" stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Lower Bound" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly volume bar */}
            <div className="chart-card full-width">
              <h4>Monthly Claim Volume</h4>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={analytics.history.slice(-24)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" angle={-30} textAnchor="end" tick={{fontSize:9}} height={50} />
                  <YAxis />
                  <Tooltip formatter={(v) => fmtNumber(v)} />
                  <Bar dataKey="count" fill="#2563eb" radius={[2,2,0,0]} name="Claims" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Forecast table */}
            <div className="chart-card full-width">
              <h4>Forecast Details</h4>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Month</th><th>Forecast Amount</th><th>Lower Bound</th><th>Upper Bound</th><th>Confidence Band</th></tr>
                  </thead>
                  <tbody>
                    {analytics.forecast.map((f) => (
                      <tr key={f.month}>
                        <td><strong>{f.month}</strong></td>
                        <td>${fmtNumber(f.forecast)}</td>
                        <td className="muted">${fmtNumber(f.lower_bound)}</td>
                        <td className="muted">${fmtNumber(f.upper_bound)}</td>
                        <td>
                          <div className="ci-bar">
                            <div className="ci-fill" style={{width:`${Math.min(100,(f.upper_bound-f.lower_bound)/f.forecast*50)}%`}} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* YoY comparison */}
            {analytics.yoy_comparison && analytics.yoy_comparison.length > 0 && (
              <div className="chart-card full-width">
                <h4>Year-over-Year Comparison</h4>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.yoy_comparison.slice(-12)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" angle={-30} textAnchor="end" tick={{fontSize:9}} height={50} />
                    <YAxis />
                    <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                    <Bar dataKey="current" fill="#2563eb" name="Current Year" radius={[2,2,0,0]} />
                    <Bar dataKey="previous_year" fill="#94a3b8" name="Previous Year" radius={[2,2,0,0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
