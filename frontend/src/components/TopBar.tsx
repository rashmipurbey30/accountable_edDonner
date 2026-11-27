import { Building2, DollarSign, Kanban, LayoutDashboard, Users, type LucideIcon } from "lucide-react";
import { NavLink } from "react-router";
import "./TopBar.css";

const SECTIONS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/organizations", label: "Organizations", icon: Building2 },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/deals", label: "Deals", icon: DollarSign },
  { to: "/pipeline", label: "Pipeline", icon: Kanban },
];

export function TopBar() {
  return (
    <header className="top">
      <NavLink to="/" className="brand" aria-label="Accountable, go to the dashboard">
        <span className="logo" aria-hidden="true">
          A
        </span>
        <span>Accountable</span>
      </NavLink>
      <nav aria-label="Sections" className="nav">
        {SECTIONS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="nav-item" aria-label={label}>
            <Icon aria-hidden="true" />
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
