import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

export function Button({
  children,
  tone = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "ghost" | "danger" | "soft" }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        tone === "primary" && "bg-brand text-white shadow-sm shadow-brand/25 hover:bg-brand-dark",
        tone === "soft" && "bg-brand-soft text-brand-dark hover:bg-sky-100",
        tone === "ghost" && "border border-line bg-white text-ink hover:bg-slate-50",
        tone === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-muted">{label}</span>
      {children}
    </label>
  );
}

export const controlClass =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10";

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "blue" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide capitalize",
        tone === "slate" && "bg-slate-100 text-slate-600",
        tone === "green" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
        tone === "amber" && "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
        tone === "blue" && "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): "green" | "amber" | "slate" {
  if (status === "active") return "green";
  if (status === "draft") return "amber";
  return "slate";
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[1.65rem] font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("surface-card", className)}>{children}</div>;
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="relative overflow-hidden px-4 py-4">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand/0 via-brand/60 to-brand/0" />
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className="mt-2 text-[1.75rem] font-semibold tracking-tight text-ink">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand shadow-sm">{icon}</div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
