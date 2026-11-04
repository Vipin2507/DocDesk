import { format, isValid, parse, parseISO } from "date-fns";
import type { VariableType } from "./types";

const DATE_FORMATS = [
  "yyyy-MM-dd",
  "dd/MM/yyyy",
  "d/M/yyyy",
  "MM/dd/yyyy",
  "dd-MM-yyyy",
  "d MMM yyyy",
  "dd MMM yyyy",
  "d MMMM yyyy",
  "dd MMMM yyyy",
];

export function coerceNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const cleaned = value.replace(/[₹$€£,\s]/g, "").replace(/rs\.?/i, "");
  if (!cleaned) return Number.NaN;
  return Number(cleaned);
}

export function parseDate(value: unknown): Date | null {
  if (value instanceof Date && isValid(value)) return value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const iso = parseISO(raw);
    if (isValid(iso)) return iso;
  }
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(raw, fmt, new Date(2000, 0, 1));
    if (isValid(parsed)) return parsed;
  }
  return null;
}

export function formatDate(value: unknown): string {
  if (value == null || value === "") return "";
  const parsed = parseDate(value);
  if (!parsed) return String(value);
  return format(parsed, "dd MMM yyyy");
}

export function toDateInputValue(value: unknown): string {
  const parsed = parseDate(value);
  if (!parsed) return "";
  return format(parsed, "yyyy-MM-dd");
}

export function formatCurrency(value: unknown): string {
  if (value == null || value === "") return "";
  const amount = coerceNumber(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: unknown): string {
  if (value == null || value === "") return "";
  const raw = String(value).trim().replace(/%$/, "");
  const amount = coerceNumber(raw);
  if (!Number.isFinite(amount)) return String(value);
  const body = Number.isInteger(amount) ? String(amount) : String(amount);
  return `${body}%`;
}

export function formatVariableValue(type: VariableType, value: unknown): string {
  if (value == null) return "";
  switch (type) {
    case "currency":
      return formatCurrency(value);
    case "date":
      return formatDate(value);
    case "percent":
      return formatPercent(value);
    case "checkbox":
      return value === true || value === "true" || value === "yes" || value === "Yes" ? "Yes" : "No";
    case "number": {
      const amount = coerceNumber(value);
      return Number.isFinite(amount) ? String(amount) : "";
    }
    case "lineItems":
    case "image":
      return "";
    default:
      return String(value);
  }
}

export function filenamePart(value: string): string {
  const clean = value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return clean.slice(0, 60);
}

export function buildPdfFilename(templateName: string, primaryValue: string, when = new Date()): string {
  const date = format(when, "yyyy-MM-dd");
  const parts = [filenamePart(templateName) || "Document", filenamePart(primaryValue), date].filter(Boolean);
  return `${parts.join("_")}.pdf`;
}
