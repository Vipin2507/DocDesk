import type { DocumentDefinition, FieldError, JsonClassification, VariableDefinition } from "./types";
import { MAX_IMAGE_BYTES } from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const BAD_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const TOP_LEVEL = new Set([
  "pageSize",
  "pageOrientation",
  "pageMargins",
  "defaultStyle",
  "styles",
  "header",
  "footer",
  "background",
  "images",
  "content",
  "watermark",
  "info",
  "compress",
]);
const NODE_KEYS = new Set([
  "text",
  "table",
  "columns",
  "stack",
  "ul",
  "ol",
  "image",
  "canvas",
  "qr",
  "svg",
  "toc",
  "pageBreak",
  "style",
  "alignment",
  "font",
  "fontSize",
  "bold",
  "italics",
  "color",
  "background",
  "fillColor",
  "margin",
  "link",
  "decoration",
  "widths",
  "headerRows",
  "body",
  "layout",
  "colSpan",
  "rowSpan",
  "border",
  "width",
  "height",
  "fit",
  "columnGap",
  "lineHeight",
  "characterSpacing",
  "opacity",
  "preserveLeadingSpaces",
  "noWrap",
  "pageBreak",
  "_nodeId",
]);

const CHILD_KEYS = ["stack", "columns", "ul", "ol"] as const;

export function blankDefinition(title = "Untitled document"): DocumentDefinition {
  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [40, 48, 40, 48],
    defaultStyle: { font: "Roboto", fontSize: 11, color: "#0f172a" },
    content: [
      { text: title, fontSize: 20, bold: true, margin: [0, 0, 0, 8], _nodeId: "n_title" },
      {
        text: "Replace this text, then mark the parts that should change as variables.",
        color: "#475569",
        _nodeId: "n_intro",
      },
    ],
  };
}

function locateJsonError(text: string): { line: number; column: number } {
  let index = 0;
  const position = () => {
    let line = 1;
    let column = 1;
    for (let cursor = 0; cursor < index && cursor < text.length; cursor += 1) {
      if (text[cursor] === "\n") {
        line += 1;
        column = 1;
      } else column += 1;
    }
    return { line, column };
  };
  const skip = () => {
    while (index < text.length && /\s/.test(text[index])) index += 1;
  };
  const literal = (word: string) => {
    if (text.startsWith(word, index)) {
      index += word.length;
      return true;
    }
    return false;
  };
  const parseString = () => {
    if (text[index] !== '"') return false;
    index += 1;
    while (index < text.length) {
      if (text[index] === "\\") {
        index += 2;
        continue;
      }
      if (text[index] === '"') {
        index += 1;
        return true;
      }
      index += 1;
    }
    return false;
  };
  const parseNumber = () => {
    const start = index;
    if (text[index] === "-") index += 1;
    if (!/[0-9]/.test(text[index] || "")) return false;
    while (/[0-9]/.test(text[index] || "")) index += 1;
    if (text[index] === ".") {
      index += 1;
      if (!/[0-9]/.test(text[index] || "")) return false;
      while (/[0-9]/.test(text[index] || "")) index += 1;
    }
    if (text[index] === "e" || text[index] === "E") {
      index += 1;
      if (text[index] === "+" || text[index] === "-") index += 1;
      if (!/[0-9]/.test(text[index] || "")) return false;
      while (/[0-9]/.test(text[index] || "")) index += 1;
    }
    return index > start;
  };
  const parseValue = (): boolean => {
    skip();
    if (text[index] === "{") return parseObject();
    if (text[index] === "[") return parseArray();
    if (text[index] === '"') return parseString();
    if (text[index] === "t") return literal("true");
    if (text[index] === "f") return literal("false");
    if (text[index] === "n") return literal("null");
    return parseNumber();
  };
  const parseObject = () => {
    index += 1;
    skip();
    if (text[index] === "}") {
      index += 1;
      return true;
    }
    while (index < text.length) {
      skip();
      if (!parseString()) return false;
      skip();
      if (text[index] !== ":") return false;
      index += 1;
      if (!parseValue()) return false;
      skip();
      if (text[index] === ",") {
        index += 1;
        continue;
      }
      if (text[index] === "}") {
        index += 1;
        return true;
      }
      return false;
    }
    return false;
  };
  const parseArray = () => {
    index += 1;
    skip();
    if (text[index] === "]") {
      index += 1;
      return true;
    }
    while (index < text.length) {
      if (!parseValue()) return false;
      skip();
      if (text[index] === ",") {
        index += 1;
        continue;
      }
      if (text[index] === "]") {
        index += 1;
        return true;
      }
      return false;
    }
    return false;
  };
  if (!parseValue()) return position();
  skip();
  if (index < text.length) return position();
  return { line: 1, column: 1 };
}

export function jsonErrorPosition(text: string, error: unknown): { line: number; column: number; message: string } {
  const message = error instanceof Error ? error.message : "Invalid JSON";
  const located = locateJsonError(text);
  return { ...located, message };
}

export function looksLikePdfMake(value: unknown): value is DocumentDefinition {
  if (!isRecord(value) || !Array.isArray(value.content)) return false;
  const signals = ["pageSize", "pageMargins", "pageOrientation", "defaultStyle", "styles", "header", "footer", "images", "background"];
  if (signals.some((key) => key in value)) return true;
  if (value.content.length === 0) return false;
  return value.content.every((item) => {
    if (typeof item === "string" || typeof item === "number") return true;
    if (!isRecord(item)) return false;
    return ["text", "table", "columns", "stack", "ul", "ol", "image", "canvas", "qr", "svg", "pageBreak", "toc"].some(
      (key) => key in item,
    );
  });
}

function bundleDefinition(value: Record<string, unknown>): unknown {
  return value.documentDefinition ?? value.docDefinition;
}

function bundleVariables(value: Record<string, unknown>): unknown {
  if (Array.isArray(value.variables)) return value.variables;
  if (isRecord(value.variableSchema)) return value.variableSchema.variables;
  return undefined;
}

export function isDocumentBundle(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return looksLikePdfMake(bundleDefinition(value)) && Array.isArray(bundleVariables(value));
}

export interface ParsedUpload {
  classification: JsonClassification;
  value?: unknown;
  definition?: DocumentDefinition;
  variables?: unknown;
  errors: FieldError[];
}

export function parseUploadedJson(raw: string): ParsedUpload {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) {
    return { classification: "invalid", errors: [{ path: "", message: "The file is empty." }] };
  }
  if (!text.startsWith("{") && !text.startsWith("[")) {
    return {
      classification: "script",
      errors: [
        {
          path: "",
          message:
            "This file is not pure JSON. Document Studio never executes JavaScript. Save the PDFMake definition as a .json file and upload that.",
        },
      ],
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const pos = jsonErrorPosition(text, error);
    return {
      classification: "invalid",
      errors: [{ path: "", message: "The JSON could not be parsed.", line: pos.line, column: pos.column }],
    };
  }
  if (Array.isArray(value)) {
    return { classification: "generic", value, errors: [] };
  }
  if (isDocumentBundle(value)) {
    return {
      classification: "bundle",
      value,
      definition: bundleDefinition(value) as DocumentDefinition,
      variables: bundleVariables(value),
      errors: [],
    };
  }
  if (looksLikePdfMake(value)) {
    return { classification: "pdfmake", value, definition: value, errors: [] };
  }
  if (isRecord(value)) {
    return { classification: "generic", value, errors: [] };
  }
  return {
    classification: "invalid",
    errors: [{ path: "", message: "The JSON must be an object or an array." }],
  };
}

export function walkNodes(node: unknown, visit: (node: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) walkNodes(item, visit);
    return;
  }
  if (!isRecord(node)) return;
  visit(node);
  if ("text" in node && typeof node.text !== "string") walkNodes(node.text, visit);
  for (const key of CHILD_KEYS) {
    if (key in node) walkNodes(node[key], visit);
  }
  if (isRecord(node.table) && Array.isArray(node.table.body)) {
    for (const row of node.table.body) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) walkNodes(cell, visit);
    }
  }
}

export function mapContent(node: unknown, map: (node: Record<string, unknown>) => Record<string, unknown>): unknown {
  if (Array.isArray(node)) return node.map((item) => mapContent(item, map));
  if (!isRecord(node)) return node;
  let next = map({ ...node });
  if ("text" in next && typeof next.text !== "string") {
    next = { ...next, text: mapContent(next.text, map) };
  }
  for (const key of CHILD_KEYS) {
    if (key in next) next = { ...next, [key]: mapContent(next[key], map) };
  }
  if (isRecord(next.table) && Array.isArray(next.table.body)) {
    next = {
      ...next,
      table: {
        ...next.table,
        body: next.table.body.map((row: unknown) =>
          Array.isArray(row) ? row.map((cell) => mapContent(cell, map)) : row,
        ),
      },
    };
  }
  return next;
}

export function mapDocument(
  definition: DocumentDefinition,
  map: (node: Record<string, unknown>) => Record<string, unknown>,
): DocumentDefinition {
  const next: DocumentDefinition = {
    ...definition,
    content: mapContent(definition.content, map) as unknown[],
  };
  if (definition.header !== undefined) next.header = mapContent(definition.header, map);
  if (definition.footer !== undefined) next.footer = mapContent(definition.footer, map);
  return next;
}

function asTextNode(value: unknown): Record<string, unknown> {
  return { text: String(value) };
}

export function normalizePrimitives(node: unknown): unknown {
  if (typeof node === "string" || typeof node === "number") return asTextNode(node);
  if (Array.isArray(node)) return node.map((item) => normalizePrimitives(item));
  if (!isRecord(node)) return node;
  const next: Record<string, unknown> = { ...node };
  if (Array.isArray(next.text)) {
    next.text = next.text.map((item) =>
      typeof item === "string" || typeof item === "number" ? asTextNode(item) : normalizePrimitives(item),
    );
  }
  for (const key of CHILD_KEYS) {
    if (Array.isArray(next[key])) {
      next[key] = (next[key] as unknown[]).map((item) =>
        typeof item === "string" || typeof item === "number" ? asTextNode(item) : normalizePrimitives(item),
      );
    }
  }
  if (isRecord(next.table) && Array.isArray(next.table.body)) {
    next.table = {
      ...next.table,
      body: next.table.body.map((row: unknown) =>
        Array.isArray(row)
          ? row.map((cell) =>
              typeof cell === "string" || typeof cell === "number" ? asTextNode(cell) : normalizePrimitives(cell),
            )
          : row,
      ),
    };
  }
  for (const key of ["content", "header", "footer"] as const) {
    if (next[key] !== undefined) next[key] = normalizePrimitives(next[key]);
  }
  return next;
}

export function assignNodeIds<T>(node: T): T {
  const used = new Set<string>();
  let seq = 0;
  return mapContent(node, (current) => {
    let id = typeof current._nodeId === "string" ? current._nodeId : "";
    if (!id || used.has(id) || !/^n[_a-z0-9-]{2,}$/i.test(id)) {
      seq += 1;
      id = `n_${seq.toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
    }
    used.add(id);
    return { ...current, _nodeId: id };
  }) as T;
}

export function assignDefinitionIds(definition: DocumentDefinition): DocumentDefinition {
  const next: DocumentDefinition = {
    ...definition,
    content: assignNodeIds(definition.content) as unknown[],
  };
  if (definition.header !== undefined) next.header = assignNodeIds(definition.header);
  if (definition.footer !== undefined) next.footer = assignNodeIds(definition.footer);
  return next;
}

export function stripInternal(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripInternal);
  if (!isRecord(node)) return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("_") || BAD_KEYS.has(key)) continue;
    out[key] = stripInternal(value);
  }
  return out;
}

function cleanDataImage(value: string, label: string, warnings: string[]): string | null {
  const match = /^data:image\/(png|jpe?g|gif|webp);base64,/i.exec(value);
  if (!match) {
    warnings.push(`Image “${label}” was removed. Only PNG, JPEG, GIF, and WebP data are accepted.`);
    return null;
  }
  const payload = value.slice(match[0].length).replace(/\s/g, "");
  if (!/^[a-z0-9+/=]+$/i.test(payload)) {
    warnings.push(`Image “${label}” was removed because the image data is not valid base64.`);
    return null;
  }
  const bytes = Math.floor((payload.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) {
    warnings.push(`Image “${label}” was removed because it is larger than 2 MB.`);
    return null;
  }
  return `${match[0]}${payload}`;
}

function sanitizeNode(node: unknown, warnings: string[], depth: number, counter: { nodes: number }): unknown {
  if (counter.nodes > 8000) return "";
  if (depth > 40) return "";
  if (typeof node === "string") return node.slice(0, 100_000);
  if (typeof node === "number" || typeof node === "boolean" || node == null) return node;
  if (Array.isArray(node)) {
    counter.nodes += 1;
    return node.map((item) => sanitizeNode(item, warnings, depth + 1, counter));
  }
  if (!isRecord(node)) return "";
  counter.nodes += 1;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (BAD_KEYS.has(key) || key.startsWith("$") || (key.startsWith("_") && key !== "_nodeId")) continue;
    if (!NODE_KEYS.has(key)) continue;
    if (key === "font") {
      if (value === "Roboto") out.font = "Roboto";
      else if (!warnings.some((item) => item.includes("replaced with Roboto"))) {
        warnings.push("An unsupported font was replaced with Roboto.");
      }
      continue;
    }
    if (key === "link" && typeof value === "string") {
      if (/^\s*javascript:/i.test(value)) {
        warnings.push("A javascript: link was removed.");
        continue;
      }
      out.link = value.slice(0, 2000);
      continue;
    }
    if (key === "image" && typeof value === "string") {
      if (value.startsWith("data:image/")) {
        const cleaned = cleanDataImage(value, "inline", warnings);
        if (cleaned) out.image = cleaned;
        continue;
      }
      if (/^https?:/i.test(value)) {
        warnings.push("A remote image URL was removed so the server does not fetch it.");
        continue;
      }
      if (/^[a-zA-Z0-9_-]{1,80}$/.test(value)) out.image = value;
      continue;
    }
    if (key === "pageBreak" && typeof value === "string") {
      if (value === "before" || value === "after") out.pageBreak = value;
      continue;
    }
    out[key] = sanitizeNode(value, warnings, depth + 1, counter);
  }
  return out;
}

function sanitizeMargins(value: unknown, errors: FieldError[]): number | number[] | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!Array.isArray(value)) return undefined;
  if ((value.length !== 2 && value.length !== 4) || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    errors.push({ path: "pageMargins", message: "Page margins must be a number or an array of two or four numbers." });
    return [40, 48, 40, 48];
  }
  return value as number[];
}

export function sanitizeDefinition(input: unknown): {
  definition: DocumentDefinition;
  warnings: string[];
  errors: FieldError[];
} {
  const warnings: string[] = [];
  const errors: FieldError[] = [];
  if (!isRecord(input)) {
    return {
      definition: blankDefinition(),
      warnings,
      errors: [{ path: "", message: "A PDFMake document definition must be a JSON object." }],
    };
  }
  if (!Array.isArray(input.content)) {
    errors.push({ path: "content", message: "The document definition needs a content array." });
  }

  const definition: DocumentDefinition = {
    content: Array.isArray(input.content)
      ? (sanitizeNode(input.content, warnings, 0, { nodes: 0 }) as unknown[])
      : [],
  };

  if (typeof input.pageSize === "string" && input.pageSize.length < 20) {
    definition.pageSize = input.pageSize;
  } else if (isRecord(input.pageSize) && typeof input.pageSize.width === "number" && typeof input.pageSize.height === "number") {
    definition.pageSize = { width: input.pageSize.width, height: input.pageSize.height };
  } else if (input.pageSize !== undefined) {
    errors.push({ path: "pageSize", message: "Page size must be a name such as A4 or an object with width and height." });
  }

  if (input.pageOrientation === "portrait" || input.pageOrientation === "landscape") {
    definition.pageOrientation = input.pageOrientation;
  } else if (input.pageOrientation !== undefined) {
    errors.push({ path: "pageOrientation", message: "Page orientation must be portrait or landscape." });
  }

  const margins = sanitizeMargins(input.pageMargins, errors);
  if (margins !== undefined) definition.pageMargins = margins;

  for (const key of ["defaultStyle", "styles"] as const) {
    if (isRecord(input[key])) definition[key] = sanitizeNode(input[key], warnings, 0, { nodes: 0 }) as Record<string, unknown>;
  }
  if (isRecord(input.info)) {
    const info: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.info)) {
      if (typeof value === "string") info[key] = value.slice(0, 500);
    }
    definition.info = info;
  }
  for (const key of ["header", "footer", "background", "watermark"] as const) {
    if (input[key] !== undefined) definition[key] = sanitizeNode(input[key], warnings, 0, { nodes: 0 });
  }

  if (isRecord(input.images)) {
    const images: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.images)) {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key) || typeof value !== "string") continue;
      if (value.startsWith("data:image/")) {
        const cleaned = cleanDataImage(value, key, warnings);
        if (cleaned) images[key] = cleaned;
      } else {
        warnings.push(`Image “${key}” was removed. Store images as data URIs, not remote URLs.`);
      }
    }
    definition.images = images;
  }

  for (const key of Object.keys(input)) {
    if (!TOP_LEVEL.has(key)) warnings.push(`Unsupported document property “${key}” was ignored.`);
  }

  if (!definition.defaultStyle) definition.defaultStyle = {};
  definition.defaultStyle = { fontSize: 10, ...definition.defaultStyle, font: "Roboto" };

  return { definition, warnings, errors };
}

export function validateDefinition(definition: DocumentDefinition): FieldError[] {
  const errors: FieldError[] = [];
  if (!Array.isArray(definition.content)) {
    errors.push({ path: "content", message: "Content must be an array." });
    return errors;
  }
  walkNodes(definition.content, (node) => {
    if (isRecord(node.table)) {
      if (!Array.isArray(node.table.body) || node.table.body.some((row) => !Array.isArray(row))) {
        errors.push({ path: "table.body", message: "A table body must be an array of rows." });
      }
    }
    for (const key of CHILD_KEYS) {
      if (key in node && !Array.isArray(node[key])) {
        errors.push({ path: key, message: `${key} must be an array.` });
      }
    }
  });
  return errors;
}

export function prepareDefinition(input: unknown): {
  definition: DocumentDefinition;
  warnings: string[];
  errors: FieldError[];
} {
  const sanitized = sanitizeDefinition(input);
  if (sanitized.errors.length) return sanitized;
  const structural = validateDefinition(sanitized.definition);
  return {
    definition: assignDefinitionIds(normalizePrimitives(sanitized.definition) as DocumentDefinition),
    warnings: sanitized.warnings,
    errors: structural,
  };
}

function flattenValue(value: unknown, prefix: string, rows: { field: string; value: string }[]): void {
  if (Array.isArray(value)) {
    if (value.every((item) => !isRecord(item) && !Array.isArray(item))) {
      rows.push({ field: prefix || "items", value: value.map(String).join(", ") });
      return;
    }
    value.forEach((item, index) => flattenValue(item, `${prefix}[${index + 1}]`, rows));
    return;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (!entries.length) {
      rows.push({ field: prefix || "value", value: "" });
      return;
    }
    for (const [key, child] of entries) {
      flattenValue(child, prefix ? `${prefix}.${key}` : key, rows);
    }
    return;
  }
  rows.push({ field: prefix || "value", value: value == null ? "" : String(value) });
}

export function genericJsonToDefinition(value: unknown, filename: string): DocumentDefinition {
  const rows: { field: string; value: string }[] = [];
  flattenValue(value, "", rows);
  const body: unknown[][] = [
    [
      { text: "Field", bold: true, fillColor: "#e8f6ff" },
      { text: "Value", bold: true, fillColor: "#e8f6ff" },
    ],
    ...rows.slice(0, 500).map((row) => [row.field, row.value.slice(0, 2000)]),
  ];
  const title = filename.replace(/\.json$/i, "") || "Imported JSON";
  return {
    pageSize: "A4",
    pageMargins: [36, 42, 36, 42],
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#0f172a" },
    content: [
      { text: title, fontSize: 18, bold: true, margin: [0, 0, 0, 6] },
      {
        text: "Imported from generic JSON. This table is a readable view of the data, not a designed PDF layout.",
        fontSize: 9,
        color: "#64748b",
        margin: [0, 0, 0, 12],
      },
      {
        table: { headerRows: 1, widths: ["34%", "66%"], body },
        layout: "lightHorizontalLines",
      },
    ],
  };
}

export function bundleFrom(definition: DocumentDefinition, variables: VariableDefinition[]) {
  return {
    documentDefinition: definition,
    variableSchema: { variables },
  };
}

export function nodePlainText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isRecord(node)) return "";
  if (typeof node.text === "string") return node.text;
  if (Array.isArray(node.text)) return node.text.map(nodePlainText).join("");
  return "";
}
