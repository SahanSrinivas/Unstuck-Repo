import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const linkCls = "text-ink hover:text-purple-primary text-[15px] font-medium transition-colors";

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-line">
      <div className="u-container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
          <span className="font-display font-bold text-[22px] tracking-tight text-ink">
            Unstuck<span className="text-purple-primary">.</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8" data-testid="nav-desktop">
          <a href="/#how" className={linkCls} data-testid="nav-how">How it works</a>
          <a href="/#pricing" className={linkCls} data-testid="nav-pricing">Pricing</a>
          <a href="/#why" className={linkCls} data-testid="nav-why">Why Unstuck</a>
          <Link to="/tutor-apply" className={linkCls} data-testid="nav-tutors">Tutors</Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              {user.role === "admin" && (
                <Link to="/admin" className={linkCls} data-testid="nav-admin">Admin</Link>
              )}
              {user.role === "tutor" && (
                <Link to="/tutor" className={linkCls} data-testid="nav-tutor-portal">Tutor portal</Link>
              )}
              <Link to="/dashboard" className={linkCls} data-testid="nav-dashboard">Dashboard</Link>
              <button className="u-btn-secondary" onClick={handleSignOut} data-testid="nav-signout">Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" className={linkCls} data-testid="nav-login">Sign in</Link>
              <Link to="/register" className="u-btn-primary" data-testid="nav-cta">Submit a doubt</Link>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2 text-ink"
          onClick={() => setOpen(!open)}
          aria-label="Open menu"
          data-testid="nav-mobile-toggle"
        >
          {open ? <X size={22} strokeWidth={1.75} /> : <Menu size={22} strokeWidth={1.75} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-line bg-white" data-testid="nav-mobile-menu">
          <div className="u-container py-4 flex flex-col gap-4">
            <a href="/#how" className={linkCls} onClick={() => setOpen(false)}>How it works</a>
            <a href="/#pricing" className={linkCls} onClick={() => setOpen(false)}>Pricing</a>
            <a href="/#why" className={linkCls} onClick={() => setOpen(false)}>Why Unstuck</a>
            <Link to="/tutor-apply" className={linkCls} onClick={() => setOpen(false)}>Tutors</Link>
            <div className="h-px bg-line my-2" />
            {user ? (
              <>
                <Link to="/dashboard" className="u-btn-secondary text-center">Dashboard</Link>
                <button className="u-btn-primary" onClick={handleSignOut}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="u-btn-secondary text-center">Sign in</Link>
                <Link to="/register" className="u-btn-primary text-center">Submit a doubt</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
