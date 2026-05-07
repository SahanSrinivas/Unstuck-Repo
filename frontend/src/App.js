import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import NewDoubt from "./pages/NewDoubt";
import Session from "./pages/Session";
import TutorApply from "./pages/TutorApply";
import ActiveSessions from "./pages/dashboard/ActiveSessions";
import History from "./pages/dashboard/History";
import SavedTutors from "./pages/dashboard/SavedTutors";
import Billing from "./pages/dashboard/Billing";
import Settings from "./pages/dashboard/Settings";

import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/tutor-apply" element={<TutorApply />} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard/active" element={<ProtectedRoute><ActiveSessions /></ProtectedRoute>} />
          <Route path="/dashboard/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/dashboard/saved" element={<ProtectedRoute><SavedTutors /></ProtectedRoute>} />
          <Route path="/dashboard/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
          <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/doubts/new" element={<ProtectedRoute><NewDoubt /></ProtectedRoute>} />
          <Route path="/sessions/:id" element={<ProtectedRoute><Session /></ProtectedRoute>} />

          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  );
}
