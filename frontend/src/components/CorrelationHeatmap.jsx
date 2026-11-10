import React from "react";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function corrToColor(val) {
  if (val === null || val === undefined) return "#e2e8f0";
  const v = Math.max(-1, Math.min(1, val));
  if (v >= 0) {
    const t = v;
    const r = Math.round(lerp(255, 37, t));
    const g = Math.round(lerp(255, 99, t));
    const b = Math.round(lerp(255, 235, t));
    return `rgb(${r},${g},${b})`;
  } else {
    const t = -v;
    const r = Math.round(lerp(255, 239, t));
    const g = Math.round(lerp(255, 68, t));
    const b = Math.round(lerp(255, 68, t));
    return `rgb(${r},${g},${b})`;
  }
}

export default function CorrelationHeatmap({ correlation }) {
  if (!correlation || Object.keys(correlation).length === 0) {
    return <p className="muted">Not enough numerical columns for correlation.</p>;
  }
  const cols = Object.keys(correlation);
  return (
    <div className="heatmap-wrap">
      <table className="heatmap-table">
        <thead>
          <tr>
            <th></th>
            {cols.map((c) => <th key={c} title={c}>{c.length > 8 ? c.slice(0, 8) + "…" : c}</th>)}
          </tr>
        </thead>
        <tbody>
          {cols.map((row) => (
            <tr key={row}>
              <td className="heatmap-row-label" title={row}>{row.length > 8 ? row.slice(0, 8) + "…" : row}</td>
              {cols.map((col) => {
                const val = correlation[row]?.[col];
                return (
                  <td key={col} style={{ background: corrToColor(val), color: Math.abs(val||0) > 0.5 ? "#fff" : "#1e293b" }} title={`${row} vs ${col}: ${val?.toFixed(3)}`}>
                    {val !== undefined ? val.toFixed(2) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="heatmap-legend">
        <span style={{ color: "#ef4444" }}>−1 Negative</span>
        <span style={{ color: "#94a3b8" }}>0 None</span>
        <span style={{ color: "#2563eb" }}>+1 Positive</span>
      </div>
    </div>
  );
}
