import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Inbox, Activity, History, Bookmark, CreditCard, Settings,
  Plus, Menu, X, LogOut,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const NAV = [
  { to: "/dashboard", label: "My Doubts", icon: Inbox, end: true },
  { to: "/dashboard/active", label: "Active Sessions", icon: Activity },
  { to: "/dashboard/history", label: "History", icon: History },
  { to: "/dashboard/saved", label: "Saved Tutors", icon: Bookmark },
  { to: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-canvas-alt" data-testid="dashboard-layout">
      {/* top bar */}
      <header className="bg-white border-b border-line sticky top-0 z-30">
        <div className="px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 text-ink"
              onClick={() => setOpen(!open)}
              aria-label="Toggle sidebar"
              data-testid="dash-sidebar-toggle"
            >
              {open ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
            </button>
            <Link to="/" className="font-display font-bold text-[20px] text-ink" data-testid="dash-logo">
              Unstuck<span className="text-purple-primary">.</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/doubts/new" className="u-btn-primary !py-2.5 !px-4 text-[14px]" data-testid="dash-new-doubt">
              <Plus size={16} strokeWidth={2} /> New Doubt
            </Link>
            <div className="w-9 h-9 rounded-full bg-purple-soft flex items-center justify-center text-purple-primary font-display font-semibold text-[14px]" title={user?.name} data-testid="dash-avatar">
              {(user?.name || "U").slice(0, 1).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* sidebar */}
        <aside
          className={`${open ? "block" : "hidden"} md:block fixed md:static z-20 inset-y-16 left-0 w-64 bg-white border-r border-line min-h-[calc(100vh-64px)] py-6 px-3`}
          data-testid="dash-sidebar"
        >
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-md text-[14.5px] font-medium transition-colors ${
                      isActive
                        ? "bg-purple-soft text-purple-primary"
                        : "text-ink-muted hover:bg-canvas-alt hover:text-ink"
                    }`
                  }
                  data-testid={`dash-nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  {n.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="absolute bottom-6 left-3 right-3">
            <button
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-[14.5px] font-medium text-ink-muted hover:bg-canvas-alt hover:text-ink w-full"
              onClick={handleSignOut}
              data-testid="dash-signout"
            >
              <LogOut size={18} strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 px-4 md:px-10 py-8 md:py-12">{children}</main>
      </div>
    </div>
  );
}
