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
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
        tone === "primary" && "bg-brand text-white hover:bg-brand-dark",
        tone === "soft" && "bg-brand/10 text-brand-dark hover:bg-brand/15",
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
      <span className="mb-1 block font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

export const controlClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand";

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "blue" }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "slate" && "bg-slate-100 text-slate-600",
        tone === "green" && "bg-emerald-50 text-emerald-700",
        tone === "amber" && "bg-amber-50 text-amber-700",
        tone === "blue" && "bg-sky-50 text-sky-700",
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
