"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  NotebookPen,
  Target,
  CalendarDays,
  Wallet,
  FolderClosed,
  ChartNoAxesCombined,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useState } from "react";
const items = [
  ["/dashboard", "Panoramica", LayoutDashboard],
  ["/dipendenti", "Dipendenti", Users],
  ["/valutazioni", "Valutazioni", ClipboardCheck],
  ["/diario", "Diario", NotebookPen],
  ["/obiettivi", "Obiettivi e formazione", Target],
  ["/assenze", "Assenze e presenze", CalendarDays],
  ["/retribuzioni", "Retribuzioni", Wallet],
  ["/documenti", "Documenti", FolderClosed],
  ["/report", "Report annuali", ChartNoAxesCombined],
  ["/sedi", "Punti vendita", Store],
  ["/impostazioni", "Impostazioni", Settings],
] as const;
export function Navigation({ role, name }: { role: string; name: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const admin = role !== "responsabile";
  return (
    <>
      <button
        className="mobile-menu"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Chiudi menu" : "Apri menu"}
      >
        {open ? <X /> : <Menu />}
        <span>
          GIANNO <b>PEOPLE</b>
        </span>
      </button>
      {open && (
        <button
          className="sidebar-shade"
          aria-label="Chiudi menu"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">g.</span>
          <span>
            GIANNO<small>PEOPLE & CULTURE</small>
          </span>
        </Link>
        <p className="nav-heading">IL TUO SPAZIO DI LAVORO</p>
        <nav>
          {items
            .filter(
              ([path]) =>
                (path !== "/report" || role === "direzione") &&
                (admin ||
                  ![
                    "/assenze",
                    "/retribuzioni",
                    "/impostazioni",
                    "/sedi",
                    "/documenti",
                  ].includes(path)),
            )
            .map(([path, label, Icon]) => (
              <Link
                key={path}
                href={path}
                onClick={() => setOpen(false)}
                className={
                  pathname.startsWith(path) ? "nav-item active" : "nav-item"
                }
              >
                <Icon size={19} />
                <span>{label}</span>
                {path === "/valutazioni" && <span className="nav-dot" />}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={18} />
            <span>
              Uno spazio sicuro,
              <br />
              dedicato alle persone.
            </span>
          </div>
          <div className="sidebar-user">
            <span className="user-dot">{name.charAt(0) || "G"}</span>
            <div>
              <strong>{name}</strong>
              <small>
                {role === "direzione"
                  ? "Direzione"
                  : role === "hr"
                    ? "HR / Amministrazione"
                    : "Responsabile di sede"}
              </small>
            </div>
            <form action="/auth/signout" method="post">
              <button title="Esci" className="icon-button">
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
