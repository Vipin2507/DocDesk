import { formatCurrency, formatPercent, formatVariableValue, parseDate, coerceNumber } from "./format";
import { isRecord, mapDocument, stripInternal } from "./document";
import type { DocumentDefinition, FieldError, LineColumn, VariableDefinition } from "./types";

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateValues(variables: VariableDefinition[], values: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  for (const variable of variables) {
    let value = values[variable.id];
    if (value === undefined) {
      const normVar = variable.id.toLowerCase().replace(/[^a-z0-9]/g, "");
      const altKey = Object.keys(values).find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === normVar);
      if (altKey) value = values[altKey];
    }
    const empty =
      value == null ||
      value === "" ||
      (typeof value === "string" && !value.trim()) ||
      (Array.isArray(value) && value.length === 0);
    if (variable.required && empty) {
      errors.push({ path: variable.id, message: `${variable.label} is required.` });
      continue;
    }
    if (empty || variable.type === "lineItems" || variable.type === "image" || variable.type === "checkbox") continue;
    if (
      (variable.type === "number" || variable.type === "currency" || variable.type === "percent") &&
      !Number.isFinite(coerceNumber(value))
    ) {
      errors.push({ path: variable.id, message: `${variable.label} must be a number.` });
    }
    if (variable.type === "date" && !parseDate(value)) {
      errors.push({ path: variable.id, message: `${variable.label} must be a valid date.` });
    }
    if (variable.type === "email" && !EMAIL_RE.test(String(value).trim())) {
      errors.push({ path: variable.id, message: `${variable.label} must be an email address.` });
    }
    if ((variable.type === "select" || variable.type === "radio") && variable.options?.length) {
      if (!variable.options.includes(String(value))) {
        errors.push({ path: variable.id, message: `${variable.label} must be one of the listed options.` });
      }
    }
    if (variable.validation?.pattern) {
      try {
        if (!new RegExp(variable.validation.pattern).test(String(value))) {
          errors.push({ path: variable.id, message: variable.validation.message || `${variable.label} is invalid.` });
        }
      } catch {
        errors.push({ path: variable.id, message: `The validation pattern for ${variable.label} is invalid.` });
      }
    }
    const numeric = coerceNumber(value);
    if (Number.isFinite(numeric) && variable.validation?.min != null && numeric < variable.validation.min) {
      errors.push({ path: variable.id, message: `${variable.label} must be at least ${variable.validation.min}.` });
    }
    if (Number.isFinite(numeric) && variable.validation?.max != null && numeric > variable.validation.max) {
      errors.push({ path: variable.id, message: `${variable.label} must be at most ${variable.validation.max}.` });
    }
  }
  return errors;
}

function lineCell(column: LineColumn, value: unknown): { text: string } {
  if (column.type === "currency") return { text: formatCurrency(value) };
  if (column.type === "percent") return { text: formatPercent(value) };
  if (column.type === "number") {
    const amount = coerceNumber(value);
    return { text: Number.isFinite(amount) ? String(amount) : "" };
  }
  return { text: value == null ? "" : String(value).slice(0, 1000) };
}

function applyLineItems(definition: DocumentDefinition, variables: VariableDefinition[], values: Record<string, unknown>) {
  return mapDocument(definition, (node) => {
    const variable = variables.find((item) => item.type === "lineItems" && item.tableNodeId && item.tableNodeId === node._nodeId);
    if (!variable || !isRecord(node.table) || !Array.isArray(node.table.body) || !variable.columns) return node;
    const source = Array.isArray(values[variable.id]) ? (values[variable.id] as Record<string, unknown>[]) : [];
    const rows = source.slice(0, 200).map((row) => variable.columns!.map((column) => lineCell(column, row?.[column.key])));
    const body = [...node.table.body];
    const headerCount = Math.min(variable.headerRowCount ?? 1, body.length);
    body.splice(headerCount, 0, ...rows);
    return { ...node, table: { ...node.table, body } };
  });
}

function collectUnresolved(node: unknown, missing: Set<string>) {
  if (typeof node === "string") {
    for (const match of node.matchAll(PLACEHOLDER_RE)) missing.add(match[1]);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectUnresolved(item, missing);
    return;
  }
  if (!isRecord(node)) return;
  for (const value of Object.values(node)) collectUnresolved(value, missing);
}

export function resolveDocument(
  definition: DocumentDefinition,
  variables: VariableDefinition[],
  values: Record<string, unknown>,
  options: { strict: boolean },
): { definition: DocumentDefinition; errors: FieldError[]; warnings: string[] } {
  const errors = options.strict ? validateValues(variables, values) : [];
  const warnings: string[] = [];
  const byId = new Map(variables.map((variable) => [variable.id, variable]));
  const rendered = applyLineItems(definition, variables, values);
  const withText = mapDocument(rendered, (node) => {
    if (typeof node.text !== "string") return node;
    const text = node.text.replace(PLACEHOLDER_RE, (token, id: string) => {
      const normalizedId = id.toLowerCase().replace(/[^a-z0-9]/g, "");
      const variable =
        byId.get(id) ||
        byId.get(id.toLowerCase()) ||
        Array.from(byId.values()).find(
          (v) =>
            v.id.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedId ||
            v.label.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedId,
        );
      if (!variable) return options.strict ? token : `[missing: ${id}]`;
      let value = values[id] ?? values[variable.id];
      if (value === undefined) {
        const matchingKey = Object.keys(values).find(
          (k) =>
            k.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedId ||
            k.toLowerCase().replace(/[^a-z0-9]/g, "") === variable.id.toLowerCase().replace(/[^a-z0-9]/g, ""),
        );
        value = matchingKey ? values[matchingKey] : undefined;
      }
      const finalVal = value ?? (options.strict ? "" : variable.defaultValue);
      return formatVariableValue(variable.type, finalVal).slice(0, 5000);
    });
    return { ...node, text };
  });

  const images = { ...(withText.images ?? {}) };
  for (const variable of variables) {
    if (variable.type !== "image") continue;
    const value = values[variable.id];
    if (typeof value !== "string" || !value.startsWith("data:image/")) continue;
    images[variable.id] = value;
  }
  withText.images = images;
  const withImages = mapDocument(withText, (node) => {
    if (typeof node.image !== "string") return node;
    const variable = variables.find((item) => item.type === "image" && (item.id === node.image || item.bindings.some((binding) => binding.nodeId === node._nodeId)));
    if (!variable) return node;
    return { ...node, image: variable.id };
  });

  const stripped = stripInternal(withImages) as DocumentDefinition;
  const missing = new Set<string>();
  collectUnresolved(stripped, missing);
  if (options.strict) {
    for (const id of missing) {
      errors.push({ path: id, message: `“${id}” is still unresolved in the document.` });
    }
  } else if (missing.size) {
    warnings.push("Some placeholders have no value yet. They are marked in the preview.");
  }

  if (!stripped.defaultStyle || typeof stripped.defaultStyle !== "object") stripped.defaultStyle = {};
  stripped.defaultStyle = { ...stripped.defaultStyle, font: "Roboto" };
  return { definition: stripped, errors, warnings };
}

export function initialValues(variables: VariableDefinition[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const variable of variables) {
    if (variable.type === "lineItems") {
      values[variable.id] = Array.isArray(variable.defaultValue) ? structuredClone(variable.defaultValue) : [];
    } else if (variable.type === "checkbox") {
      values[variable.id] = Boolean(variable.defaultValue);
    } else {
      values[variable.id] = variable.defaultValue ?? "";
    }
  }
  return values;
}

export function primaryFilenameValue(variables: VariableDefinition[], values: Record<string, unknown>): string {
  const preferred =
    variables.find((variable) => /name/i.test(variable.id) && values[variable.id]) ??
    variables.find((variable) => variable.type === "text" && values[variable.id]);
  return preferred ? String(values[preferred.id]) : "";
}
