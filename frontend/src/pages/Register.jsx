import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, AlertCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name:"", email:"", phone:"", password:"", confirm:"", policy_number:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm(p => ({...p, [k]: e.target.value}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    setLoading(true); setError("");
    try {
      await register({ full_name: form.full_name, email: form.email, phone: form.phone, password: form.password, policy_number: form.policy_number });
      nav("/my-claims");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed.");
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <div className="auth-brand">
          <Shield size={32} color="#2563eb" />
          <h1>Risk Guard AI</h1>
          <p>Create your account</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Register</h2>
          {error && <div className="error-banner"><AlertCircle size={15}/> {error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>Full Name *</label>
              <input className="input" value={form.full_name} onChange={set("full_name")} placeholder="John Smith" required />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input className="input" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input className="input" value={form.phone} onChange={set("phone")} placeholder="+1 555 000 0000" />
            </div>
            <div className="form-group">
              <label>Policy Number (if known)</label>
              <input className="input" value={form.policy_number} onChange={set("policy_number")} placeholder="POL123456" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Password *</label>
              <input className="input" type="password" value={form.password} onChange={set("password")} placeholder="Min 8 chars" required />
            </div>
            <div className="form-group">
              <label>Confirm Password *</label>
              <input className="input" type="password" value={form.confirm} onChange={set("confirm")} placeholder="Repeat password" required />
            </div>
          </div>

          <button className="btn-primary" style={{width:"100%", justifyContent:"center", marginTop:".5rem"}} disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p style={{textAlign:"center", marginTop:"1rem", fontSize:".84rem"}}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
