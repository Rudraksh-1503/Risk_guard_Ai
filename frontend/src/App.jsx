import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import DatasetManagement from "./pages/DatasetManagement";
import PremiumPrediction from "./pages/PremiumPrediction";
import FraudDetection from "./pages/FraudDetection";
import ExplainableAI from "./pages/ExplainableAI";
import WhatIfSimulation from "./pages/WhatIfSimulation";
import ClaimForecasting from "./pages/ClaimForecasting";
import ModelRegistry from "./pages/ModelRegistry";
import Login from "./pages/Login";
import Register from "./pages/Register";
import SubmitClaim from "./pages/SubmitClaim";
import MyClaims from "./pages/MyClaims";
import AdminPanel from "./pages/AdminPanel";
import "./App.css";

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-full"><div className="spinner"/></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin" && user.role !== "authority") return <Navigate to="/my-claims" replace />;
  return children;
}

function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/datasets"    element={<DatasetManagement />} />
          <Route path="/premium"     element={<PremiumPrediction />} />
          <Route path="/fraud"       element={<FraudDetection />} />
          <Route path="/explainable" element={<ExplainableAI />} />
          <Route path="/whatif"      element={<WhatIfSimulation />} />
          <Route path="/forecast"    element={<ClaimForecasting />} />
          <Route path="/models"      element={<ModelRegistry />} />
          <Route path="/submit-claim" element={<ProtectedRoute><SubmitClaim /></ProtectedRoute>} />
          <Route path="/my-claims"   element={<ProtectedRoute><MyClaims /></ProtectedRoute>} />
          <Route path="/admin"       element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*"        element={<AppLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
