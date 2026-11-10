import React from "react";
import { Link } from "react-router-dom";
import { Database, ArrowLeft } from "lucide-react";

export default function Placeholder({ title, description }) {
  return (
    <div className="placeholder-page">
      <div className="ph-icon"><Database size={56} color="#cbd5e1" /></div>
      <h2>{title}</h2>
      <p>{description}</p>
      <p className="muted">Select an uploaded dataset in <Link to="/datasets">Dataset Management</Link> to enable this module.</p>
      <Link to="/datasets" className="btn-primary"><ArrowLeft size={16} /> Go to Dataset Management</Link>
    </div>
  );
}
