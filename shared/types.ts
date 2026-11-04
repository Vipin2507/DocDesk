export const CATEGORIES = [
  "Invoices",
  "Demand Letters",
  "Receipts",
  "Agreements",
  "HR Documents",
  "Offer Letters",
  "Reimbursement Statements",
  "Custom Documents",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const TEMPLATE_STATUSES = ["draft", "active", "archived"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const SOURCE_TYPES = ["pdf", "json", "blank"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const ROLES = ["admin", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const VARIABLE_TYPES = [
  "text",
  "textarea",
  "number",
  "currency",
  "date",
  "percent",
  "email",
  "phone",
  "select",
  "checkbox",
  "radio",
  "image",
  "lineItems",
] as const;

export type VariableType = (typeof VARIABLE_TYPES)[number];

export interface LineColumn {
  key: string;
  label: string;
  type: "text" | "number" | "currency" | "percent";
}

export interface VariableBinding {
  nodeId: string;
  field: "text" | "image" | "table";
}

export interface VariableValidation {
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

export interface VariableDefinition {
  id: string;
  label: string;
  type: VariableType;
  defaultValue: unknown;
  required: boolean;
  group: string;
  order: number;
  options?: string[];
  validation?: VariableValidation;
  bindings: VariableBinding[];
  confidence?: number;
  columns?: LineColumn[];
  tableNodeId?: string;
  headerRowCount?: number;
  summaryRowCount?: number;
}

export interface DocumentDefinition {
  pageSize?: string | { width: number; height: number };
  pageOrientation?: "portrait" | "landscape";
  pageMargins?: number | number[];
  defaultStyle?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  header?: unknown;
  footer?: unknown;
  background?: unknown;
  images?: Record<string, string>;
  content: unknown[];
  watermark?: unknown;
  info?: Record<string, string>;
}

export interface FieldError {
  path: string;
  message: string;
  line?: number;
  column?: number;
}

export type JsonClassification = "pdfmake" | "bundle" | "generic" | "invalid" | "script";

export interface DocumentBundle {
  documentDefinition: DocumentDefinition;
  variableSchema: { variables: VariableDefinition[] };
}

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_PAGES = 50;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
