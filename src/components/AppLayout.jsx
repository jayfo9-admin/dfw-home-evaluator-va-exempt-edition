import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, GitCompare, Upload, UserCircle } from "lucide-react";

const navItems = [
  { path: "/", label: "Homes", icon: LayoutDashboard },
  { path: "/compare", label: "Compare", icon: GitCompare },
  { path: "/sync", label: "Sync", icon: Upload },
  { path: "/profile", label: "Profile", icon: UserCircle },
];

export default function AppLayout() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="font-heading text-lg sm:text-2xl font-bold tracking-tight">
              DFW Home Evaluator
            </h1>
            <p className="text-xs opacity-70 font-body">VA-Exempt Edition</p>
          </div>
          <nav className="flex items-center gap-1 bg-white/10 rounded-lg p-1 overflow-x-auto">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  pathname === path
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:text-white/90 hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden xs:inline sm:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 overflow-x-hidden">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground font-body">
        100% P&T Disabled Veteran — $0 Property Tax · DFW Relocation Engine
        <span className="ml-2 opacity-50">· build {__BUILD_DATE__}</span>
      </footer>
    </div>
  );
}