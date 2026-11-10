import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter,
} from "recharts";

const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#059669", "#d97706", "#0891b2", "#dc2626", "#65a30d"];

function HistogramChart({ data, col }) {
  const values = data.map((r) => Number(r[col])).filter(Number.isFinite);
  if (!values.length) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const bins = 20;
  const step = (max - min) / bins || 1;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    range: `${(min + i * step).toFixed(1)}`,
    count: 0,
  }));
  values.forEach((v) => {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1);
    buckets[idx].count++;
  });
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={buckets} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="range" angle={-45} textAnchor="end" tick={{ fontSize: 10 }} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#2563eb" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CatBarChart({ data, col }) {
  const freq = {};
  data.forEach((r) => { const v = String(r[col] ?? "null"); freq[v] = (freq[v] || 0) + 1; });
  const chartData = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, value]) => ({ name, value }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" angle={-30} textAnchor="end" tick={{ fontSize: 10 }} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#7c3aed" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieDonut({ data, col }) {
  const freq = {};
  data.forEach((r) => { const v = String(r[col] ?? "null"); freq[v] = (freq[v] || 0) + 1; });
  const chartData = Object.entries(freq).slice(0, 8).map(([name, value]) => ({ name, value }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
          {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ScatterPlot({ data, xCol, yCol }) {
  const chartData = data.slice(0, 500).map((r) => ({ x: Number(r[xCol]), y: Number(r[yCol]) })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid />
        <XAxis type="number" dataKey="x" name={xCol} tick={{ fontSize: 10 }} />
        <YAxis type="number" dataKey="y" name={yCol} tick={{ fontSize: 10 }} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={chartData} fill="#2563eb" opacity={0.6} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export default function DynamicCharts({ columns, previewData }) {
  const numCols = columns.filter((c) => c.category === "numerical");
  const catCols = columns.filter((c) => c.category === "categorical");

  const [xCol, setXCol] = useState(numCols[0]?.name || "");
  const [yCol, setYCol] = useState(numCols[1]?.name || "");
  const [chartType, setChartType] = useState("auto");

  if (!previewData || previewData.length === 0) return <p className="muted">No preview data available.</p>;

  return (
    <div className="chart-section">
      <div className="chart-controls">
        <div className="ctrl-group">
          <label>X Axis</label>
          <select value={xCol} onChange={(e) => setXCol(e.target.value)}>
            {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="ctrl-group">
          <label>Y Axis</label>
          <select value={yCol} onChange={(e) => setYCol(e.target.value)}>
            {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="ctrl-group">
          <label>Chart Type</label>
          <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
            <option value="auto">Auto</option>
            <option value="bar">Bar</option>
            <option value="pie">Pie/Donut</option>
            <option value="scatter">Scatter</option>
            <option value="histogram">Histogram</option>
          </select>
        </div>
      </div>

      <div className="charts-grid">
        {/* Custom chart based on controls */}
        {xCol && (
          <div className="chart-card">
            <h4>{xCol} {yCol && xCol !== yCol ? `vs ${yCol}` : "— Distribution"}</h4>
            {(chartType === "scatter" || (chartType === "auto" && xCol !== yCol && columns.find(c=>c.name===xCol)?.category==="numerical" && columns.find(c=>c.name===yCol)?.category==="numerical")) ? (
              <ScatterPlot data={previewData} xCol={xCol} yCol={yCol || xCol} />
            ) : (chartType === "pie" || (chartType === "auto" && columns.find(c=>c.name===xCol)?.category==="categorical" && columns.find(c=>c.name===xCol)?.stats?.unique_count <= 8)) ? (
              <PieDonut data={previewData} col={xCol} />
            ) : (chartType === "histogram" || (chartType === "auto" && columns.find(c=>c.name===xCol)?.category==="numerical")) ? (
              <HistogramChart data={previewData} col={xCol} />
            ) : (
              <CatBarChart data={previewData} col={xCol} />
            )}
          </div>
        )}

        {/* Auto-generated charts for all numerical columns */}
        {numCols.slice(0, 3).map((col) => (
          <div key={col.name} className="chart-card">
            <h4>{col.name} — Distribution</h4>
            <HistogramChart data={previewData} col={col.name} />
            <div className="chart-stats">
              <span>Mean: {col.stats?.mean?.toFixed(2) ?? "—"}</span>
              <span>Median: {col.stats?.median?.toFixed(2) ?? "—"}</span>
              <span>Std: {col.stats?.std?.toFixed(2) ?? "—"}</span>
            </div>
          </div>
        ))}

        {/* Categorical charts */}
        {catCols.slice(0, 3).map((col) => (
          <div key={col.name} className="chart-card">
            <h4>{col.name} — Categories</h4>
            {col.stats?.unique_count <= 8
              ? <PieDonut data={previewData} col={col.name} />
              : <CatBarChart data={previewData} col={col.name} />}
          </div>
        ))}

        {/* Scatter for first two numerical */}
        {numCols.length >= 2 && (
          <div className="chart-card">
            <h4>{numCols[0].name} vs {numCols[1].name}</h4>
            <ScatterPlot data={previewData} xCol={numCols[0].name} yCol={numCols[1].name} />
          </div>
        )}
      </div>
    </div>
  );
}
