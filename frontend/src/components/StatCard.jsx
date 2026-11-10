import React from "react";

export default function StatCard({ label, value, sub, icon: Icon, color = "#2563eb" }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: color + "20", color }}>
        {Icon && <Icon size={22} />}
      </div>
      <div className="stat-info">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}
