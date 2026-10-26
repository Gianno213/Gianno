import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Search, Inbox, Check, AlertCircle } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow || "GIANNO PEOPLE"}</p>
        <h1>{title}</h1>
        {description && <p className="subtitle">{description}</p>}
      </div>
      {children && <div className="header-actions">{children}</div>}
    </header>
  );
}
export function Card({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-heading">
          <div>
            <h2>{title}</h2>
            {description && <p className="muted">{description}</p>}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Empty({
  title = "Ancora nessun dato",
  description = "Le informazioni appariranno qui dopo il primo inserimento.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={23} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Submit({ children = "Salva" }: { children?: ReactNode }) {
  return (
    <button className="button" type="submit">
      <Check size={16} />
      {children}
    </button>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div className={`notice notice-${tone}`}>
      <AlertCircle size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Stat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon?: ReactNode;
}) {
  return (
    <section className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon || <ArrowUpRight size={18} />}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </section>
  );
}
export function SearchForm({
  placeholder = "Cerca per nome…",
  children,
  defaultValue = "",
}: {
  placeholder?: string;
  children?: ReactNode;
  defaultValue?: string;
}) {
  return (
    <form className="filters" method="get">
      <div className="search-input">
        <Search size={17} />
        <input name="q" placeholder={placeholder} defaultValue={defaultValue} />
      </div>
      {children}
      <button className="button button-secondary" type="submit">
        Applica filtri
      </button>
    </form>
  );
}
export function Avatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  return (
    <span className={`avatar ${small ? "avatar-small" : ""}`}>
      {name
        .split(" ")
        .map((v) => v[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function EmployeeName({
  id,
  name,
  subtitle,
}: {
  id: string;
  name: string;
  subtitle?: string;
}) {
  return (
    <Link href={`/dipendenti/${id}`} className="person">
      <Avatar name={name} small />
      <span>
        <strong>{name}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </Link>
  );
}
export function money(value: number | null | undefined) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR",
      }).format(value);
}
export function date(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome" }).format(
        new Date(value),
      )
    : "—";
}
export const labels: Record<string, string> = {
  active: "Attivo",
  inactive: "Cessato",
  suspended: "Sospeso",
  attivo: "Attivo",
  cessato: "Cessato",
  sospeso: "Sospeso",
  draft: "Bozza",
  submitted: "Inviata",
  review: "Da verificare",
  approved: "Convalidata",
  not_evaluable: "Non valutabile",
  positive: "Episodio positivo",
  concern: "Criticità lavorativa",
  observation: "Osservazione",
  improvement: "Miglioramento",
  training: "Formazione",
  todo: "Da iniziare",
  in_progress: "In corso",
  completed: "Completato",
  to_review: "Da rivedere",
  pending: "Da verificare",
  verified: "Verificato",
  vacation: "Ferie",
  leave: "Permesso",
  sick: "Malattia",
  other: "Altra assenza",
  ordinary: "Ordinaria",
  thirteenth: "Tredicesima",
  fourteenth: "Quattordicesima",
};
export function statusLabel(value: string) {
  return labels[value] || value;
}
export function Feedback({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  return (
    <>
      {params.success && (
        <Notice tone="success">{String(params.success)}</Notice>
      )}
      {params.error && <Notice tone="danger">{String(params.error)}</Notice>}
    </>
  );
}
