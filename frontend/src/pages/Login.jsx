import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const user = await login(email, password);
      nav(user.role === "admin" || user.role === "authority" ? "/admin" : "/my-claims");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Check your credentials.");
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Shield size={36} color="#2563eb" />
          <h1>Risk Guard AI</h1>
          <p>Insurance Claims Portal</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Sign In</h2>
          {error && <div className="error-banner"><AlertCircle size={15}/> {error}</div>}

          <div className="form-group">
            <label><Mail size={13}/> Email</label>
            <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label><Lock size={13}/> Password</label>
            <div className="input-wrap">
              <input className="input" type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />
              <button type="button" className="input-eye" onClick={()=>setShow(!show)}>{show?<EyeOff size={15}/>:<Eye size={15}/>}</button>
            </div>
          </div>

          <button className="btn-primary" style={{width:"100%", justifyContent:"center", marginTop:".5rem"}} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p style={{textAlign:"center", marginTop:"1rem", fontSize:".84rem"}}>
          Don't have an account? <Link to="/register">Register</Link>
        </p>

        <div className="demo-accounts">
          <p><strong>Demo accounts:</strong></p>
          <div className="demo-grid">
            <div className="demo-item" onClick={()=>{setEmail("john@example.com");setPassword("User@123");}}>
              <span className="badge badge-uploaded">User</span>
              <span>john@example.com / User@123</span>
            </div>
            <div className="demo-item" onClick={()=>{setEmail("admin@riskguard.ai");setPassword("Admin@123");}}>
              <span className="badge badge-analyzed">Admin</span>
              <span>admin@riskguard.ai / Admin@123</span>
            </div>
            <div className="demo-item" onClick={()=>{setEmail("authority@riskguard.ai");setPassword("Auth@123");}}>
              <span className="badge badge-regression">Authority</span>
              <span>authority@riskguard.ai / Auth@123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
