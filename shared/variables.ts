import { coerceNumber, toDateInputValue } from "./format";
import {
  assignDefinitionIds,
  isRecord,
  mapDocument,
  nodePlainText,
  walkNodes,
} from "./document";
import type {
  DocumentDefinition,
  LineColumn,
  VariableBinding,
  VariableDefinition,
  VariableType,
} from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s().-]{8,22}$/;
const DATE_RE =
  /^(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})$/;
const CURRENCY_RE = /^(?:₹|rs\.?|inr|\$|€|£)\s*[\d,]+(?:\.\d+)?$/i;
const PERCENT_RE = /^-?\d{1,3}(?:\.\d+)?\s*%$/;
const PLAIN_NUMBER_RE = /^-?[\d,]+(?:\.\d+)?$/;
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
const SUMMARY_RE = /^(total|sub\s*total|grand\s*total|gst|cgst|sgst|igst|tax|vat|discount|balance|amount\s*due|net|round\s*off)\b/i;

const FIELD_RULES: { test: RegExp; type: VariableType; group: string; id?: string }[] = [
  { test: /\b(customer|client)\s*name\b/i, type: "text", group: "Customer Details", id: "customer_name" },
  { test: /\bemployee\s*name\b/i, type: "text", group: "Employee Details", id: "employee_name" },
  { test: /\bcompany\s*name\b/i, type: "text", group: "Company Details", id: "company_name" },
  { test: /\bproject\s*name\b/i, type: "text", group: "Project Details", id: "project_name" },
  { test: /\bproperty(\s*name)?\b/i, type: "text", group: "Property Details", id: "property_name" },
  { test: /\binvoice\s*(no\.?|number|#)?\b/i, type: "text", group: "Document Details", id: "invoice_number" },
  { test: /\b(document|demand|receipt|reference|ref)\s*(no\.?|number|#)?\b/i, type: "text", group: "Document Details", id: "document_number" },
  { test: /\bhire\s*date\b/i, type: "date", group: "Employee Details", id: "hire_date" },
  { test: /\b(due|valid\s*till|expiry)\s*date\b/i, type: "date", group: "Document Details", id: "due_date" },
  { test: /\bdate\b/i, type: "date", group: "Document Details", id: "document_date" },
  { test: /\be-?mail\b/i, type: "email", group: "Contact Details", id: "email" },
  { test: /\b(phone|mobile|contact)\b/i, type: "phone", group: "Contact Details", id: "phone" },
  { test: /\baddress\b/i, type: "textarea", group: "Contact Details", id: "address" },
  { test: /\b(designation|job\s*title)\b/i, type: "text", group: "Employee Details", id: "designation" },
  { test: /\bsignature\b/i, type: "text", group: "Signature", id: "signature" },
  { test: /\b(bank|ifsc|account)\b/i, type: "textarea", group: "Bank Details", id: "bank_details" },
  { test: /\b(gst|cgst|sgst|igst|tax|vat)\b/i, type: "currency", group: "Financial Details" },
  { test: /\b(percent|percentage|rate)\b/i, type: "percent", group: "Financial Details" },
  { test: /\b(qty|quantity)\b/i, type: "number", group: "Financial Details" },
  { test: /\b(total\s*amount|amount|balance|price)\b/i, type: "currency", group: "Financial Details", id: "total_amount" },
];

const GROUPS = [
  "Customer Details",
  "Company Details",
  "Employee Details",
  "Project Details",
  "Property Details",
  "Document Details",
  "Contact Details",
  "Financial Details",
  "Bank Details",
  "Line Items",
  "Signature",
  "General",
];

export interface VariableCandidate {
  label: string;
  type: VariableType;
  value: string;
  group: string;
  id?: string;
  confidence: number;
  nodeId?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function slugVariableId(label: string, used: Set<string>, preferred?: string): string {
  const source = preferred || label;
  let base = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!/^[a-z]/.test(base)) base = `field_${base || "value"}`.replace(/_+/g, "_");
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base.slice(0, 36)}_${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

function digitCount(value: string): number {
  return value.replace(/\D/g, "").length;
}

function isDistinctive(value: string, type: VariableType): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2) return false;
  const stop = new Set(["total", "amount", "date", "name", "invoice", "yes", "no", "na", "n/a", "mr", "ms", "rs"]);
  if (stop.has(trimmed.toLowerCase())) return false;
  if (PLAIN_NUMBER_RE.test(trimmed) && digitCount(trimmed) < 4 && type !== "currency" && type !== "percent") return false;
  return true;
}

function inferFromValue(value: string, fallback: VariableType): { type: VariableType; stored: unknown } {
  const trimmed = value.trim();
  if (EMAIL_RE.test(trimmed)) return { type: "email", stored: trimmed };
  if (PERCENT_RE.test(trimmed)) return { type: "percent", stored: coerceNumber(trimmed.replace("%", "")) };
  if (CURRENCY_RE.test(trimmed)) return { type: "currency", stored: coerceNumber(trimmed) };
  if (DATE_RE.test(trimmed)) return { type: "date", stored: toDateInputValue(trimmed) || trimmed };
  if (PHONE_RE.test(trimmed) && digitCount(trimmed) >= 8 && fallback === "phone") return { type: "phone", stored: trimmed };
  if (fallback === "currency" && PLAIN_NUMBER_RE.test(trimmed)) return { type: "currency", stored: coerceNumber(trimmed) };
  if (fallback === "number" && PLAIN_NUMBER_RE.test(trimmed)) return { type: "number", stored: coerceNumber(trimmed) };
  if (fallback === "percent" && PLAIN_NUMBER_RE.test(trimmed)) return { type: "percent", stored: coerceNumber(trimmed) };
  if (fallback === "date") return { type: "date", stored: toDateInputValue(trimmed) || trimmed };
  if (fallback === "textarea" || trimmed.length > 80) return { type: "textarea", stored: trimmed };
  return { type: fallback === "phone" || fallback === "email" ? fallback : "text", stored: trimmed };
}

function classifyLabel(label: string, value: string): { type: VariableType; group: string; id?: string; stored: unknown } | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500 || /\{\{/.test(trimmed)) return null;
  if (label.split(/\s+/).length > 8) return null;
  for (const rule of FIELD_RULES) {
    if (!rule.test.test(label)) continue;
    const inferred = inferFromValue(trimmed, rule.type);
    return { type: inferred.type, group: rule.group, id: rule.id, stored: inferred.stored };
  }
  if (EMAIL_RE.test(trimmed)) return { type: "email", group: "Contact Details", id: "email", stored: trimmed };
  if (CURRENCY_RE.test(trimmed)) return { type: "currency", group: "Financial Details", stored: coerceNumber(trimmed) };
  if (PERCENT_RE.test(trimmed)) return { type: "percent", group: "Financial Details", stored: coerceNumber(trimmed) };
  if (DATE_RE.test(trimmed) && /\bdate\b/i.test(label)) {
    return { type: "date", group: "Document Details", stored: toDateInputValue(trimmed) || trimmed };
  }
  return null;
}

function standaloneCandidate(text: string): { label: string; type: VariableType; group: string; id?: string; stored: unknown } | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 120 || /\{\{/.test(trimmed)) return null;
  if (EMAIL_RE.test(trimmed)) return { label: "Email", type: "email", group: "Contact Details", id: "email", stored: trimmed };
  if (CURRENCY_RE.test(trimmed)) {
    return { label: "Amount", type: "currency", group: "Financial Details", id: "total_amount", stored: coerceNumber(trimmed) };
  }
  if (PERCENT_RE.test(trimmed)) {
    return { label: "Percentage", type: "percent", group: "Financial Details", stored: coerceNumber(trimmed) };
  }
  if (DATE_RE.test(trimmed)) {
    return { label: "Date", type: "date", group: "Document Details", id: "document_date", stored: toDateInputValue(trimmed) || trimmed };
  }
  if (PHONE_RE.test(trimmed) && digitCount(trimmed) >= 10 && /[+\-().\s]/.test(trimmed)) {
    return { label: "Phone", type: "phone", group: "Contact Details", id: "phone", stored: trimmed };
  }
  return null;
}

interface FoundText {
  nodeId: string;
  text: string;
}

function collectOwnedText(definition: DocumentDefinition): FoundText[] {
  const found: FoundText[] = [];
  const visit = (node: unknown) => {
    walkNodes(node, (current) => {
      if (typeof current.text === "string" && typeof current._nodeId === "string") {
        found.push({ nodeId: current._nodeId, text: current.text });
      }
    });
  };
  visit(definition.content);
  visit(definition.header);
  visit(definition.footer);
  return found;
}

function columnType(label: string): LineColumn["type"] {
  if (/\b(qty|quantity|count)\b/i.test(label)) return "number";
  if (/%|percent/i.test(label)) return "percent";
  if (/\b(amount|rate|price|total|tax|vat|value|cost)\b/i.test(label)) return "currency";
  return "text";
}

function headerScore(cells: string[]): number {
  return cells.filter((cell) =>
    /\b(description|particular|item|details|qty|quantity|rate|price|amount|tax|vat|total|hsn|unit)\b/i.test(cell),
  ).length;
}

function isSummaryLabel(value: string): boolean {
  return SUMMARY_RE.test(value.trim());
}

function storedCell(type: LineColumn["type"], raw: string): unknown {
  if (type === "currency" || type === "number" || type === "percent") {
    const n = coerceNumber(raw.replace("%", ""));
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}

function extractLineItems(definition: DocumentDefinition): {
  definition: DocumentDefinition;
  variables: VariableDefinition[];
} {
  const variables: VariableDefinition[] = [];
  const used = new Set<string>();
  const next = mapDocument(definition, (node) => {
    if (!isRecord(node.table) || !Array.isArray(node.table.body) || node.table.body.length < 2) return node;
    const body = node.table.body.filter(Array.isArray) as unknown[][];
    const header = body[0].map((cell) => nodePlainText(cell).trim());
    if (header.length < 2 || headerScore(header) < 2) return node;
    let summaryCount = 0;
    for (let index = body.length - 1; index > 0; index -= 1) {
      const label = nodePlainText(body[index][0]).trim();
      if (isSummaryLabel(label)) summaryCount += 1;
      else break;
    }
    const dataRows = body.slice(1, body.length - summaryCount);
    if (!dataRows.length) return node;
    const columns: LineColumn[] = header.map((label, index) => {
      const samples = dataRows.map((row) => nodePlainText(row[index]).trim());
      const percentCount = samples.filter((sample) => /^-?\d{1,3}(?:\.\d+)?\s*%$/.test(sample)).length;
      return {
        key: slugVariableId(label || `column_${index + 1}`, new Set()),
        label: label || `Column ${index + 1}`,
        type: percentCount >= Math.ceil(samples.length / 2) ? "percent" : columnType(label),
      };
    });
    const seen = new Set<string>();
    for (const column of columns) {
      let key = column.key;
      let n = 2;
      while (seen.has(key)) {
        key = `${column.key}_${n}`;
        n += 1;
      }
      column.key = key;
      seen.add(key);
    }
    const defaultValue = dataRows.map((row) => {
      const record: Record<string, unknown> = {};
      columns.forEach((column, index) => {
        record[column.key] = storedCell(column.type, nodePlainText(row[index]).trim());
      });
      return record;
    });
    const id = slugVariableId("Line items", used, variables.length === 0 ? "line_items" : undefined);
    const nodeId = typeof node._nodeId === "string" ? node._nodeId : id;
    variables.push({
      id,
      label: variables.length === 0 ? "Line items" : `Line items ${variables.length + 1}`,
      type: "lineItems",
      defaultValue,
      required: false,
      group: "Line Items",
      order: variables.length,
      bindings: [{ nodeId, field: "table" }],
      columns,
      tableNodeId: nodeId,
      headerRowCount: 1,
      summaryRowCount: summaryCount,
      confidence: 0.86,
    });
    return {
      ...node,
      _nodeId: nodeId,
      table: {
        ...node.table,
        headerRows: 1,
        body: [...body.slice(0, 1), ...body.slice(body.length - summaryCount)],
      },
    };
  });
  return { definition: next, variables };
}

function findCandidates(definition: DocumentDefinition): VariableCandidate[] {
  const candidates: VariableCandidate[] = [];
  for (const item of collectOwnedText(definition)) {
    const text = item.text.trim();
    const labeled = /^(.{2,60}?)\s*[:\-–]\s+(\S[\s\S]*)$/.exec(text);
    if (labeled) {
      const label = labeled[1].trim();
      const value = labeled[2].trim();
      const classified = classifyLabel(label, value);
      if (classified && isDistinctive(value, classified.type)) {
        candidates.push({
          nodeId: item.nodeId,
          label,
          type: classified.type,
          value,
          group: classified.group,
          id: classified.id,
          confidence: 0.9,
        });
        continue;
      }
    }
    const standalone = standaloneCandidate(text);
    if (standalone && isDistinctive(text, standalone.type)) {
      candidates.push({
        nodeId: item.nodeId,
        label: standalone.label,
        type: standalone.type,
        value: text,
        group: standalone.group,
        id: standalone.id,
        confidence: 0.72,
      });
    }
  }
  return candidates;
}

function applyCandidates(
  definition: DocumentDefinition,
  candidates: VariableCandidate[],
): { definition: DocumentDefinition; variables: VariableDefinition[] } {
  const used = new Set<string>();
  const variables: VariableDefinition[] = [];
  let next = definition;

  const grouped = new Map<string, VariableCandidate[]>();
  for (const candidate of candidates) {
    const key = `${(candidate.id || candidate.label).toLowerCase()}::${candidate.type}::${candidate.value}`;
    const list = grouped.get(key) ?? [];
    list.push(candidate);
    grouped.set(key, list);
  }

  for (const group of grouped.values()) {
    const first = group[0];
    const inferred = inferFromValue(first.value, first.type);
    const id = slugVariableId(first.label, used, first.id);
    const placeholder = `{{${id}}}`;
    const symbol = inferred.type === "currency" ? /^((?:₹|rs\.?|inr|\$|€|£)\s*)/i.exec(first.value.trim())?.[1] ?? "" : "";
    const replacement = `${symbol}${placeholder}`;
    const sourceNodes = new Set(group.map((item) => item.nodeId).filter(Boolean) as string[]);
    next = mapDocument(next, (node) => {
      const nodeId = typeof node._nodeId === "string" ? node._nodeId : "";
      if (!sourceNodes.has(nodeId) || typeof node.text !== "string" || !node.text.includes(first.value)) return node;
      return { ...node, text: node.text.replace(first.value, replacement) };
    });

    if (isDistinctive(first.value, inferred.type)) {
      const token = new RegExp(`(?<![\\w@])${escapeRegExp(first.value)}(?![\\w@])`, "g");
      next = mapDocument(next, (node) => {
        if (typeof node.text !== "string" || node.text.includes(placeholder)) return node;
        if (!token.test(node.text)) {
          token.lastIndex = 0;
          return node;
        }
        token.lastIndex = 0;
        if (/:\s*\S/.test(node.text) && !node.text.includes(first.label)) return node;
        return { ...node, text: node.text.replace(token, replacement) };
      });
    }

    variables.push({
      id,
      label: first.label,
      type: inferred.type,
      defaultValue: inferred.stored,
      required: inferred.type === "currency" || inferred.type === "date" || /name$/i.test(id),
      group: first.group,
      order: variables.length,
      bindings: [],
      confidence: first.confidence,
    });
  }

  return { definition: next, variables };
}

function variablesFromPlaceholders(definition: DocumentDefinition, existing: VariableDefinition[]): VariableDefinition[] {
  const used = new Set(existing.map((item) => item.id));
  const created: VariableDefinition[] = [];
  const texts = collectOwnedText(definition).map((item) => item.text).join("\n");
  const ids = new Set<string>();
  for (const match of texts.matchAll(PLACEHOLDER_RE)) ids.add(match[1]);
  for (const id of ids) {
    if (used.has(id)) continue;
    used.add(id);
    created.push({
      id,
      label: id.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      type: "text",
      defaultValue: "",
      required: false,
      group: "General",
      order: existing.length + created.length,
      bindings: [],
      confidence: 1,
    });
  }
  return created;
}

export function syncBindings(definition: DocumentDefinition, variables: VariableDefinition[]): VariableDefinition[] {
  const found = new Map<string, VariableBinding[]>();
  const visit = (node: unknown) => {
    walkNodes(node, (current) => {
      const nodeId = typeof current._nodeId === "string" ? current._nodeId : "";
      if (!nodeId || typeof current.text !== "string") return;
      for (const match of current.text.matchAll(PLACEHOLDER_RE)) {
        const list = found.get(match[1]) ?? [];
        if (!list.some((item) => item.nodeId === nodeId)) list.push({ nodeId, field: "text" });
        found.set(match[1], list);
      }
    });
  };
  visit(definition.content);
  visit(definition.header);
  visit(definition.footer);
  return variables.map((variable) => {
    if (variable.type === "lineItems" || variable.type === "image") return variable;
    let list = found.get(variable.id);
    if (!list || list.length === 0) {
      const normVar = variable.id.toLowerCase().replace(/[^a-z0-9]/g, "");
      for (const [key, b] of found.entries()) {
        if (key.toLowerCase().replace(/[^a-z0-9]/g, "") === normVar) {
          list = b;
          break;
        }
      }
    }
    return { ...variable, bindings: list ?? [] };
  });
}

function sortVariables(variables: VariableDefinition[]): VariableDefinition[] {
  return [...variables].sort((a, b) => {
    const groupDelta = GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group);
    const safeGroup = (groupDelta === 0 ? 0 : groupDelta) || a.group.localeCompare(b.group);
    if (safeGroup !== 0 && GROUPS.includes(a.group as (typeof GROUPS)[number]) && GROUPS.includes(b.group as (typeof GROUPS)[number])) {
      return GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.order - b.order;
    }
    return a.group.localeCompare(b.group) || a.order - b.order;
  }).map((variable, index) => ({ ...variable, order: index }));
}

export function extractVariables(definition: DocumentDefinition): {
  definition: DocumentDefinition;
  variables: VariableDefinition[];
} {
  const identified = assignDefinitionIds(definition);
  const lineItems = extractLineItems(identified);
  const applied = applyCandidates(lineItems.definition, findCandidates(lineItems.definition));
  const placeholders = variablesFromPlaceholders(applied.definition, [...lineItems.variables, ...applied.variables]);
  const variables = sortVariables([...lineItems.variables, ...applied.variables, ...placeholders]);
  return { definition: applied.definition, variables: syncBindings(applied.definition, variables) };
}

export function applyAiCandidates(
  definition: DocumentDefinition,
  candidates: VariableCandidate[],
): { definition: DocumentDefinition; variables: VariableDefinition[] } {
  const corpus = collectOwnedText(definition).map((item) => item.text);
  const accepted = candidates.filter((candidate) => {
    const value = candidate.value?.trim();
    if (!value || value.length < 2 || value.length > 500) return false;
    return corpus.some((text) => text.includes(value));
  });
  const extracted = applyCandidates(assignDefinitionIds(definition), accepted);
  return {
    definition: extracted.definition,
    variables: syncBindings(extracted.definition, sortVariables(extracted.variables)),
  };
}

function replacePlaceholder(definition: DocumentDefinition, id: string, replacement: string): DocumentDefinition {
  const pattern = new RegExp(`\\{\\{\\s*${id}\\s*\\}\\}`, "g");
  return mapDocument(definition, (node) => {
    if (typeof node.text !== "string") return node;
    return { ...node, text: node.text.replace(pattern, replacement) };
  });
}

export function addVariable(
  definition: DocumentDefinition,
  variables: VariableDefinition[],
  input: {
    nodeId: string;
    label: string;
    type: VariableType;
    group: string;
    required: boolean;
    textToReplace: string;
  },
): { definition: DocumentDefinition; variables: VariableDefinition[]; error?: string } {
  const needle = input.textToReplace;
  if (!needle.trim()) return { definition, variables, error: "Select the text that should become a variable." };
  let replaced = false;
  const used = new Set(variables.map((item) => item.id));
  const id = slugVariableId(input.label, used);
  const next = mapDocument(definition, (node) => {
    if (replaced || node._nodeId !== input.nodeId || typeof node.text !== "string") return node;
    const index = node.text.indexOf(needle);
    if (index < 0) return node;
    replaced = true;
    const text = `${node.text.slice(0, index)}{{${id}}}${node.text.slice(index + needle.length)}`;
    return { ...node, text };
  });
  if (!replaced) return { definition, variables, error: "That text was not found in the selected element." };
  const inferred = inferFromValue(needle, input.type);
  const variable: VariableDefinition = {
    id,
    label: input.label.trim() || "Field",
    type: input.type === "text" ? inferred.type : input.type,
    defaultValue: input.type === "text" ? inferred.stored : needle,
    required: input.required,
    group: input.group.trim() || "General",
    order: variables.length,
    bindings: [{ nodeId: input.nodeId, field: "text" }],
  };
  if (variable.type === "date") variable.defaultValue = toDateInputValue(needle) || needle;
  if (variable.type === "currency" || variable.type === "number" || variable.type === "percent") {
    const amount = coerceNumber(String(needle).replace("%", ""));
    if (Number.isFinite(amount)) variable.defaultValue = amount;
  }
  return { definition: next, variables: syncBindings(next, [...variables, variable]) };
}

export function deleteVariable(
  definition: DocumentDefinition,
  variables: VariableDefinition[],
  id: string,
): { definition: DocumentDefinition; variables: VariableDefinition[] } {
  const variable = variables.find((item) => item.id === id);
  if (!variable) return { definition, variables };
  let next = definition;
  if (variable.type === "lineItems" && variable.tableNodeId && Array.isArray(variable.defaultValue)) {
    next = mapDocument(definition, (node) => {
      if (node._nodeId !== variable.tableNodeId || !isRecord(node.table) || !Array.isArray(node.table.body)) return node;
      const columns = variable.columns ?? [];
      const rows = (variable.defaultValue as Record<string, unknown>[]).map((row) =>
        columns.map((column) => ({ text: row[column.key] == null ? "" : String(row[column.key]) })),
      );
      const body = [...node.table.body];
      const headerCount = variable.headerRowCount ?? 1;
      body.splice(headerCount, 0, ...rows);
      return { ...node, table: { ...node.table, body } };
    });
  } else {
    const replacement =
      variable.defaultValue == null
        ? ""
        : variable.type === "percent"
          ? `${variable.defaultValue}%`
          : String(variable.defaultValue);
    next = replacePlaceholder(definition, id, replacement);
  }
  return { definition: next, variables: variables.filter((item) => item.id !== id) };
}

export function renameVariable(
  definition: DocumentDefinition,
  variables: VariableDefinition[],
  id: string,
  label: string,
): { definition: DocumentDefinition; variables: VariableDefinition[]; error?: string } {
  const nextLabel = label.trim();
  if (!nextLabel) return { definition, variables, error: "A label is required." };
  const used = new Set(variables.filter((item) => item.id !== id).map((item) => item.id));
  const nextId = slugVariableId(nextLabel, used);
  const replaced = replacePlaceholder(definition, id, `{{${nextId}}}`);
  const nextVariables = variables.map((variable) =>
    variable.id === id ? { ...variable, id: nextId, label: nextLabel } : variable,
  );
  return { definition: replaced, variables: syncBindings(replaced, nextVariables) };
}

export function updateVariable(
  variables: VariableDefinition[],
  id: string,
  patch: Partial<VariableDefinition>,
): VariableDefinition[] {
  return variables.map((variable) => {
    if (variable.id !== id) return variable;
    const next = { ...variable, ...patch, id: variable.id, bindings: variable.bindings };
    if (patch.type && patch.type !== variable.type) {
      if (patch.type === "checkbox") next.defaultValue = Boolean(variable.defaultValue);
      if (patch.type === "lineItems") return variable;
    }
    return next;
  });
}

export function moveVariable(variables: VariableDefinition[], id: string, direction: -1 | 1): VariableDefinition[] {
  const index = variables.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= variables.length) return variables;
  const next = [...variables];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next.map((variable, order) => ({ ...variable, order }));
}

export function linkOccurrences(
  definition: DocumentDefinition,
  variables: VariableDefinition[],
  id: string,
): { definition: DocumentDefinition; variables: VariableDefinition[]; linked: number } {
  const variable = variables.find((item) => item.id === id);
  if (!variable || variable.defaultValue == null) return { definition, variables, linked: 0 };
  const value = String(variable.defaultValue);
  if (!isDistinctive(value, variable.type)) return { definition, variables, linked: 0 };
  const token = new RegExp(`(?<![\\w@])${escapeRegExp(value)}(?![\\w@])`, "g");
  let linked = 0;
  const next = mapDocument(definition, (node) => {
    if (typeof node.text !== "string" || node.text.includes(`{{${id}}}`)) return node;
    if (!token.test(node.text)) {
      token.lastIndex = 0;
      return node;
    }
    token.lastIndex = 0;
    linked += 1;
    return { ...node, text: node.text.replace(token, `{{${id}}}`) };
  });
  return { definition: next, variables: syncBindings(next, variables), linked };
}

export function normalizeVariableList(input: unknown): { variables: VariableDefinition[]; errors: string[] } {
  const source = Array.isArray(input) ? input : isRecord(input) && Array.isArray(input.variables) ? input.variables : null;
  if (!source) return { variables: [], errors: ["Variable schema must be an array."] };
  const errors: string[] = [];
  const used = new Set<string>();
  const variables: VariableDefinition[] = [];
  for (const item of source) {
    if (!isRecord(item)) continue;
    const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : "Field";
    const type = (typeof item.type === "string" ? item.type : "text") as VariableType;
    const allowed: VariableType[] = [
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
    ];
    if (!allowed.includes(type)) {
      errors.push(`Unsupported variable type “${String(item.type)}”.`);
      continue;
    }
    const id = slugVariableId(typeof item.id === "string" ? item.id : label, used);
    const columns = Array.isArray(item.columns)
      ? item.columns.filter(isRecord).map((column, index) => ({
          key: slugVariableId(String(column.key || column.label || `column_${index + 1}`), new Set()),
          label: String(column.label || column.key || `Column ${index + 1}`),
          type: (["text", "number", "currency", "percent"].includes(String(column.type))
            ? column.type
            : "text") as LineColumn["type"],
        }))
      : undefined;
    variables.push({
      id,
      label,
      type,
      defaultValue: item.defaultValue ?? (type === "lineItems" ? [] : ""),
      required: Boolean(item.required),
      group: typeof item.group === "string" && item.group.trim() ? item.group.trim() : "General",
      order: variables.length,
      options: Array.isArray(item.options) ? item.options.map(String).slice(0, 50) : undefined,
      validation: isRecord(item.validation)
        ? {
            min: typeof item.validation.min === "number" ? item.validation.min : undefined,
            max: typeof item.validation.max === "number" ? item.validation.max : undefined,
            pattern: typeof item.validation.pattern === "string" ? item.validation.pattern.slice(0, 200) : undefined,
            message: typeof item.validation.message === "string" ? item.validation.message.slice(0, 200) : undefined,
          }
        : undefined,
      bindings: [],
      columns,
      tableNodeId: typeof item.tableNodeId === "string" ? item.tableNodeId : undefined,
      headerRowCount: typeof item.headerRowCount === "number" ? item.headerRowCount : undefined,
      summaryRowCount: typeof item.summaryRowCount === "number" ? item.summaryRowCount : undefined,
      confidence: typeof item.confidence === "number" ? item.confidence : undefined,
    });
  }
  return { variables, errors };
}
