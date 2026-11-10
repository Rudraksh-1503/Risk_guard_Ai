import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Database, TrendingUp, Shield,
  Lightbulb, FlaskConical, BarChart2, Brain, ChevronRight,
  FileText, Plus, LogOut, User, ShieldCheck, Menu, X
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const AI_NAV = [
  { to: "/",            icon: LayoutDashboard, label: "Dashboard" },
  { to: "/datasets",    icon: Database,        label: "Dataset Management" },
  { to: "/premium",     icon: TrendingUp,      label: "Premium Prediction" },
  { to: "/fraud",       icon: Shield,          label: "Fraud Detection" },
  { to: "/explainable", icon: Lightbulb,       label: "Explainable AI" },
  { to: "/whatif",      icon: FlaskConical,    label: "What-If Simulation" },
  { to: "/forecast",    icon: BarChart2,       label: "Claim Forecasting" },
  { to: "/models",      icon: Brain,           label: "Model Registry" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); nav("/login"); };

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-brand">
        <Shield size={26} color="#2563eb" />
        {!collapsed && <span>Risk Guard AI</span>}
        <button className="btn-icon ml-auto" style={{color:"#94a3b8"}} onClick={() => setCollapsed(c => !c)}>
          {collapsed ? <Menu size={16}/> : <X size={16}/>}
        </button>
      </div>

      {/* Claims section */}
      {user && (
        <div className="sidebar-section">
          {!collapsed && <span className="sidebar-section-label">Claims Portal</span>}
          <NavLink to="/my-claims" className={({isActive})=>`sidebar-link${isActive?" active":""}`}>
            <FileText size={17}/>{!collapsed && <span>My Claims</span>}<ChevronRight size={13} className="sidebar-chevron"/>
          </NavLink>
          <NavLink to="/submit-claim" className={({isActive})=>`sidebar-link${isActive?" active":""}`}>
            <Plus size={17}/>{!collapsed && <span>Submit Claim</span>}<ChevronRight size={13} className="sidebar-chevron"/>
          </NavLink>
          {(user.role === "admin" || user.role === "authority") && (
            <NavLink to="/admin" className={({isActive})=>`sidebar-link${isActive?" active":""}`}>
              <ShieldCheck size={17}/>{!collapsed && <span>Admin Panel</span>}<ChevronRight size={13} className="sidebar-chevron"/>
            </NavLink>
          )}
        </div>
      )}

      {/* AI section */}
      <div className="sidebar-section">
        {!collapsed && <span className="sidebar-section-label">AI Analytics</span>}
        <nav className="sidebar-nav">
          {AI_NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to==="/"} className={({isActive})=>`sidebar-link${isActive?" active":""}`}>
              <Icon size={17}/>{!collapsed && <span>{label}</span>}<ChevronRight size={13} className="sidebar-chevron"/>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        {user ? (
          <div className="sidebar-user">
            <div className="su-avatar"><User size={14}/></div>
            {!collapsed && (
              <div className="su-info">
                <span className="su-name">{user.full_name}</span>
                <span className="su-role">{user.role}</span>
              </div>
            )}
            <button className="btn-icon" style={{color:"#94a3b8", marginLeft:"auto"}} onClick={handleLogout} title="Logout">
              <LogOut size={14}/>
            </button>
          </div>
        ) : (
          !collapsed && (
            <NavLink to="/login" className="btn-primary sm" style={{width:"100%", justifyContent:"center"}}>Sign In</NavLink>
          )
        )}
        {!collapsed && <p style={{fontSize:".68rem", color:"#475569", marginTop:".4rem"}}>v2.1.0 · Risk Guard AI</p>}
      </div>
    </aside>
  );
}
