// server/index.ts
import fs5 from "node:fs";
import path6 from "node:path";
import express2 from "express";

// server/app.ts
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import multer from "multer";
import path4 from "node:path";

// shared/types.ts
var CATEGORIES = [
  "Invoices",
  "Demand Letters",
  "Receipts",
  "Agreements",
  "HR Documents",
  "Offer Letters",
  "Reimbursement Statements",
  "Custom Documents"
];
var MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
var MAX_PDF_PAGES = 50;
var MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// shared/document.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var BAD_KEYS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
var TOP_LEVEL = /* @__PURE__ */ new Set([
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
  "compress"
]);
var NODE_KEYS = /* @__PURE__ */ new Set([
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
  "_nodeId"
]);
var CHILD_KEYS = ["stack", "columns", "ul", "ol"];
function blankDefinition(title = "Untitled document") {
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
        _nodeId: "n_intro"
      }
    ]
  };
}
function locateJsonError(text) {
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
  const literal = (word) => {
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
  const parseValue = () => {
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
function jsonErrorPosition(text, error) {
  const message = error instanceof Error ? error.message : "Invalid JSON";
  const located = locateJsonError(text);
  return { ...located, message };
}
function looksLikePdfMake(value) {
  if (!isRecord(value) || !Array.isArray(value.content)) return false;
  const signals = ["pageSize", "pageMargins", "pageOrientation", "defaultStyle", "styles", "header", "footer", "images", "background"];
  if (signals.some((key) => key in value)) return true;
  if (value.content.length === 0) return false;
  return value.content.every((item) => {
    if (typeof item === "string" || typeof item === "number") return true;
    if (!isRecord(item)) return false;
    return ["text", "table", "columns", "stack", "ul", "ol", "image", "canvas", "qr", "svg", "pageBreak", "toc"].some(
      (key) => key in item
    );
  });
}
function bundleDefinition(value) {
  return value.documentDefinition ?? value.docDefinition;
}
function bundleVariables(value) {
  if (Array.isArray(value.variables)) return value.variables;
  if (isRecord(value.variableSchema)) return value.variableSchema.variables;
  return void 0;
}
function isDocumentBundle(value) {
  if (!isRecord(value)) return false;
  return looksLikePdfMake(bundleDefinition(value)) && Array.isArray(bundleVariables(value));
}
function parseUploadedJson(raw) {
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
          message: "This file is not pure JSON. Document Studio never executes JavaScript. Save the PDFMake definition as a .json file and upload that."
        }
      ]
    };
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const pos = jsonErrorPosition(text, error);
    return {
      classification: "invalid",
      errors: [{ path: "", message: "The JSON could not be parsed.", line: pos.line, column: pos.column }]
    };
  }
  if (Array.isArray(value)) {
    return { classification: "generic", value, errors: [] };
  }
  if (isDocumentBundle(value)) {
    return {
      classification: "bundle",
      value,
      definition: bundleDefinition(value),
      variables: bundleVariables(value),
      errors: []
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
    errors: [{ path: "", message: "The JSON must be an object or an array." }]
  };
}
function walkNodes(node, visit) {
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
function mapContent(node, map) {
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
        body: next.table.body.map(
          (row) => Array.isArray(row) ? row.map((cell) => mapContent(cell, map)) : row
        )
      }
    };
  }
  return next;
}
function mapDocument(definition, map) {
  const next = {
    ...definition,
    content: mapContent(definition.content, map)
  };
  if (definition.header !== void 0) next.header = mapContent(definition.header, map);
  if (definition.footer !== void 0) next.footer = mapContent(definition.footer, map);
  return next;
}
function asTextNode(value) {
  return { text: String(value) };
}
function normalizePrimitives(node) {
  if (typeof node === "string" || typeof node === "number") return asTextNode(node);
  if (Array.isArray(node)) return node.map((item) => normalizePrimitives(item));
  if (!isRecord(node)) return node;
  const next = { ...node };
  if (Array.isArray(next.text)) {
    next.text = next.text.map(
      (item) => typeof item === "string" || typeof item === "number" ? asTextNode(item) : normalizePrimitives(item)
    );
  }
  for (const key of CHILD_KEYS) {
    if (Array.isArray(next[key])) {
      next[key] = next[key].map(
        (item) => typeof item === "string" || typeof item === "number" ? asTextNode(item) : normalizePrimitives(item)
      );
    }
  }
  if (isRecord(next.table) && Array.isArray(next.table.body)) {
    next.table = {
      ...next.table,
      body: next.table.body.map(
        (row) => Array.isArray(row) ? row.map(
          (cell) => typeof cell === "string" || typeof cell === "number" ? asTextNode(cell) : normalizePrimitives(cell)
        ) : row
      )
    };
  }
  for (const key of ["content", "header", "footer"]) {
    if (next[key] !== void 0) next[key] = normalizePrimitives(next[key]);
  }
  return next;
}
function assignNodeIds(node) {
  const used = /* @__PURE__ */ new Set();
  let seq = 0;
  return mapContent(node, (current) => {
    let id = typeof current._nodeId === "string" ? current._nodeId : "";
    if (!id || used.has(id) || !/^n[_a-z0-9-]{2,}$/i.test(id)) {
      seq += 1;
      id = `n_${seq.toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
    }
    used.add(id);
    return { ...current, _nodeId: id };
  });
}
function assignDefinitionIds(definition) {
  const next = {
    ...definition,
    content: assignNodeIds(definition.content)
  };
  if (definition.header !== void 0) next.header = assignNodeIds(definition.header);
  if (definition.footer !== void 0) next.footer = assignNodeIds(definition.footer);
  return next;
}
function stripInternal(node) {
  if (Array.isArray(node)) return node.map(stripInternal);
  if (!isRecord(node)) return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("_") || BAD_KEYS.has(key)) continue;
    out[key] = stripInternal(value);
  }
  return out;
}
function cleanDataImage(value, label, warnings) {
  const match = /^data:image\/(png|jpe?g|gif|webp);base64,/i.exec(value);
  if (!match) {
    warnings.push(`Image \u201C${label}\u201D was removed. Only PNG, JPEG, GIF, and WebP data are accepted.`);
    return null;
  }
  const payload = value.slice(match[0].length).replace(/\s/g, "");
  if (!/^[a-z0-9+/=]+$/i.test(payload)) {
    warnings.push(`Image \u201C${label}\u201D was removed because the image data is not valid base64.`);
    return null;
  }
  const bytes = Math.floor(payload.length * 3 / 4);
  if (bytes > MAX_IMAGE_BYTES) {
    warnings.push(`Image \u201C${label}\u201D was removed because it is larger than 2 MB.`);
    return null;
  }
  return `${match[0]}${payload}`;
}
function sanitizeNode(node, warnings, depth, counter) {
  if (counter.nodes > 8e3) return "";
  if (depth > 40) return "";
  if (typeof node === "string") return node.slice(0, 1e5);
  if (typeof node === "number" || typeof node === "boolean" || node == null) return node;
  if (Array.isArray(node)) {
    counter.nodes += 1;
    return node.map((item) => sanitizeNode(item, warnings, depth + 1, counter));
  }
  if (!isRecord(node)) return "";
  counter.nodes += 1;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (BAD_KEYS.has(key) || key.startsWith("$") || key.startsWith("_") && key !== "_nodeId") continue;
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
      out.link = value.slice(0, 2e3);
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
function sanitizeMargins(value, errors) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!Array.isArray(value)) return void 0;
  if (value.length !== 2 && value.length !== 4 || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    errors.push({ path: "pageMargins", message: "Page margins must be a number or an array of two or four numbers." });
    return [40, 48, 40, 48];
  }
  return value;
}
function sanitizeDefinition(input) {
  const warnings = [];
  const errors = [];
  if (!isRecord(input)) {
    return {
      definition: blankDefinition(),
      warnings,
      errors: [{ path: "", message: "A PDFMake document definition must be a JSON object." }]
    };
  }
  if (!Array.isArray(input.content)) {
    errors.push({ path: "content", message: "The document definition needs a content array." });
  }
  const definition = {
    content: Array.isArray(input.content) ? sanitizeNode(input.content, warnings, 0, { nodes: 0 }) : []
  };
  if (typeof input.pageSize === "string" && input.pageSize.length < 20) {
    definition.pageSize = input.pageSize;
  } else if (isRecord(input.pageSize) && typeof input.pageSize.width === "number" && typeof input.pageSize.height === "number") {
    definition.pageSize = { width: input.pageSize.width, height: input.pageSize.height };
  } else if (input.pageSize !== void 0) {
    errors.push({ path: "pageSize", message: "Page size must be a name such as A4 or an object with width and height." });
  }
  if (input.pageOrientation === "portrait" || input.pageOrientation === "landscape") {
    definition.pageOrientation = input.pageOrientation;
  } else if (input.pageOrientation !== void 0) {
    errors.push({ path: "pageOrientation", message: "Page orientation must be portrait or landscape." });
  }
  const margins = sanitizeMargins(input.pageMargins, errors);
  if (margins !== void 0) definition.pageMargins = margins;
  for (const key of ["defaultStyle", "styles"]) {
    if (isRecord(input[key])) definition[key] = sanitizeNode(input[key], warnings, 0, { nodes: 0 });
  }
  if (isRecord(input.info)) {
    const info = {};
    for (const [key, value] of Object.entries(input.info)) {
      if (typeof value === "string") info[key] = value.slice(0, 500);
    }
    definition.info = info;
  }
  for (const key of ["header", "footer", "background", "watermark"]) {
    if (input[key] !== void 0) definition[key] = sanitizeNode(input[key], warnings, 0, { nodes: 0 });
  }
  if (isRecord(input.images)) {
    const images = {};
    for (const [key, value] of Object.entries(input.images)) {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key) || typeof value !== "string") continue;
      if (value.startsWith("data:image/")) {
        const cleaned = cleanDataImage(value, key, warnings);
        if (cleaned) images[key] = cleaned;
      } else {
        warnings.push(`Image \u201C${key}\u201D was removed. Store images as data URIs, not remote URLs.`);
      }
    }
    definition.images = images;
  }
  for (const key of Object.keys(input)) {
    if (!TOP_LEVEL.has(key)) warnings.push(`Unsupported document property \u201C${key}\u201D was ignored.`);
  }
  if (!definition.defaultStyle) definition.defaultStyle = {};
  definition.defaultStyle = { fontSize: 10, ...definition.defaultStyle, font: "Roboto" };
  return { definition, warnings, errors };
}
function validateDefinition(definition) {
  const errors = [];
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
function prepareDefinition(input) {
  const sanitized = sanitizeDefinition(input);
  if (sanitized.errors.length) return sanitized;
  const structural = validateDefinition(sanitized.definition);
  return {
    definition: assignDefinitionIds(normalizePrimitives(sanitized.definition)),
    warnings: sanitized.warnings,
    errors: structural
  };
}
function flattenValue(value, prefix, rows) {
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
function genericJsonToDefinition(value, filename) {
  const rows = [];
  flattenValue(value, "", rows);
  const body = [
    [
      { text: "Field", bold: true, fillColor: "#e8f6ff" },
      { text: "Value", bold: true, fillColor: "#e8f6ff" }
    ],
    ...rows.slice(0, 500).map((row) => [row.field, row.value.slice(0, 2e3)])
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
        margin: [0, 0, 0, 12]
      },
      {
        table: { headerRows: 1, widths: ["34%", "66%"], body },
        layout: "lightHorizontalLines"
      }
    ]
  };
}
function bundleFrom(definition, variables) {
  return {
    documentDefinition: definition,
    variableSchema: { variables }
  };
}
function nodePlainText(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isRecord(node)) return "";
  if (typeof node.text === "string") return node.text;
  if (Array.isArray(node.text)) return node.text.map(nodePlainText).join("");
  return "";
}

// shared/format.ts
import { format, isValid, parse, parseISO } from "date-fns";
var DATE_FORMATS = [
  "yyyy-MM-dd",
  "dd/MM/yyyy",
  "d/M/yyyy",
  "MM/dd/yyyy",
  "dd-MM-yyyy",
  "d MMM yyyy",
  "dd MMM yyyy",
  "d MMMM yyyy",
  "dd MMMM yyyy"
];
function coerceNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const cleaned = value.replace(/[₹$€£,\s]/g, "").replace(/rs\.?/i, "");
  if (!cleaned) return Number.NaN;
  return Number(cleaned);
}
function parseDate(value) {
  if (value instanceof Date && isValid(value)) return value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const iso = parseISO(raw);
    if (isValid(iso)) return iso;
  }
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(raw, fmt, new Date(2e3, 0, 1));
    if (isValid(parsed)) return parsed;
  }
  return null;
}
function formatDate(value) {
  if (value == null || value === "") return "";
  const parsed = parseDate(value);
  if (!parsed) return String(value);
  return format(parsed, "dd MMM yyyy");
}
function toDateInputValue(value) {
  const parsed = parseDate(value);
  if (!parsed) return "";
  return format(parsed, "yyyy-MM-dd");
}
function formatCurrency(value) {
  if (value == null || value === "") return "";
  const amount = coerceNumber(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}
function formatPercent(value) {
  if (value == null || value === "") return "";
  const raw = String(value).trim().replace(/%$/, "");
  const amount = coerceNumber(raw);
  if (!Number.isFinite(amount)) return String(value);
  const body = Number.isInteger(amount) ? String(amount) : String(amount);
  return `${body}%`;
}
function formatVariableValue(type, value) {
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
function filenamePart(value) {
  const clean = value.normalize("NFKD").replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return clean.slice(0, 60);
}
function buildPdfFilename(templateName, primaryValue, when = /* @__PURE__ */ new Date()) {
  const date = format(when, "yyyy-MM-dd");
  const parts = [filenamePart(templateName) || "Document", filenamePart(primaryValue), date].filter(Boolean);
  return `${parts.join("_")}.pdf`;
}

// shared/variables.ts
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var PHONE_RE = /^\+?[\d\s().-]{8,22}$/;
var DATE_RE = /^(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})$/;
var CURRENCY_RE = /^(?:₹|rs\.?|inr|\$|€|£)\s*[\d,]+(?:\.\d+)?$/i;
var PERCENT_RE = /^-?\d{1,3}(?:\.\d+)?\s*%$/;
var PLAIN_NUMBER_RE = /^-?[\d,]+(?:\.\d+)?$/;
var PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
var SUMMARY_RE = /^(total|sub\s*total|grand\s*total|gst|cgst|sgst|igst|tax|vat|discount|balance|amount\s*due|net|round\s*off)\b/i;
var FIELD_RULES = [
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
  { test: /\b(total\s*amount|amount|balance|price)\b/i, type: "currency", group: "Financial Details", id: "total_amount" }
];
var GROUPS = [
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
  "General"
];
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function slugVariableId(label, used, preferred) {
  const source = preferred || label;
  let base = source.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
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
function digitCount(value) {
  return value.replace(/\D/g, "").length;
}
function isDistinctive(value, type) {
  const trimmed = value.trim();
  if (trimmed.length < 2) return false;
  const stop = /* @__PURE__ */ new Set(["total", "amount", "date", "name", "invoice", "yes", "no", "na", "n/a", "mr", "ms", "rs"]);
  if (stop.has(trimmed.toLowerCase())) return false;
  if (PLAIN_NUMBER_RE.test(trimmed) && digitCount(trimmed) < 4 && type !== "currency" && type !== "percent") return false;
  return true;
}
function inferFromValue(value, fallback) {
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
function classifyLabel(label, value) {
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
function standaloneCandidate(text) {
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
function collectOwnedText(definition) {
  const found = [];
  const visit = (node) => {
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
function columnType(label) {
  if (/\b(qty|quantity|count)\b/i.test(label)) return "number";
  if (/%|percent/i.test(label)) return "percent";
  if (/\b(amount|rate|price|total|tax|vat|value|cost)\b/i.test(label)) return "currency";
  return "text";
}
function headerScore(cells) {
  return cells.filter(
    (cell) => /\b(description|particular|item|details|qty|quantity|rate|price|amount|tax|vat|total|hsn|unit)\b/i.test(cell)
  ).length;
}
function isSummaryLabel(value) {
  return SUMMARY_RE.test(value.trim());
}
function storedCell(type, raw) {
  if (type === "currency" || type === "number" || type === "percent") {
    const n = coerceNumber(raw.replace("%", ""));
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}
function extractLineItems(definition) {
  const variables = [];
  const used = /* @__PURE__ */ new Set();
  const next = mapDocument(definition, (node) => {
    if (!isRecord(node.table) || !Array.isArray(node.table.body) || node.table.body.length < 2) return node;
    const body = node.table.body.filter(Array.isArray);
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
    const columns = header.map((label, index) => {
      const samples = dataRows.map((row) => nodePlainText(row[index]).trim());
      const percentCount = samples.filter((sample) => /^-?\d{1,3}(?:\.\d+)?\s*%$/.test(sample)).length;
      return {
        key: slugVariableId(label || `column_${index + 1}`, /* @__PURE__ */ new Set()),
        label: label || `Column ${index + 1}`,
        type: percentCount >= Math.ceil(samples.length / 2) ? "percent" : columnType(label)
      };
    });
    const seen = /* @__PURE__ */ new Set();
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
      const record = {};
      columns.forEach((column, index) => {
        record[column.key] = storedCell(column.type, nodePlainText(row[index]).trim());
      });
      return record;
    });
    const id = slugVariableId("Line items", used, variables.length === 0 ? "line_items" : void 0);
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
      confidence: 0.86
    });
    return {
      ...node,
      _nodeId: nodeId,
      table: {
        ...node.table,
        headerRows: 1,
        body: [...body.slice(0, 1), ...body.slice(body.length - summaryCount)]
      }
    };
  });
  return { definition: next, variables };
}
function findCandidates(definition) {
  const candidates = [];
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
          confidence: 0.9
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
        confidence: 0.72
      });
    }
  }
  return candidates;
}
function applyCandidates(definition, candidates) {
  const used = /* @__PURE__ */ new Set();
  const variables = [];
  let next = definition;
  const grouped = /* @__PURE__ */ new Map();
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
    const sourceNodes = new Set(group.map((item) => item.nodeId).filter(Boolean));
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
      confidence: first.confidence
    });
  }
  return { definition: next, variables };
}
function variablesFromPlaceholders(definition, existing) {
  const used = new Set(existing.map((item) => item.id));
  const created = [];
  const texts = collectOwnedText(definition).map((item) => item.text).join("\n");
  const ids = /* @__PURE__ */ new Set();
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
      confidence: 1
    });
  }
  return created;
}
function syncBindings(definition, variables) {
  const found = /* @__PURE__ */ new Map();
  const visit = (node) => {
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
function sortVariables(variables) {
  return [...variables].sort((a, b) => {
    const groupDelta = GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group);
    const safeGroup = (groupDelta === 0 ? 0 : groupDelta) || a.group.localeCompare(b.group);
    if (safeGroup !== 0 && GROUPS.includes(a.group) && GROUPS.includes(b.group)) {
      return GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.order - b.order;
    }
    return a.group.localeCompare(b.group) || a.order - b.order;
  }).map((variable, index) => ({ ...variable, order: index }));
}
function extractVariables(definition) {
  const identified = assignDefinitionIds(definition);
  const lineItems = extractLineItems(identified);
  const applied = applyCandidates(lineItems.definition, findCandidates(lineItems.definition));
  const placeholders = variablesFromPlaceholders(applied.definition, [...lineItems.variables, ...applied.variables]);
  const variables = sortVariables([...lineItems.variables, ...applied.variables, ...placeholders]);
  return { definition: applied.definition, variables: syncBindings(applied.definition, variables) };
}
function applyAiCandidates(definition, candidates) {
  const corpus = collectOwnedText(definition).map((item) => item.text);
  const accepted = candidates.filter((candidate) => {
    const value = candidate.value?.trim();
    if (!value || value.length < 2 || value.length > 500) return false;
    return corpus.some((text) => text.includes(value));
  });
  const extracted = applyCandidates(assignDefinitionIds(definition), accepted);
  return {
    definition: extracted.definition,
    variables: syncBindings(extracted.definition, sortVariables(extracted.variables))
  };
}
function replacePlaceholder(definition, id, replacement) {
  const pattern = new RegExp(`\\{\\{\\s*${id}\\s*\\}\\}`, "g");
  return mapDocument(definition, (node) => {
    if (typeof node.text !== "string") return node;
    return { ...node, text: node.text.replace(pattern, replacement) };
  });
}
function addVariable(definition, variables, input) {
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
  const variable = {
    id,
    label: input.label.trim() || "Field",
    type: input.type === "text" ? inferred.type : input.type,
    defaultValue: input.type === "text" ? inferred.stored : needle,
    required: input.required,
    group: input.group.trim() || "General",
    order: variables.length,
    bindings: [{ nodeId: input.nodeId, field: "text" }]
  };
  if (variable.type === "date") variable.defaultValue = toDateInputValue(needle) || needle;
  if (variable.type === "currency" || variable.type === "number" || variable.type === "percent") {
    const amount = coerceNumber(String(needle).replace("%", ""));
    if (Number.isFinite(amount)) variable.defaultValue = amount;
  }
  return { definition: next, variables: syncBindings(next, [...variables, variable]) };
}
function deleteVariable(definition, variables, id) {
  const variable = variables.find((item) => item.id === id);
  if (!variable) return { definition, variables };
  let next = definition;
  if (variable.type === "lineItems" && variable.tableNodeId && Array.isArray(variable.defaultValue)) {
    next = mapDocument(definition, (node) => {
      if (node._nodeId !== variable.tableNodeId || !isRecord(node.table) || !Array.isArray(node.table.body)) return node;
      const columns = variable.columns ?? [];
      const rows = variable.defaultValue.map(
        (row) => columns.map((column) => ({ text: row[column.key] == null ? "" : String(row[column.key]) }))
      );
      const body = [...node.table.body];
      const headerCount = variable.headerRowCount ?? 1;
      body.splice(headerCount, 0, ...rows);
      return { ...node, table: { ...node.table, body } };
    });
  } else {
    const replacement = variable.defaultValue == null ? "" : variable.type === "percent" ? `${variable.defaultValue}%` : String(variable.defaultValue);
    next = replacePlaceholder(definition, id, replacement);
  }
  return { definition: next, variables: variables.filter((item) => item.id !== id) };
}
function renameVariable(definition, variables, id, label) {
  const nextLabel = label.trim();
  if (!nextLabel) return { definition, variables, error: "A label is required." };
  const used = new Set(variables.filter((item) => item.id !== id).map((item) => item.id));
  const nextId = slugVariableId(nextLabel, used);
  const replaced = replacePlaceholder(definition, id, `{{${nextId}}}`);
  const nextVariables = variables.map(
    (variable) => variable.id === id ? { ...variable, id: nextId, label: nextLabel } : variable
  );
  return { definition: replaced, variables: syncBindings(replaced, nextVariables) };
}
function updateVariable(variables, id, patch) {
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
function moveVariable(variables, id, direction) {
  const index = variables.findIndex((item2) => item2.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= variables.length) return variables;
  const next = [...variables];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next.map((variable, order) => ({ ...variable, order }));
}
function linkOccurrences(definition, variables, id) {
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
function normalizeVariableList(input) {
  const source = Array.isArray(input) ? input : isRecord(input) && Array.isArray(input.variables) ? input.variables : null;
  if (!source) return { variables: [], errors: ["Variable schema must be an array."] };
  const errors = [];
  const used = /* @__PURE__ */ new Set();
  const variables = [];
  for (const item of source) {
    if (!isRecord(item)) continue;
    const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : "Field";
    const type = typeof item.type === "string" ? item.type : "text";
    const allowed = [
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
      "lineItems"
    ];
    if (!allowed.includes(type)) {
      errors.push(`Unsupported variable type \u201C${String(item.type)}\u201D.`);
      continue;
    }
    const id = slugVariableId(typeof item.id === "string" ? item.id : label, used);
    const columns = Array.isArray(item.columns) ? item.columns.filter(isRecord).map((column, index) => ({
      key: slugVariableId(String(column.key || column.label || `column_${index + 1}`), /* @__PURE__ */ new Set()),
      label: String(column.label || column.key || `Column ${index + 1}`),
      type: ["text", "number", "currency", "percent"].includes(String(column.type)) ? column.type : "text"
    })) : void 0;
    variables.push({
      id,
      label,
      type,
      defaultValue: item.defaultValue ?? (type === "lineItems" ? [] : ""),
      required: Boolean(item.required),
      group: typeof item.group === "string" && item.group.trim() ? item.group.trim() : "General",
      order: variables.length,
      options: Array.isArray(item.options) ? item.options.map(String).slice(0, 50) : void 0,
      validation: isRecord(item.validation) ? {
        min: typeof item.validation.min === "number" ? item.validation.min : void 0,
        max: typeof item.validation.max === "number" ? item.validation.max : void 0,
        pattern: typeof item.validation.pattern === "string" ? item.validation.pattern.slice(0, 200) : void 0,
        message: typeof item.validation.message === "string" ? item.validation.message.slice(0, 200) : void 0
      } : void 0,
      bindings: [],
      columns,
      tableNodeId: typeof item.tableNodeId === "string" ? item.tableNodeId : void 0,
      headerRowCount: typeof item.headerRowCount === "number" ? item.headerRowCount : void 0,
      summaryRowCount: typeof item.summaryRowCount === "number" ? item.summaryRowCount : void 0,
      confidence: typeof item.confidence === "number" ? item.confidence : void 0
    });
  }
  return { variables, errors };
}

// server/db.ts
import fs2 from "node:fs";
import path2 from "node:path";
import crypto3 from "node:crypto";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

// server/storage.ts
import fs from "node:fs";
import path from "node:path";
import crypto2 from "node:crypto";
function projectRoot() {
  return process.cwd();
}
function dataRoot() {
  const configured = process.env.DATA_DIR;
  return configured ? path.resolve(configured) : path.resolve(projectRoot(), "data");
}
function ensureDirs() {
  for (const folder of ["uploads", "generated", "tmp"]) {
    fs.mkdirSync(path.join(dataRoot(), folder), { recursive: true });
  }
}
function databasePath() {
  if (process.env.DATABASE_URL) {
    const configured = process.env.DATABASE_URL;
    const file = configured.startsWith("file:") ? configured.slice("file:".length) : configured;
    return path.isAbsolute(file) ? file : path.resolve(projectRoot(), file);
  }
  return path.join(dataRoot(), "document-studio.db");
}
function newStoredName(extension) {
  return `${crypto2.randomUUID()}${extension}`;
}
function writeUpload(buffer, extension) {
  ensureDirs();
  const name = newStoredName(extension);
  const full = path.join(dataRoot(), "uploads", name);
  fs.writeFileSync(full, buffer);
  return full;
}
function writeGenerated(buffer) {
  ensureDirs();
  const full = path.join(dataRoot(), "generated", newStoredName(".pdf"));
  fs.writeFileSync(full, buffer);
  return full;
}
function readFile(file) {
  return fs.readFileSync(file);
}
function cleanupTemporaryFiles(maxAgeMs = 24 * 60 * 60 * 1e3) {
  const folder = path.join(dataRoot(), "tmp");
  if (!fs.existsSync(folder)) return;
  const now = Date.now();
  for (const name of fs.readdirSync(folder)) {
    const full = path.join(folder, name);
    try {
      const stat = fs.statSync(full);
      if (now - stat.mtimeMs > maxAgeMs) fs.rmSync(full, { force: true });
    } catch {
    }
  }
}

// server/db.ts
var SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  kind TEXT NOT NULL,
  page_count INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  source_type TEXT NOT NULL,
  original_file_path TEXT,
  original_file_name TEXT,
  document_definition TEXT NOT NULL,
  variable_schema TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  warnings TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  document_definition TEXT NOT NULL,
  variable_schema TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(template_id, version_number)
);
CREATE TABLE IF NOT EXISTS generated_documents (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  template_name TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  variable_values TEXT NOT NULL,
  generated_file_path TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  generated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS data_presets (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  name TEXT NOT NULL,
  variable_values TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS document_masters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  document_definition TEXT NOT NULL,
  variable_schema TEXT NOT NULL,
  warnings TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_templates_updated ON templates(updated_at);
CREATE INDEX IF NOT EXISTS idx_generated_at ON generated_documents(generated_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
`;
function openDatabase(file = databasePath()) {
  if (file !== ":memory:") fs2.mkdirSync(path2.dirname(file), { recursive: true });
  const db2 = new Database(file);
  if (file !== ":memory:") db2.pragma("journal_mode = WAL");
  db2.pragma("foreign_keys = ON");
  db2.exec(SCHEMA);
  return db2;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function createUser(db2, input) {
  const user = {
    id: crypto3.randomUUID(),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    role: input.role,
    createdAt: nowIso()
  };
  db2.prepare(
    `INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(user.id, user.email, user.name, bcrypt.hashSync(input.password, 10), user.role, user.createdAt);
  return user;
}
function countUsers(db2) {
  return db2.prepare(`SELECT COUNT(*) AS count FROM users`).get().count;
}
function findUserByEmail(db2, email2) {
  const row = db2.prepare(`SELECT * FROM users WHERE email = ?`).get(email2.trim().toLowerCase());
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
    passwordHash: row.password_hash
  };
}
function createSession(db2, userId) {
  const token = crypto3.randomBytes(32).toString("hex");
  const tokenHash = crypto3.createHash("sha256").update(token).digest("hex");
  db2.prepare(`INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    crypto3.randomUUID(),
    userId,
    tokenHash,
    new Date(Date.now() + 7 * 864e5).toISOString(),
    nowIso()
  );
  return token;
}
function userForToken(db2, token) {
  if (!token) return null;
  const tokenHash = crypto3.createHash("sha256").update(token).digest("hex");
  const row = db2.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`
  ).get(tokenHash, nowIso());
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, createdAt: row.created_at };
}
function deleteSession(db2, token) {
  if (!token) return;
  const tokenHash = crypto3.createHash("sha256").update(token).digest("hex");
  db2.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
}
function audit(db2, entry) {
  db2.prepare(`INSERT INTO audit_logs (id, user_id, action, entity, entity_id, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    crypto3.randomUUID(),
    entry.userId ?? null,
    entry.action,
    entry.entity,
    entry.entityId ?? null,
    JSON.stringify(entry.meta ?? {}),
    nowIso()
  );
}
function insertUpload(db2, input) {
  const id = crypto3.randomUUID();
  db2.prepare(
    `INSERT INTO uploads (id, user_id, original_name, stored_path, mime, size_bytes, kind, page_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.userId, input.originalName, input.storedPath, input.mime, input.size, input.kind, input.pageCount, nowIso());
  return id;
}
function getUpload(db2, id, userId) {
  return db2.prepare(`SELECT * FROM uploads WHERE id = ? AND user_id = ?`).get(id, userId);
}
function mapTemplate(row) {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    category: String(row.category),
    sourceType: String(row.source_type),
    originalFilePath: row.original_file_path ?? null,
    originalFileName: row.original_file_name ?? null,
    documentDefinition: String(row.document_definition),
    variableSchema: String(row.variable_schema),
    version: Number(row.version),
    status: String(row.status),
    warnings: String(row.warnings ?? "[]"),
    createdBy: String(row.created_by),
    updatedBy: String(row.updated_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdByName: row.created_by_name ? String(row.created_by_name) : void 0,
    updatedByName: row.updated_by_name ? String(row.updated_by_name) : void 0
  };
}
var TEMPLATE_SELECT = `
  SELECT t.*, cu.name AS created_by_name, uu.name AS updated_by_name
  FROM templates t
  JOIN users cu ON cu.id = t.created_by
  JOIN users uu ON uu.id = t.updated_by
`;
function insertTemplate(db2, input) {
  db2.prepare(
    `INSERT INTO templates (
      id, name, description, category, source_type, original_file_path, original_file_name,
      document_definition, variable_schema, version, status, warnings, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.name,
    input.description,
    input.category,
    input.sourceType,
    input.originalFilePath,
    input.originalFileName,
    input.documentDefinition,
    input.variableSchema,
    input.version,
    input.status,
    input.warnings,
    input.createdBy,
    input.updatedBy,
    input.createdAt,
    input.updatedAt
  );
  db2.prepare(
    `INSERT INTO template_versions (id, template_id, version_number, document_definition, variable_schema, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(crypto3.randomUUID(), input.id, input.version, input.documentDefinition, input.variableSchema, input.createdBy, input.createdAt);
}
function getTemplate(db2, id) {
  const row = db2.prepare(`${TEMPLATE_SELECT} WHERE t.id = ?`).get(id);
  return row ? mapTemplate(row) : null;
}
function updateTemplate(db2, id, patch) {
  const current = getTemplate(db2, id);
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    updatedAt: nowIso()
  };
  const definitionChanged = next.documentDefinition !== current.documentDefinition || next.variableSchema !== current.variableSchema;
  if (definitionChanged) next.version = current.version + 1;
  db2.prepare(
    `UPDATE templates SET name = ?, description = ?, category = ?, document_definition = ?, variable_schema = ?,
      version = ?, status = ?, warnings = ?, updated_by = ?, updated_at = ? WHERE id = ?`
  ).run(
    next.name,
    next.description,
    next.category,
    next.documentDefinition,
    next.variableSchema,
    next.version,
    next.status,
    next.warnings,
    next.updatedBy,
    next.updatedAt,
    id
  );
  if (definitionChanged) {
    db2.prepare(
      `INSERT INTO template_versions (id, template_id, version_number, document_definition, variable_schema, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(crypto3.randomUUID(), id, next.version, next.documentDefinition, next.variableSchema, next.updatedBy, next.updatedAt);
  }
  return getTemplate(db2, id);
}
var SORTS = {
  updated_at: "t.updated_at",
  created_at: "t.created_at",
  name: "t.name",
  status: "t.status",
  category: "t.category"
};
function listTemplates(db2, query) {
  const where = [];
  const params = [];
  if (query.q?.trim()) {
    const term = `%${query.q.trim().replace(/[\\%_]/g, "\\$&")}%`;
    where.push(`(t.name LIKE ? ESCAPE '\\' OR t.category LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\' OR cu.name LIKE ? ESCAPE '\\')`);
    params.push(term, term, term, term);
  }
  if (query.status) {
    where.push(`t.status = ?`);
    params.push(query.status);
  }
  if (query.category) {
    where.push(`t.category = ?`);
    params.push(query.category);
  }
  if (query.source) {
    where.push(`t.source_type = ?`);
    params.push(query.source);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sort = SORTS[query.sort || "updated_at"] || SORTS.updated_at;
  const dir = query.dir === "asc" ? "ASC" : "DESC";
  const pageSize = Math.min(50, Math.max(1, query.pageSize || 10));
  const page = Math.max(1, query.page || 1);
  const total = db2.prepare(`SELECT COUNT(*) AS count FROM templates t JOIN users cu ON cu.id = t.created_by ${clause}`).get(...params).count;
  const rows = db2.prepare(`${TEMPLATE_SELECT} ${clause} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize);
  return { items: rows.map(mapTemplate), total, page, pageSize };
}
function templateStats(db2) {
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const count = (sql, ...params) => db2.prepare(sql).get(...params).count;
  return {
    totalTemplates: count(`SELECT COUNT(*) AS count FROM templates`),
    totalGenerated: count(`SELECT COUNT(*) AS count FROM generated_documents`),
    recentlyModified: count(`SELECT COUNT(*) AS count FROM templates WHERE updated_at >= ?`, weekAgo),
    draftTemplates: count(`SELECT COUNT(*) AS count FROM templates WHERE status = 'draft'`),
    activeTemplates: count(`SELECT COUNT(*) AS count FROM templates WHERE status = 'active'`)
  };
}
function deleteTemplate(db2, id) {
  db2.prepare(`UPDATE generated_documents SET template_id = NULL WHERE template_id = ?`).run(id);
  db2.prepare(`DELETE FROM data_presets WHERE template_id = ?`).run(id);
  db2.prepare(`DELETE FROM template_versions WHERE template_id = ?`).run(id);
  db2.prepare(`DELETE FROM templates WHERE id = ?`).run(id);
}
function listVersions(db2, templateId) {
  return db2.prepare(
    `SELECT v.id, v.version_number AS versionNumber, v.created_at AS createdAt, u.name AS createdByName
       FROM template_versions v LEFT JOIN users u ON u.id = v.created_by
       WHERE v.template_id = ? ORDER BY v.version_number DESC`
  ).all(templateId);
}
function getVersion(db2, templateId, versionNumber) {
  return db2.prepare(`SELECT * FROM template_versions WHERE template_id = ? AND version_number = ?`).get(templateId, versionNumber);
}
function insertGenerated(db2, input) {
  const id = crypto3.randomUUID();
  db2.prepare(
    `INSERT INTO generated_documents (
      id, template_id, template_name, document_name, file_name, variable_values, generated_file_path, generated_by, generated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.templateId, input.templateName, input.documentName, input.fileName, input.values, input.filePath, input.userId, nowIso());
  return id;
}
function listGenerated(db2, page = 1, pageSize = 10) {
  const size = Math.min(50, Math.max(1, pageSize));
  const current = Math.max(1, page);
  const total = db2.prepare(`SELECT COUNT(*) AS count FROM generated_documents`).get().count;
  const items = db2.prepare(
    `SELECT g.id, g.template_id AS templateId, g.template_name AS templateName, g.document_name AS documentName,
              g.file_name AS fileName, g.generated_at AS generatedAt, u.name AS generatedByName
       FROM generated_documents g LEFT JOIN users u ON u.id = g.generated_by
       ORDER BY g.generated_at DESC LIMIT ? OFFSET ?`
  ).all(size, (current - 1) * size);
  return { items, total, page: current, pageSize: size };
}
function getGenerated(db2, id) {
  return db2.prepare(`SELECT * FROM generated_documents WHERE id = ?`).get(id);
}
function listPresets(db2, templateId) {
  return db2.prepare(
    `SELECT id, name, variable_values AS variableValues, created_at AS createdAt
       FROM data_presets WHERE template_id = ? ORDER BY created_at DESC`
  ).all(templateId);
}
function insertPreset(db2, input) {
  const id = crypto3.randomUUID();
  db2.prepare(`INSERT INTO data_presets (id, template_id, name, variable_values, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    id,
    input.templateId,
    input.name,
    input.values,
    input.userId,
    nowIso()
  );
  return id;
}
function deletePreset(db2, templateId, presetId) {
  db2.prepare(`DELETE FROM data_presets WHERE id = ? AND template_id = ?`).run(presetId, templateId);
}
function insertJob(db2, userId) {
  const id = crypto3.randomUUID();
  const ts = nowIso();
  db2.prepare(`INSERT INTO jobs (id, user_id, status, created_at, updated_at) VALUES (?, ?, 'processing', ?, ?)`).run(id, userId, ts, ts);
  return id;
}
function finishJob(db2, id, result) {
  db2.prepare(`UPDATE jobs SET status = 'completed', result = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(result), nowIso(), id);
}
function failJob(db2, id, message) {
  db2.prepare(`UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`).run(message, nowIso(), id);
}
function mapMaster(row) {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    category: String(row.category),
    documentDefinition: String(row.document_definition),
    variableSchema: String(row.variable_schema),
    warnings: String(row.warnings ?? "[]"),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdByName: row.created_by_name ? String(row.created_by_name) : void 0
  };
}
function insertMaster(db2, input) {
  db2.prepare(
    `INSERT INTO document_masters (
      id, name, description, category, document_definition, variable_schema, warnings, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.name,
    input.description,
    input.category,
    input.documentDefinition,
    input.variableSchema,
    input.warnings,
    input.createdBy,
    input.createdAt,
    input.updatedAt
  );
}
function listMasters(db2) {
  const rows = db2.prepare(
    `SELECT m.*, u.name AS created_by_name
       FROM document_masters m JOIN users u ON u.id = m.created_by
       ORDER BY m.name COLLATE NOCASE`
  ).all();
  return rows.map(mapMaster);
}
function getMaster(db2, id) {
  const row = db2.prepare(
    `SELECT m.*, u.name AS created_by_name
       FROM document_masters m JOIN users u ON u.id = m.created_by
       WHERE m.id = ?`
  ).get(id);
  return row ? mapMaster(row) : null;
}
function deleteMaster(db2, id) {
  db2.prepare(`DELETE FROM document_masters WHERE id = ?`).run(id);
}
function getJob(db2, id, userId) {
  return db2.prepare(`SELECT id, status, result, error, created_at AS createdAt FROM jobs WHERE id = ? AND user_id = ?`).get(id, userId);
}

// server/services/errors.ts
var AppError = class extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  status;
  code;
  details;
};
function mapPdfError(error) {
  const name = typeof error === "object" && error && "name" in error ? String(error.name) : "";
  const message = error instanceof Error ? error.message : "";
  if (name === "PasswordException" || /password/i.test(message)) {
    return new AppError(400, "PDF_PASSWORD", "This PDF is password-protected. Remove the password and upload it again.");
  }
  if (name === "InvalidPDFException" || /invalid pdf|xref|format/i.test(message)) {
    return new AppError(400, "PDF_INVALID", "This file is not a readable PDF. It may be corrupted.");
  }
  return new AppError(400, "PDF_INVALID", "This PDF could not be read. Check that the file is a valid PDF and try again.");
}
function assertPdf(buffer) {
  if (buffer.length < 5 || buffer.subarray(0, 5).toString() !== "%PDF-") {
    throw new AppError(400, "PDF_INVALID", "The file is not a PDF. Upload a .pdf file or a PDFMake .json file.");
  }
}

// server/services/ai.ts
function aiStatus() {
  const openai = Boolean(process.env.OPENAI_API_KEY);
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const choice = (process.env.DOCUMENT_AI_PROVIDER || "auto").toLowerCase();
  let provider = null;
  if (choice === "openai" && openai) provider = "openai";
  else if (choice === "anthropic" && anthropic) provider = "anthropic";
  else if (choice === "auto") provider = openai ? "openai" : anthropic ? "anthropic" : null;
  return { available: provider !== null, provider };
}
function unavailable() {
  return new AppError(
    503,
    "AI_UNAVAILABLE",
    "No AI provider is configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY on the server. You can continue with standard extraction, JSON import, or manual variables."
  );
}
function compactPages(pages) {
  const limit = Math.max(1, Number(process.env.AI_MAX_PAGES || 4));
  return pages.slice(0, limit).map((page, index) => ({
    page: index + 1,
    width: Math.round(page.width),
    height: Math.round(page.height),
    lines: page.glyphs.slice(0, 400).map((glyph) => ({
      text: glyph.text,
      x: Math.round(glyph.x),
      y: Math.round(glyph.y),
      fontSize: Math.round(glyph.fontSize)
    }))
  }));
}
async function completeJson(system, user) {
  const status = aiStatus();
  if (!status.provider) throw unavailable();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9e4);
  try {
    if (status.provider === "openai") {
      const response2 = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0.1,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ]
        })
      });
      if (!response2.ok) {
        throw new AppError(502, "AI_FAILED", "The AI provider rejected the reconstruction request. Standard extraction is still available.");
      }
      const body2 = await response2.json();
      const content2 = body2.choices?.[0]?.message?.content;
      if (!content2) throw new AppError(502, "AI_FAILED", "The AI provider returned an empty response.");
      return content2;
    }
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: 8e3,
        temperature: 0.1,
        system,
        messages: [{ role: "user", content: user }]
      })
    });
    if (!response.ok) {
      throw new AppError(502, "AI_FAILED", "The AI provider rejected the reconstruction request. Standard extraction is still available.");
    }
    const body = await response.json();
    const content = body.content?.map((part) => part.text || "").join("\n");
    if (!content) throw new AppError(502, "AI_FAILED", "The AI provider returned an empty response.");
    return content;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError(504, "AI_TIMEOUT", "The AI request timed out. Try standard extraction or a smaller document.");
    }
    throw new AppError(502, "AI_FAILED", "The AI provider could not be reached. Standard extraction is still available.");
  } finally {
    clearTimeout(timer);
  }
}
function parseModelJson(raw) {
  const fenced = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(fenced);
  } catch {
    throw new AppError(422, "AI_INVALID_OUTPUT", "The AI response was not valid JSON and was discarded.");
  }
}
async function reconstructWithAi(pages) {
  const raw = await completeJson(
    "You reconstruct business documents as PDFMake JSON. Return only a JSON object with keys documentDefinition, variables, warnings, and confidence. documentDefinition must contain a content array using text, table, columns, or stack nodes. Use {{variable_id}} placeholders for values that should change. Do not include JavaScript, functions, or remote image URLs. Never invent parties, amounts, or dates that are not in the source.",
    JSON.stringify({ pages: compactPages(pages) })
  );
  const parsed = parseModelJson(raw);
  const prepared = prepareDefinition(parsed.documentDefinition);
  if (prepared.errors.length) {
    throw new AppError(422, "AI_INVALID_OUTPUT", "The AI response was not a valid PDFMake definition and was discarded.", prepared.errors);
  }
  const candidates = (parsed.variables ?? []).flatMap((item) => {
    if (!item || typeof item.label !== "string" || typeof item.value !== "string") return [];
    return [
      {
        label: item.label,
        value: item.value,
        type: item.type || "text",
        group: "General",
        id: typeof item.id === "string" ? item.id : void 0,
        confidence: typeof item.confidence === "number" ? item.confidence : 0.5
      }
    ];
  });
  const applied = applyAiCandidates(prepared.definition, candidates);
  const warnings = [
    "AI reconstruction is an approximation. Review the preview against the original PDF before saving the template.",
    ...prepared.warnings,
    ...Array.isArray(parsed.warnings) ? parsed.warnings.filter((item) => typeof item === "string").slice(0, 8) : []
  ];
  if (!applied.variables.length) {
    warnings.push("The model did not return usable variables. You can mark fields manually in the editor.");
  }
  return { definition: applied.definition, variables: applied.variables, warnings };
}
async function detectVariablesWithAi(definition, text) {
  const raw = await completeJson(
    'Identify editable business fields in a document. Return only JSON: {"variables":[{"id":"customer_name","label":"Customer Name","type":"text","value":"the exact source text","confidence":0.9}]}. Types may be text, textarea, number, currency, date, percent, email, or phone. Values must be copied exactly from the document. Do not invent fields.',
    JSON.stringify({ text: text.slice(0, 12e3), outline: definition.content.slice(0, 80) })
  );
  const parsed = parseModelJson(raw);
  if (!Array.isArray(parsed.variables)) {
    throw new AppError(422, "AI_INVALID_OUTPUT", "The AI variable response did not match the expected schema and was discarded.");
  }
  return parsed.variables.filter((item) => item && typeof item.label === "string" && typeof item.value === "string");
}

// server/services/convert.ts
import crypto4 from "node:crypto";

// shared/binding.ts
var PLACEHOLDER_RE2 = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
var EMAIL_RE2 = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validateValues(variables, values) {
  const errors = [];
  for (const variable of variables) {
    let value = values[variable.id];
    if (value === void 0) {
      const normVar = variable.id.toLowerCase().replace(/[^a-z0-9]/g, "");
      const altKey = Object.keys(values).find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === normVar);
      if (altKey) value = values[altKey];
    }
    const empty = value == null || value === "" || typeof value === "string" && !value.trim() || Array.isArray(value) && value.length === 0;
    if (variable.required && empty) {
      errors.push({ path: variable.id, message: `${variable.label} is required.` });
      continue;
    }
    if (empty || variable.type === "lineItems" || variable.type === "image" || variable.type === "checkbox") continue;
    if ((variable.type === "number" || variable.type === "currency" || variable.type === "percent") && !Number.isFinite(coerceNumber(value))) {
      errors.push({ path: variable.id, message: `${variable.label} must be a number.` });
    }
    if (variable.type === "date" && !parseDate(value)) {
      errors.push({ path: variable.id, message: `${variable.label} must be a valid date.` });
    }
    if (variable.type === "email" && !EMAIL_RE2.test(String(value).trim())) {
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
function lineCell(column, value) {
  if (column.type === "currency") return { text: formatCurrency(value) };
  if (column.type === "percent") return { text: formatPercent(value) };
  if (column.type === "number") {
    const amount = coerceNumber(value);
    return { text: Number.isFinite(amount) ? String(amount) : "" };
  }
  return { text: value == null ? "" : String(value).slice(0, 1e3) };
}
function applyLineItems(definition, variables, values) {
  return mapDocument(definition, (node) => {
    const variable = variables.find((item) => item.type === "lineItems" && item.tableNodeId && item.tableNodeId === node._nodeId);
    if (!variable || !isRecord(node.table) || !Array.isArray(node.table.body) || !variable.columns) return node;
    const source = Array.isArray(values[variable.id]) ? values[variable.id] : [];
    const rows = source.slice(0, 200).map((row) => variable.columns.map((column) => lineCell(column, row?.[column.key])));
    const body = [...node.table.body];
    const headerCount = Math.min(variable.headerRowCount ?? 1, body.length);
    body.splice(headerCount, 0, ...rows);
    return { ...node, table: { ...node.table, body } };
  });
}
function collectUnresolved(node, missing) {
  if (typeof node === "string") {
    for (const match of node.matchAll(PLACEHOLDER_RE2)) missing.add(match[1]);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectUnresolved(item, missing);
    return;
  }
  if (!isRecord(node)) return;
  for (const value of Object.values(node)) collectUnresolved(value, missing);
}
function resolveDocument(definition, variables, values, options) {
  const errors = options.strict ? validateValues(variables, values) : [];
  const warnings = [];
  const byId = new Map(variables.map((variable) => [variable.id, variable]));
  const rendered = applyLineItems(definition, variables, values);
  const withText = mapDocument(rendered, (node) => {
    if (typeof node.text !== "string") return node;
    const text = node.text.replace(PLACEHOLDER_RE2, (token, id) => {
      const normalizedId = id.toLowerCase().replace(/[^a-z0-9]/g, "");
      const variable = byId.get(id) || byId.get(id.toLowerCase()) || Array.from(byId.values()).find(
        (v) => v.id.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedId || v.label.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedId
      );
      if (!variable) return options.strict ? token : `[missing: ${id}]`;
      let value = values[id] ?? values[variable.id];
      if (value === void 0) {
        const matchingKey = Object.keys(values).find(
          (k) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedId || k.toLowerCase().replace(/[^a-z0-9]/g, "") === variable.id.toLowerCase().replace(/[^a-z0-9]/g, "")
        );
        value = matchingKey ? values[matchingKey] : void 0;
      }
      const finalVal = value ?? (options.strict ? "" : variable.defaultValue);
      return formatVariableValue(variable.type, finalVal).slice(0, 5e3);
    });
    return { ...node, text };
  });
  const images = { ...withText.images ?? {} };
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
  const stripped = stripInternal(withImages);
  const missing = /* @__PURE__ */ new Set();
  collectUnresolved(stripped, missing);
  if (options.strict) {
    for (const id of missing) {
      errors.push({ path: id, message: `\u201C${id}\u201D is still unresolved in the document.` });
    }
  } else if (missing.size) {
    warnings.push("Some placeholders have no value yet. They are marked in the preview.");
  }
  if (!stripped.defaultStyle || typeof stripped.defaultStyle !== "object") stripped.defaultStyle = {};
  stripped.defaultStyle = { ...stripped.defaultStyle, font: "Roboto" };
  return { definition: stripped, errors, warnings };
}
function primaryFilenameValue(variables, values) {
  const preferred = variables.find((variable) => /name/i.test(variable.id) && values[variable.id]) ?? variables.find((variable) => variable.type === "text" && values[variable.id]);
  return preferred ? String(values[preferred.id]) : "";
}

// server/services/pdf-extract.ts
async function loadDocument(buffer) {
  assertPdf(buffer);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    return await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      verbosity: 0
    }).promise;
  } catch (error) {
    throw mapPdfError(error);
  }
}
function glyphsFromItems(items, pageHeight) {
  const glyphs = [];
  for (const item of items) {
    if (!item.str?.trim() || !item.transform) continue;
    const transform = item.transform;
    const fontSize = Math.hypot(transform[2] || 0, transform[3] || 0) || Math.abs(transform[0] || 0) || item.height || 11;
    glyphs.push({
      text: item.str,
      x: transform[4] || 0,
      y: pageHeight - (transform[5] || 0) - fontSize,
      width: item.width || item.str.length * fontSize * 0.45,
      height: item.height || fontSize,
      fontSize,
      fontName: item.fontName || ""
    });
  }
  return glyphs;
}
async function readImages(page) {
  const images = [];
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const canvasPkg = await import("@napi-rs/canvas");
    const ops = await page.getOperatorList();
    const seen = /* @__PURE__ */ new Set();
    for (let index = 0; index < ops.fnArray.length; index += 1) {
      if (ops.fnArray[index] !== pdfjs.OPS.paintImageXObject) continue;
      const name = String(ops.argsArray[index]?.[0] ?? "");
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const obj = await new Promise((resolve) => {
        try {
          page.objs.get(name, (value) => resolve(value ?? null));
        } catch {
          resolve(null);
        }
      });
      if (!obj || !(obj.data instanceof Uint8ClampedArray) || typeof obj.width !== "number" || typeof obj.height !== "number") {
        continue;
      }
      try {
        const canvas = canvasPkg.createCanvas(obj.width, obj.height);
        const context = canvas.getContext("2d");
        const imageData = new canvasPkg.ImageData(new Uint8ClampedArray(obj.data), obj.width, obj.height);
        context.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        if (dataUrl.startsWith("data:image/png")) images.push({ dataUrl, width: obj.width, height: obj.height });
      } catch {
      }
      if (images.length >= 4) break;
    }
  } catch {
    return images;
  }
  return images;
}
async function ocrPage(page) {
  try {
    const canvasPkg = await import("@napi-rs/canvas");
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = canvasPkg.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    const factory = {
      create(w, h) {
        const next = canvasPkg.createCanvas(w, h);
        return { canvas: next, context: next.getContext("2d") };
      },
      reset(pair, w, h) {
        pair.canvas.width = w;
        pair.canvas.height = h;
      },
      destroy(pair) {
        pair.canvas.width = 0;
        pair.canvas.height = 0;
      }
    };
    await page.render({ canvasContext: context, viewport, canvasFactory: factory }).promise;
    const png = canvas.toBuffer("image/png");
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const result = await worker.recognize(png);
      const data = result.data;
      return (data.words ?? []).filter((word) => word.text.trim()).map((word) => ({
        text: `${word.text} `,
        x: word.bbox.x0 / scale,
        y: word.bbox.y0 / scale,
        width: Math.max(1, (word.bbox.x1 - word.bbox.x0) / scale),
        height: Math.max(1, (word.bbox.y1 - word.bbox.y0) / scale),
        fontSize: Math.max(8, (word.bbox.y1 - word.bbox.y0) / scale),
        fontName: ""
      }));
    } finally {
      await worker.terminate();
    }
  } catch {
    return [];
  }
}
async function readPage(page, pageNumber) {
  const viewport = page.getViewport({ scale: 1 });
  const text = await page.getTextContent();
  let glyphs = glyphsFromItems(text.items, viewport.height);
  const letters = glyphs.map((glyph) => glyph.text).join("").replace(/\s/g, "").length;
  if (letters < 15 && pageNumber <= 8) {
    const recognized = await ocrPage(page);
    if (recognized.length) glyphs = recognized;
  }
  const images = letters < 15 ? [] : await readImages(page);
  return { width: viewport.width, height: viewport.height, glyphs, images };
}
async function inspectPdf(buffer) {
  const doc = await loadDocument(buffer);
  const pageCount = doc.numPages;
  if (pageCount > MAX_PDF_PAGES) {
    await doc.destroy();
    throw new AppError(400, "PDF_TOO_LARGE", `PDFs are limited to ${MAX_PDF_PAGES} pages.`);
  }
  if (pageCount < 1) {
    await doc.destroy();
    throw new AppError(400, "PDF_INVALID", "This PDF does not contain any pages.");
  }
  await doc.destroy();
  return { pageCount };
}
async function extractPdf(buffer) {
  const doc = await loadDocument(buffer);
  if (doc.numPages > MAX_PDF_PAGES) {
    await doc.destroy();
    throw new AppError(400, "PDF_TOO_LARGE", `PDFs are limited to ${MAX_PDF_PAGES} pages.`);
  }
  const pages = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    pages.push(await readPage(await doc.getPage(pageNumber), pageNumber));
  }
  await doc.destroy();
  const letters = pages.reduce((sum, page) => sum + page.glyphs.map((glyph) => glyph.text).join("").replace(/\s/g, "").length, 0);
  if (letters < 8) {
    throw new AppError(
      422,
      "SCANNED_PDF",
      "This PDF has no text layer and OCR could not read it. Upload a text-based PDF, configure an AI vision provider, or start from PDFMake JSON."
    );
  }
  return { pages, pageCount: doc.numPages };
}

// server/services/layout.ts
var FIDELITY_WARNING = "This PDF was reconstructed from text positions and detected layout. A PDF and a PDFMake definition are different formats, so custom fonts, exact spacing, vector art, and overlapping objects may not match. Compare the original and the preview before using the template.";
function isBold(fontName) {
  return /bold|black|semibold|medium|heavy/i.test(fontName);
}
function clusterLines(glyphs) {
  const sorted = glyphs.filter((glyph) => glyph.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const glyph of sorted) {
    const last = lines[lines.length - 1];
    const tolerance = Math.max(4, (last?.height || glyph.fontSize) * 0.45);
    if (last && Math.abs(glyph.y - last.y) <= tolerance) {
      last.glyphs.push(glyph);
      last.height = Math.max(last.height, glyph.height || glyph.fontSize);
      last.y = Math.min(last.y, glyph.y);
    } else {
      lines.push({ y: glyph.y, height: glyph.height || glyph.fontSize, glyphs: [glyph] });
    }
  }
  for (const line of lines) line.glyphs.sort((a, b) => a.x - b.x);
  return lines;
}
function lineCells(line) {
  const cells = [];
  let current = null;
  for (const glyph of line.glyphs) {
    if (!current) {
      current = {
        text: glyph.text,
        x: glyph.x,
        width: glyph.width,
        fontSize: glyph.fontSize,
        bold: isBold(glyph.fontName)
      };
      continue;
    }
    const gap = glyph.x - (current.x + current.width);
    if (gap > Math.max(18, current.fontSize * 1.5)) {
      cells.push(current);
      current = {
        text: glyph.text,
        x: glyph.x,
        width: glyph.width,
        fontSize: glyph.fontSize,
        bold: isBold(glyph.fontName)
      };
    } else {
      current.text += `${gap > current.fontSize * 0.22 ? " " : ""}${glyph.text}`;
      current.width = glyph.x + glyph.width - current.x;
      current.fontSize = Math.max(current.fontSize, glyph.fontSize);
      current.bold = current.bold || isBold(glyph.fontName);
    }
  }
  if (current) cells.push(current);
  return cells;
}
function tableRun(lines, start) {
  const first = lineCells(lines[start]);
  if (first.length < 2) return 0;
  let length = 1;
  while (start + length < lines.length) {
    const cells = lineCells(lines[start + length]);
    if (cells.length !== first.length) break;
    const aligned = cells.every((cell, index) => Math.abs(cell.x - first[index].x) < 14);
    if (!aligned) break;
    length += 1;
  }
  return length >= 3 ? length : 0;
}
function alignment(cell, pageWidth) {
  const center = cell.x + cell.width / 2;
  if (Math.abs(center - pageWidth / 2) < 36 && cell.x > pageWidth * 0.15) return "center";
  if (cell.x > pageWidth * 0.62) return "right";
  return "left";
}
function namedPage(width, height) {
  const near = (a, b) => Math.abs(a - b) < 8;
  if (near(width, 595) && near(height, 842)) return { pageSize: "A4" };
  if (near(width, 842) && near(height, 595)) return { pageSize: "A4", pageOrientation: "landscape" };
  if (near(width, 612) && near(height, 792)) return { pageSize: "LETTER" };
  return { pageSize: { width: Math.round(width), height: Math.round(height) } };
}
function clampSize(size) {
  if (!Number.isFinite(size) || size <= 0) return 11;
  return Math.max(8, Math.min(28, Math.round(size)));
}
function pagesToDefinition(pages) {
  const warnings = [FIDELITY_WARNING];
  if (!pages.length) {
    warnings.push("The PDF did not contain any pages.");
  }
  const content = [];
  let missingImages = false;
  pages.forEach((page, pageIndex) => {
    if (page.images.length === 0) missingImages = true;
    page.images.forEach((image) => {
      content.push({
        image: image.dataUrl,
        width: Math.min(180, image.width || 120),
        margin: [0, pageIndex && content.length === 0 ? 0 : 8, 0, 8],
        ...pageIndex > 0 && content.length === 0 ? { pageBreak: "before" } : {}
      });
    });
    const lines = clusterLines(page.glyphs);
    if (!lines.length && !page.images.length) {
      warnings.push(`Page ${pageIndex + 1} has no extractable text. It may be a scan or a drawing.`);
      content.push({
        text: `Page ${pageIndex + 1} had no extractable text.`,
        italics: true,
        color: "#64748b",
        ...pageIndex > 0 ? { pageBreak: "before" } : {}
      });
      return;
    }
    let cursor = 0;
    let blockIndex = 0;
    while (cursor < lines.length) {
      const run = tableRun(lines, cursor);
      const pageBreak = pageIndex > 0 && blockIndex === 0 && page.images.length === 0 ? "before" : void 0;
      if (run > 0) {
        const rows = lines.slice(cursor, cursor + run).map((line) => lineCells(line).map((cell) => cell.text.trim()));
        content.push({
          table: { headerRows: 1, widths: Array(rows[0]?.length || 1).fill("*"), body: rows },
          layout: "lightHorizontalLines",
          margin: [0, 8, 0, 8],
          ...pageBreak ? { pageBreak } : {}
        });
        cursor += run;
      } else {
        const cells = lineCells(lines[cursor]);
        const cell = cells[0];
        const previous = lines[cursor - 1];
        const gap = previous ? Math.max(0, lines[cursor].y - (previous.y + previous.height)) : 0;
        content.push({
          text: cells.map((item) => item.text.trim()).join("  "),
          fontSize: clampSize(cell?.fontSize || 11),
          bold: cells.some((item) => item.bold),
          alignment: cell ? alignment(cell, page.width) : "left",
          margin: [0, Math.min(24, Math.round(gap)), 0, 0],
          ...pageBreak ? { pageBreak } : {}
        });
        cursor += 1;
      }
      blockIndex += 1;
    }
  });
  if (missingImages) {
    warnings.push("Logos and embedded images are preserved only when the PDF exposes them as extractable images. Compare the original if the document contains artwork.");
  }
  const first = pages[0] ?? { width: 595, height: 842, glyphs: [], images: [] };
  const named = namedPage(first.width, first.height);
  const minX = Math.min(...pages.flatMap((page) => page.glyphs.map((glyph) => glyph.x)).filter(Number.isFinite), 48);
  const left = Math.max(20, Math.min(72, Math.round(minX)));
  return {
    definition: {
      pageSize: named.pageSize,
      pageOrientation: named.pageOrientation,
      pageMargins: [left, 36, left, 36],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#0f172a" },
      content
    },
    warnings
  };
}

// server/services/pdfmake.ts
import fs3 from "node:fs";
import path3 from "node:path";
import { fileURLToPath } from "node:url";
import PdfPrinter from "pdfmake";
var fontsDir = fs3.existsSync(path3.resolve(process.cwd(), "server/fonts")) ? path3.resolve(process.cwd(), "server/fonts") : path3.resolve(path3.dirname(fileURLToPath(import.meta.url)), "../fonts");
var fonts = {
  Roboto: {
    normal: path3.join(fontsDir, "Roboto-Regular.ttf"),
    bold: path3.join(fontsDir, "Roboto-Medium.ttf"),
    italics: path3.join(fontsDir, "Roboto-Italic.ttf"),
    bolditalics: path3.join(fontsDir, "Roboto-MediumItalic.ttf")
  }
};
var printer = null;
function getPrinter() {
  for (const file of Object.values(fonts.Roboto)) {
    if (!fs3.existsSync(file)) {
      throw new Error(`Font file is missing: ${path3.basename(file)}`);
    }
  }
  printer ??= new PdfPrinter(fonts);
  return printer;
}
async function renderPdf(definition) {
  const printable = stripInternal(definition);
  printable.defaultStyle = { fontSize: 10, ...printable.defaultStyle ?? {}, font: "Roboto" };
  printable.info = { ...printable.info ?? {}, Producer: "Buildesk Document Studio" };
  const document = getPrinter().createPdfKitDocument(printable);
  const chunks = [];
  return new Promise((resolve, reject) => {
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.end();
  });
}

// server/services/convert.ts
function titleFrom(filename) {
  return filename.replace(/\.(pdf|json)$/i, "").replace(/[_-]+/g, " ").trim() || "Untitled document";
}
function categoryFor(name) {
  const found = CATEGORIES.find((category) => name.toLowerCase().includes(category.toLowerCase().replace(/s$/, "")));
  return found || "Custom Documents";
}
function createDraft(db2, user, input) {
  const ts = nowIso();
  const id = crypto4.randomUUID();
  insertTemplate(db2, {
    id,
    name: input.name.slice(0, 160),
    description: (input.description || "").slice(0, 500),
    category: input.category || categoryFor(input.name),
    sourceType: input.sourceType,
    originalFilePath: input.originalPath ?? null,
    originalFileName: input.originalName ?? null,
    documentDefinition: JSON.stringify(input.definition),
    variableSchema: JSON.stringify({ variables: input.variables }),
    version: 1,
    status: "draft",
    warnings: JSON.stringify(input.warnings),
    createdBy: user.id,
    updatedBy: user.id,
    createdAt: ts,
    updatedAt: ts
  });
  audit(db2, { userId: user.id, action: "template.create", entity: "template", entityId: id, meta: { source: input.sourceType } });
  return getTemplate(db2, id);
}
async function convertUpload(db2, user, uploadId, mode) {
  const upload = getUpload(db2, uploadId, user.id);
  if (!upload) throw new AppError(404, "NOT_FOUND", "That upload could not be found. Please upload the file again.");
  const buffer = readFile(upload.stored_path);
  if (upload.kind === "pdf") {
    if (mode !== "standard" && mode !== "ai") {
      throw new AppError(400, "MODE", "Choose standard extraction or AI reconstruction for a PDF.");
    }
    const extracted = await extractPdf(buffer);
    if (mode === "ai") {
      const ai = await reconstructWithAi(extracted.pages);
      return createDraft(db2, user, {
        name: titleFrom(upload.original_name),
        sourceType: "pdf",
        definition: ai.definition,
        variables: ai.variables,
        warnings: ai.warnings,
        originalPath: upload.stored_path,
        originalName: upload.original_name
      });
    }
    const layout = pagesToDefinition(extracted.pages);
    const prepared2 = prepareDefinition(layout.definition);
    if (prepared2.errors.length) {
      throw new AppError(422, "RECONSTRUCTION_FAILED", "The PDF could not be turned into a valid document definition.", prepared2.errors);
    }
    const extractedVars = extractVariables(prepared2.definition);
    return createDraft(db2, user, {
      name: titleFrom(upload.original_name),
      sourceType: "pdf",
      definition: extractedVars.definition,
      variables: extractedVars.variables,
      warnings: [...layout.warnings, ...prepared2.warnings],
      originalPath: upload.stored_path,
      originalName: upload.original_name
    });
  }
  const parsed = parseUploadedJson(buffer.toString("utf8"));
  if (parsed.classification === "script" || parsed.classification === "invalid") {
    throw new AppError(400, "JSON_INVALID", parsed.errors[0]?.message || "The JSON file could not be imported.", parsed.errors);
  }
  if (parsed.classification === "generic") {
    if (mode !== "generic") {
      throw new AppError(422, "JSON_GENERIC", "This JSON is valid, but it is not a PDFMake document definition.");
    }
    const generated = genericJsonToDefinition(parsed.value, upload.original_name);
    const prepared2 = prepareDefinition(generated);
    const vars = extractVariables(prepared2.definition);
    return createDraft(db2, user, {
      name: titleFrom(upload.original_name),
      sourceType: "json",
      definition: vars.definition,
      variables: vars.variables,
      warnings: ["Generic JSON was imported as a field table. It is not a designed document layout.", ...prepared2.warnings],
      originalPath: upload.stored_path,
      originalName: upload.original_name
    });
  }
  const prepared = prepareDefinition(parsed.definition);
  if (prepared.errors.length) {
    throw new AppError(422, "PDFMAKE_INVALID", "The PDFMake definition is not valid.", prepared.errors);
  }
  const normalized = parsed.classification === "bundle" ? normalizeVariableList(parsed.variables) : { variables: [], errors: [] };
  const withVariables = parsed.classification === "bundle" && normalized.variables.length ? { definition: prepared.definition, variables: syncBindings(prepared.definition, normalized.variables) } : extractVariables(prepared.definition);
  return createDraft(db2, user, {
    name: titleFrom(upload.original_name),
    sourceType: "json",
    definition: withVariables.definition,
    variables: withVariables.variables,
    warnings: [
      ...parsed.classification === "bundle" ? ["The JSON bundle was loaded without rewriting an existing variable schema."] : [],
      ...prepared.warnings,
      ...normalized.errors
    ],
    originalPath: upload.stored_path,
    originalName: upload.original_name
  });
}
function documentFromJson(raw, fallbackName) {
  const parsed = parseUploadedJson(raw);
  if (parsed.classification === "script" || parsed.classification === "invalid") {
    throw new AppError(400, "JSON_INVALID", parsed.errors[0]?.message || "The JSON could not be imported.", parsed.errors);
  }
  if (parsed.classification === "generic") {
    const generated = genericJsonToDefinition(parsed.value, fallbackName);
    const prepared2 = prepareDefinition(generated);
    const vars = extractVariables(prepared2.definition);
    return {
      definition: vars.definition,
      variables: vars.variables,
      warnings: ["Generic JSON was imported as a field table. It is not a designed document layout.", ...prepared2.warnings]
    };
  }
  const prepared = prepareDefinition(parsed.definition);
  if (prepared.errors.length) {
    throw new AppError(422, "PDFMAKE_INVALID", "The PDFMake definition is not valid.", prepared.errors);
  }
  const normalized = parsed.classification === "bundle" ? normalizeVariableList(parsed.variables) : { variables: [], errors: [] };
  const withVariables = parsed.classification === "bundle" && normalized.variables.length ? { definition: prepared.definition, variables: syncBindings(prepared.definition, normalized.variables) } : extractVariables(prepared.definition);
  return {
    definition: withVariables.definition,
    variables: withVariables.variables,
    warnings: [...prepared.warnings, ...normalized.errors]
  };
}
function saveMaster(db2, user, input) {
  const name = String(input.name || "").trim().slice(0, 160) || "Untitled master";
  const built = documentFromJson(input.json, name);
  const ts = nowIso();
  const id = crypto4.randomUUID();
  insertMaster(db2, {
    id,
    name,
    description: String(input.description || "").slice(0, 500),
    category: input.category && CATEGORIES.includes(input.category) ? input.category : categoryFor(name),
    documentDefinition: JSON.stringify(built.definition),
    variableSchema: JSON.stringify({ variables: built.variables }),
    warnings: JSON.stringify(built.warnings),
    createdBy: user.id,
    createdAt: ts,
    updatedAt: ts
  });
  audit(db2, { userId: user.id, action: "master.create", entity: "master", entityId: id, meta: { name } });
  return getMaster(db2, id);
}
function createFromMaster(db2, user, masterId) {
  const master = getMaster(db2, masterId);
  if (!master) throw new AppError(404, "NOT_FOUND", "That master format no longer exists.");
  const template = createDraft(db2, user, {
    name: master.name,
    category: master.category,
    description: `Created from master: ${master.name}`,
    sourceType: "json",
    definition: JSON.parse(master.documentDefinition),
    variables: JSON.parse(master.variableSchema).variables,
    warnings: JSON.parse(master.warnings)
  });
  audit(db2, { userId: user.id, action: "master.use", entity: "master", entityId: master.id, meta: { templateId: template?.id } });
  return template;
}
function queueConversion(db2, user, uploadId, mode) {
  const jobId = insertJob(db2, user.id);
  setTimeout(() => {
    convertUpload(db2, user, uploadId, mode).then((template) => finishJob(db2, jobId, { templateId: template?.id })).catch((error) => {
      const message = error instanceof AppError ? error.message : "The conversion failed.";
      failJob(db2, jobId, message);
    });
  }, 20);
  return jobId;
}
async function renderResolved(definition, variables, values, strict) {
  const resolved = resolveDocument(definition, variables, values, { strict });
  if (resolved.errors.length) return { buffer: Buffer.alloc(0), errors: resolved.errors, warnings: resolved.warnings };
  try {
    const buffer = await renderPdf(resolved.definition);
    return { buffer, errors: [], warnings: resolved.warnings };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    if (/font/i.test(detail)) {
      throw new AppError(422, "FONT", "A font in the document could not be used. Generated PDFs use Roboto.");
    }
    if (/image/i.test(detail)) {
      throw new AppError(422, "IMAGE", "An image in the document could not be embedded. Use a PNG or JPEG under 2 MB.");
    }
    throw new AppError(422, "PDF_RENDER", "The PDF could not be generated. Check tables, margins, and required fields.");
  }
}
async function generateStored(db2, user, input) {
  const rendered = await renderResolved(input.definition, input.variables, input.values, true);
  if (rendered.errors.length) {
    throw new AppError(422, "VALIDATION", "Fill the required fields before generating the PDF.", rendered.errors);
  }
  const fileName = buildPdfFilename(input.templateName, primaryFilenameValue(input.variables, input.values));
  let id = null;
  if (input.save) {
    const filePath = writeGenerated(rendered.buffer);
    id = insertGenerated(db2, {
      templateId: input.templateId ?? null,
      templateName: input.templateName,
      documentName: fileName.replace(/\.pdf$/i, "").replace(/_/g, " "),
      fileName,
      values: JSON.stringify(input.values),
      filePath,
      userId: user.id
    });
    audit(db2, { userId: user.id, action: "document.generate", entity: "generated_document", entityId: id, meta: { templateId: input.templateId } });
  }
  return { id, fileName, buffer: rendered.buffer, warnings: rendered.warnings };
}
async function suggestVariables(definition, mode) {
  if (mode !== "ai") return { ...extractVariables(definition), warnings: [] };
  const text = JSON.stringify(definition.content);
  const candidates = await detectVariablesWithAi(definition, text);
  const applied = applyAiCandidates(definition, candidates);
  if (!applied.variables.length) {
    const heuristic = extractVariables(definition);
    return {
      ...heuristic,
      warnings: ["AI did not return variables that appear in the document. Heuristic detection was kept."]
    };
  }
  return { ...applied, warnings: [] };
}
function storeUpload(buffer, extension) {
  return writeUpload(buffer, extension);
}

// server/app.ts
import bcrypt2 from "bcryptjs";
var COOKIE = "ds_session";
var buckets = /* @__PURE__ */ new Map();
function rateLimit(name, limit, windowMs) {
  return (req, res, next) => {
    const key = `${name}:${req.user?.id || req.ip || "unknown"}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.reset < now) {
      buckets.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      return res.status(429).json({
        error: { code: "RATE_LIMITED", message: "Too many requests. Wait a moment and try again." }
      });
    }
    next();
  };
}
function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}
function requireUser(req) {
  if (!req.user) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return req.user;
}
function requireRole(user, roles) {
  if (!roles.includes(user.role)) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to do that.");
  }
}
function sendError(res, error) {
  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details ?? void 0 }
    });
  }
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: { code: "FILE_TOO_LARGE", message: "Files must be 20 MB or smaller." } });
  }
  const message = error instanceof Error ? error.message : "unknown";
  console.error(JSON.stringify({ level: "error", message }));
  return res.status(500).json({
    error: { code: "INTERNAL", message: "Something went wrong while processing the document. Try again." }
  });
}
function presentList(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    sourceType: row.sourceType,
    status: row.status,
    version: row.version,
    createdBy: row.createdByName ?? "Unknown",
    updatedBy: row.updatedByName ?? "Unknown",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasOriginal: Boolean(row.originalFilePath)
  };
}
function presentTemplate(row, db2) {
  const schema = JSON.parse(row.variableSchema);
  return {
    ...presentList(row),
    originalFileName: row.originalFileName,
    documentDefinition: JSON.parse(row.documentDefinition),
    variables: schema.variables ?? [],
    warnings: JSON.parse(row.warnings),
    presets: listPresets(db2, row.id).map((preset) => ({
      id: preset.id,
      name: preset.name,
      values: JSON.parse(preset.variableValues),
      createdAt: preset.createdAt
    }))
  };
}
function readDefinition(body) {
  const prepared = prepareDefinition(body.documentDefinition);
  if (prepared.errors.length) {
    throw new AppError(422, "PDFMAKE_INVALID", "The document definition is not valid.", prepared.errors);
  }
  return prepared.definition;
}
function readVariables(body) {
  const normalized = normalizeVariableList(body.variables ?? body.variableSchema ?? []);
  if (normalized.errors.length) {
    throw new AppError(422, "VARIABLES_INVALID", normalized.errors[0] || "The variable schema is not valid.", normalized.errors);
  }
  return normalized.variables;
}
function createApp(db2) {
  const app2 = express();
  app2.set("trust proxy", 1);
  app2.disable("x-powered-by");
  app2.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });
  const origins = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173").split(",").map((item) => item.trim());
  app2.use(cors({ origin: origins, credentials: true }));
  app2.use(express.json({ limit: "12mb" }));
  app2.use(cookieParser());
  app2.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    const origin = req.headers.origin;
    if (!origin) return next();
    const host2 = `${req.protocol}://${req.get("host")}`;
    const cleanOrigin = origin.replace(/^https?:\/\//, "");
    const cleanHost = (req.get("host") || "").replace(/^https?:\/\//, "");
    if (origin === host2 || cleanOrigin === cleanHost || origins.includes(origin)) return next();
    return res.status(403).json({ error: { code: "ORIGIN", message: "This request was blocked." } });
  });
  app2.use((req, _res, next) => {
    const token = req.cookies?.[COOKIE];
    req.user = userForToken(db2, token) ?? void 0;
    next();
  });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  app2.get(["/healthz", "/api/health"], (_req, res) => {
    res.json({ ok: true });
  });
  app2.post(
    "/api/auth/login",
    rateLimit("login", 10, 10 * 60 * 1e3),
    asyncRoute(async (req, res) => {
      const email2 = String(req.body?.email || "");
      const password2 = String(req.body?.password || "");
      const user = findUserByEmail(db2, email2);
      if (!user || !bcrypt2.compareSync(password2, user.passwordHash)) {
        throw new AppError(401, "INVALID_LOGIN", "The email or password is incorrect.");
      }
      const token = createSession(db2, user.id);
      audit(db2, { userId: user.id, action: "auth.login", entity: "user", entityId: user.id });
      res.cookie(COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE === "true",
        path: "/",
        maxAge: 7 * 864e5
      });
      res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    })
  );
  app2.post("/api/auth/logout", (req, res) => {
    deleteSession(db2, req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, { path: "/" });
    res.json({ ok: true });
  });
  app2.get("/api/auth/me", (req, res) => {
    if (!req.user) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
    res.json({ user: req.user });
  });
  const studio = express.Router();
  studio.use((req, _res, next) => {
    if (!req.user) return next(new AppError(401, "UNAUTHENTICATED", "Sign in to continue."));
    next();
  });
  studio.get("/status", (req, res) => {
    const ai = aiStatus();
    res.json({
      ai,
      limits: { maxUploadBytes: MAX_UPLOAD_BYTES, maxPdfPages: 50 },
      categories: CATEGORIES,
      user: req.user
    });
  });
  studio.get("/stats", (_req, res) => {
    res.json(templateStats(db2));
  });
  studio.get("/templates", (req, res) => {
    const result = listTemplates(db2, {
      q: String(req.query.q || ""),
      status: String(req.query.status || ""),
      category: String(req.query.category || ""),
      source: String(req.query.source || ""),
      sort: String(req.query.sort || "updated_at"),
      dir: String(req.query.dir || "desc"),
      page: Number(req.query.page || 1),
      pageSize: Number(req.query.pageSize || 10)
    });
    res.json({ ...result, items: result.items.map(presentList) });
  });
  studio.post(
    "/templates",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const name = String(req.body?.name || "Untitled document");
      const definition = req.body?.documentDefinition ? readDefinition(req.body) : prepareDefinition(blankDefinition(name)).definition;
      const variables = req.body?.variables ? readVariables(req.body) : [];
      const template = createDraft(db2, user, {
        name,
        category: String(req.body?.category || "Custom Documents"),
        sourceType: "blank",
        definition,
        variables,
        warnings: []
      });
      if (!template) throw new AppError(500, "INTERNAL", "The template could not be created.");
      res.status(201).json({ template: presentTemplate(template, db2) });
    })
  );
  studio.get(
    "/templates/:id",
    asyncRoute(async (req, res) => {
      const template = getTemplate(db2, req.params.id);
      if (!template) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
      res.json({ template: presentTemplate(template, db2) });
    })
  );
  studio.put(
    "/templates/:id",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const current = getTemplate(db2, req.params.id);
      if (!current) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
      const definition = req.body?.documentDefinition ? readDefinition(req.body) : JSON.parse(current.documentDefinition);
      const variables = req.body?.variables ? readVariables(req.body) : JSON.parse(current.variableSchema).variables;
      const status = ["draft", "active", "archived"].includes(req.body?.status) ? req.body.status : current.status;
      const category = CATEGORIES.includes(req.body?.category) ? req.body.category : current.category;
      const updated = updateTemplate(db2, current.id, {
        name: String(req.body?.name || current.name).slice(0, 160),
        description: String(req.body?.description ?? current.description).slice(0, 500),
        category,
        status,
        documentDefinition: JSON.stringify(definition),
        variableSchema: JSON.stringify({ variables }),
        warnings: JSON.stringify(Array.isArray(req.body?.warnings) ? req.body.warnings.slice(0, 20) : JSON.parse(current.warnings)),
        updatedBy: user.id
      });
      audit(db2, { userId: user.id, action: "template.update", entity: "template", entityId: current.id });
      res.json({ template: presentTemplate(updated, db2) });
    })
  );
  studio.delete(
    "/templates/:id",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin"]);
      const current = getTemplate(db2, req.params.id);
      if (!current) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
      deleteTemplate(db2, current.id);
      audit(db2, { userId: user.id, action: "template.delete", entity: "template", entityId: current.id, meta: { name: current.name } });
      res.json({ ok: true });
    })
  );
  studio.get("/templates/:id/versions", (req, res) => {
    if (!getTemplate(db2, req.params.id)) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
    res.json({ versions: listVersions(db2, req.params.id) });
  });
  studio.post(
    "/templates/:id/duplicate",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const current = getTemplate(db2, req.params.id);
      if (!current) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
      const copy = createDraft(db2, user, {
        name: `Copy of ${current.name}`.slice(0, 160),
        category: current.category,
        sourceType: current.sourceType,
        definition: JSON.parse(current.documentDefinition),
        variables: JSON.parse(current.variableSchema).variables,
        warnings: JSON.parse(current.warnings),
        originalPath: current.originalFilePath,
        originalName: current.originalFileName
      });
      res.status(201).json({ template: presentTemplate(copy, db2) });
    })
  );
  studio.post(
    "/templates/:id/restore",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const current = getTemplate(db2, req.params.id);
      if (!current) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
      const version = getVersion(db2, current.id, Number(req.body?.versionNumber));
      if (!version) throw new AppError(404, "NOT_FOUND", "That version does not exist.");
      const updated = updateTemplate(db2, current.id, {
        documentDefinition: version.document_definition,
        variableSchema: version.variable_schema,
        updatedBy: user.id
      });
      audit(db2, {
        userId: user.id,
        action: "template.restore",
        entity: "template",
        entityId: current.id,
        meta: { version: version.version_number }
      });
      res.json({ template: presentTemplate(updated, db2) });
    })
  );
  studio.get(
    "/templates/:id/original",
    asyncRoute(async (req, res) => {
      const template = getTemplate(db2, req.params.id);
      if (!template?.originalFilePath) throw new AppError(404, "NOT_FOUND", "This template has no original file.");
      const resolved = path4.resolve(template.originalFilePath);
      if (!resolved.startsWith(dataRoot())) throw new AppError(404, "NOT_FOUND", "This template has no original file.");
      const type = template.originalFileName?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/json";
      res.setHeader("Content-Type", type);
      res.setHeader("Content-Disposition", `inline; filename="${(template.originalFileName || "original").replace(/"/g, "")}"`);
      res.sendFile(resolved);
    })
  );
  studio.post(
    "/templates/:id/presets",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor", "viewer"]);
      const template = getTemplate(db2, req.params.id);
      if (!template) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
      const name = String(req.body?.name || "Preset").slice(0, 80);
      const id = insertPreset(db2, { templateId: template.id, name, values: JSON.stringify(req.body?.values ?? {}), userId: user.id });
      res.status(201).json({ id, name });
    })
  );
  studio.delete(
    "/templates/:id/presets/:presetId",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      deletePreset(db2, req.params.id, req.params.presetId);
      res.json({ ok: true });
    })
  );
  function presentMaster(row, detail = false) {
    const variables = JSON.parse(row.variableSchema).variables;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      variableCount: variables.length,
      warnings: JSON.parse(row.warnings),
      createdBy: row.createdByName ?? "Unknown",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...detail ? {
        documentDefinition: JSON.parse(row.documentDefinition),
        variables
      } : {}
    };
  }
  studio.get("/masters", (_req, res) => {
    res.json({ items: listMasters(db2).map((row) => presentMaster(row)) });
  });
  studio.get(
    "/masters/:id",
    asyncRoute(async (req, res) => {
      const master = getMaster(db2, req.params.id);
      if (!master) throw new AppError(404, "NOT_FOUND", "That master format no longer exists.");
      res.json({ master: presentMaster(master, true) });
    })
  );
  studio.post(
    "/masters",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const json = typeof req.body?.json === "string" ? req.body.json : JSON.stringify(req.body?.documentDefinition ?? req.body?.json ?? "");
      if (!json || json === '""') throw new AppError(400, "JSON_REQUIRED", "Paste a JSON document definition to save a master.");
      const master = saveMaster(db2, user, {
        name: req.body?.name,
        category: req.body?.category,
        description: req.body?.description,
        json
      });
      if (!master) throw new AppError(500, "INTERNAL", "The master could not be saved.");
      res.status(201).json({ master: presentMaster(master, true) });
    })
  );
  studio.post(
    "/masters/:id/use",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const template = createFromMaster(db2, user, req.params.id);
      if (!template) throw new AppError(500, "INTERNAL", "The document could not be created.");
      res.status(201).json({ template: presentTemplate(template, db2) });
    })
  );
  studio.delete(
    "/masters/:id",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin"]);
      const master = getMaster(db2, req.params.id);
      if (!master) throw new AppError(404, "NOT_FOUND", "That master format no longer exists.");
      deleteMaster(db2, master.id);
      audit(db2, { userId: user.id, action: "master.delete", entity: "master", entityId: master.id, meta: { name: master.name } });
      res.json({ ok: true });
    })
  );
  studio.post(
    "/upload",
    rateLimit("upload", 30, 6e4),
    upload.single("file"),
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const file = req.file;
      if (!file) throw new AppError(400, "FILE_REQUIRED", "Choose a PDF or JSON file to upload.");
      const name = file.originalname || "upload";
      const lower = name.toLowerCase();
      if (lower.endsWith(".pdf") || file.mimetype === "application/pdf") {
        const info = await inspectPdf(file.buffer);
        const stored = storeUpload(file.buffer, ".pdf");
        const id = insertUpload(db2, {
          userId: user.id,
          originalName: name,
          storedPath: stored,
          mime: "application/pdf",
          size: file.size,
          kind: "pdf",
          pageCount: info.pageCount
        });
        audit(db2, { userId: user.id, action: "upload.pdf", entity: "upload", entityId: id });
        return res.status(201).json({ uploadId: id, kind: "pdf", filename: name, size: file.size, pageCount: info.pageCount });
      }
      if (lower.endsWith(".json") || file.mimetype.includes("json") || file.mimetype.startsWith("text/")) {
        const parsed = parseUploadedJson(file.buffer.toString("utf8"));
        if (parsed.classification === "script" || parsed.classification === "invalid") {
          throw new AppError(400, "JSON_INVALID", parsed.errors[0]?.message || "The JSON file is not valid.", parsed.errors);
        }
        const stored = storeUpload(file.buffer, ".json");
        const id = insertUpload(db2, {
          userId: user.id,
          originalName: name,
          storedPath: stored,
          mime: "application/json",
          size: file.size,
          kind: "json",
          pageCount: null
        });
        audit(db2, { userId: user.id, action: "upload.json", entity: "upload", entityId: id, meta: { classification: parsed.classification } });
        return res.status(201).json({
          uploadId: id,
          kind: "json",
          filename: name,
          size: file.size,
          classification: parsed.classification,
          errors: parsed.errors
        });
      }
      throw new AppError(400, "FILE_TYPE", "Upload a PDF or a JSON file.");
    })
  );
  studio.post(
    "/convert",
    rateLimit("convert", 20, 6e4),
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const uploadId = String(req.body?.uploadId || "");
      const mode = String(req.body?.mode || "standard");
      const upload2 = getUpload(db2, uploadId, user.id);
      if (!upload2) throw new AppError(404, "NOT_FOUND", "That upload could not be found. Please upload the file again.");
      const large = (upload2.page_count ?? 0) > 15 || upload2.size_bytes > 8 * 1024 * 1024;
      if (large) {
        const jobId = queueConversion(db2, user, uploadId, mode);
        return res.status(202).json({ mode: "queued", jobId });
      }
      const template = await convertUpload(db2, user, uploadId, mode);
      if (!template) throw new AppError(500, "INTERNAL", "The document could not be created.");
      res.json({ mode: "inline", template: presentTemplate(template, db2) });
    })
  );
  studio.get("/jobs/:id", (req, res) => {
    const user = requireUser(req);
    const job = getJob(db2, req.params.id, user.id);
    if (!job) throw new AppError(404, "NOT_FOUND", "That conversion job was not found.");
    res.json({
      id: job.id,
      status: job.status,
      error: job.error,
      templateId: job.result ? JSON.parse(job.result).templateId : void 0
    });
  });
  studio.post(
    "/validate",
    asyncRoute(async (req, res) => {
      requireUser(req);
      const source = typeof req.body?.json === "string" ? req.body.json : JSON.stringify(req.body?.document ?? req.body ?? {});
      const parsed = parseUploadedJson(source);
      if (parsed.classification === "invalid" || parsed.classification === "script") {
        return res.json({ classification: parsed.classification, valid: false, errors: parsed.errors });
      }
      if (parsed.classification === "generic") {
        return res.json({
          classification: "generic",
          valid: true,
          errors: [],
          message: "This JSON is valid, but it is not a PDFMake document definition."
        });
      }
      const prepared = prepareDefinition(parsed.definition);
      res.json({
        classification: parsed.classification,
        valid: prepared.errors.length === 0,
        errors: prepared.errors,
        warnings: prepared.warnings
      });
    })
  );
  studio.post(
    "/extract-variables",
    rateLimit("ai", 10, 6e4),
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const definition = readDefinition(req.body);
      const result = await suggestVariables(definition, String(req.body?.mode || "heuristic"));
      res.json(result);
    })
  );
  studio.post(
    "/preview",
    rateLimit("preview", 40, 6e4),
    asyncRoute(async (req, res) => {
      requireUser(req);
      const definition = readDefinition(req.body);
      const variables = readVariables(req.body);
      const rendered = await renderResolved(definition, variables, req.body?.values ?? {}, false);
      if (rendered.errors.length && rendered.buffer.length === 0) {
        throw new AppError(422, "PDF_RENDER", "The preview could not be rendered.", rendered.errors);
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("X-Document-Warnings", encodeURIComponent(rendered.warnings.join(" | ")));
      res.send(rendered.buffer);
    })
  );
  studio.post(
    "/generate",
    rateLimit("generate", 20, 6e4),
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      const definition = readDefinition(req.body);
      const variables = readVariables(req.body);
      const generated = await generateStored(db2, user, {
        templateId: req.body?.templateId ?? null,
        templateName: String(req.body?.templateName || "Document"),
        definition,
        variables,
        values: req.body?.values ?? {},
        save: req.body?.save !== false
      });
      if (req.body?.download === true || req.query.download === "1") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${generated.fileName}"`);
        return res.send(generated.buffer);
      }
      res.json({ id: generated.id, fileName: generated.fileName, warnings: generated.warnings });
    })
  );
  studio.get("/generated", (req, res) => {
    requireUser(req);
    res.json(listGenerated(db2, Number(req.query.page || 1), Number(req.query.pageSize || 10)));
  });
  studio.get(
    "/generated/:id/file",
    asyncRoute(async (req, res) => {
      requireUser(req);
      const row = getGenerated(db2, req.params.id);
      if (!row) throw new AppError(404, "NOT_FOUND", "That generated document was not found.");
      const resolved = path4.resolve(row.generated_file_path);
      if (!resolved.startsWith(dataRoot())) throw new AppError(404, "NOT_FOUND", "That generated document was not found.");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${row.file_name.replace(/"/g, "")}"`);
      res.sendFile(resolved);
    })
  );
  studio.post(
    "/variables/manual",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const definition = readDefinition(req.body);
      const variables = readVariables(req.body);
      const action = String(req.body?.action || "add");
      if (action === "add") {
        const result = addVariable(definition, variables, req.body.input);
        if (result.error) throw new AppError(422, "VARIABLE", result.error);
        return res.json(result);
      }
      if (action === "delete") return res.json(deleteVariable(definition, variables, String(req.body.id)));
      if (action === "rename") {
        const result = renameVariable(definition, variables, String(req.body.id), String(req.body.label || ""));
        if (result.error) throw new AppError(422, "VARIABLE", result.error);
        return res.json(result);
      }
      if (action === "update") return res.json({ variables: updateVariable(variables, String(req.body.id), req.body.patch ?? {}) });
      if (action === "move") return res.json({ variables: moveVariable(variables, String(req.body.id), req.body.direction === -1 ? -1 : 1) });
      if (action === "link") return res.json(linkOccurrences(definition, variables, String(req.body.id)));
      throw new AppError(400, "ACTION", "Unknown variable action.");
    })
  );
  studio.get("/bundle/:id", (req, res) => {
    const template = getTemplate(db2, req.params.id);
    if (!template) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
    const definition = JSON.parse(template.documentDefinition);
    const variables = JSON.parse(template.variableSchema).variables;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${template.name.replace(/[^\w.-]+/g, "_")}.json"`);
    res.send(JSON.stringify(bundleFrom(definition, variables), null, 2));
  });
  app2.use("/api/document-studio", studio);
  app2.use((error, _req, res, _next) => {
    sendError(res, error);
  });
  return app2;
}

// server/seeds/masters.ts
import fs4 from "node:fs";
import path5 from "node:path";

// server/masters-data.ts
var MASTERS = [
  // =========================================================================
  // DEMAND 1: Pioneer Housing - Senroofs
  // =========================================================================
  {
    id: "master-demand-1",
    name: "Demand Letter 1 - Pioneer Housing (Senroofs)",
    category: "Demand Letters",
    description: "Payment intimation for installment due on flat cost and GST with detailed banking accounts for Pioneer Housing Senroofs Phase III.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        companyTitle: { fontSize: 16, bold: true, color: "#0f172a" },
        subHeader: { fontSize: 9, color: "#475569" },
        subject: { fontSize: 10, bold: true, color: "#0f172a", margin: [0, 8, 0, 8] },
        tableHeader: { bold: true, fontSize: 9, fillColor: "#f1f5f9", alignment: "center" },
        tableCell: { fontSize: 9 },
        tableCellBold: { fontSize: 9, bold: true },
        bankHeader: { fontSize: 9, bold: true, color: "#0f172a" },
        bankText: { fontSize: 8.5, color: "#334155" },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" }
      },
      content: [
        {
          columns: [
            {
              stack: [
                { text: "PIONEER HOUSING", style: "companyTitle" },
                { text: "Senroofs Project, Nahur / Mulund West, Mumbai", style: "subHeader" }
              ]
            },
            {
              text: "Date: {{current_date}}",
              alignment: "right",
              bold: true,
              margin: [0, 4, 0, 0]
            }
          ],
          margin: [0, 0, 0, 16]
        },
        {
          stack: [
            { text: "To,", bold: true },
            { text: "{{customer_name}}", bold: true },
            { text: "{{customer_address}}", color: "#334155" },
            { text: "Email :- {{customer_email}}", color: "#334155" },
            { text: "Mob :- {{customer_phone}}", color: "#334155" },
            { text: "Slab Completion :- {{slab_completion_date}}", bold: true, margin: [0, 4, 0, 0] }
          ],
          margin: [0, 0, 0, 12]
        },
        {
          text: "Subject :- Intimation for payment of {{installment_name}} against your Booking of Flat No. {{unit_name}} on {{unit_floor}} floor, of Tower \u201C{{wing}}\u201D in Senroofs Project, {{project_address}}",
          style: "subject"
        },
        {
          text: "Dear Madam/ Sir, ,",
          margin: [0, 0, 0, 6]
        },
        {
          text: "Pursuant to Allotment / Agreement in respect of above referred flat, we have to inform you that a payment of \u20B9{{final_amount}} ({{final_amount_in_words}}) is due and payable separately as below.",
          margin: [0, 0, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", 120, 100],
            body: [
              [
                { text: "INSTALLMENT DUE", style: "tableHeader", alignment: "left" },
                { text: "ON FLAT COST", style: "tableHeader", alignment: "right" },
                { text: "GST", style: "tableHeader", alignment: "right" }
              ],
              [
                { text: "Previous Demand Value", style: "tableCell" },
                { text: "\u20B9{{previous_slabs_amount}}", style: "tableCell", alignment: "right" },
                { text: "\u20B9{{previous_slabs_gst_amount}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "{{installment_name}}", style: "tableCell" },
                { text: "\u20B9{{latest_slab_amount}}", style: "tableCell", alignment: "right" },
                { text: "\u20B9{{latest_slab_gst_amount}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "Total Amount Due {{total_percentage}}%", style: "tableCellBold" },
                { text: "\u20B9{{pending_amount_as_per_work}}", style: "tableCellBold", alignment: "right" },
                { text: "\u20B9{{pending_tax_as_per_work}}", style: "tableCellBold", alignment: "right" }
              ],
              [
                { text: "Less Amount Received \u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026.", style: "tableCell" },
                { text: "\u20B9{{amount_paid}}", style: "tableCell", alignment: "right" },
                { text: "\u20B9{{tax_paid}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "AMOUNT DUE \u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026.", style: "tableCellBold", fillColor: "#f8fafc" },
                { text: "\u20B9{{total_due_amount}}", style: "tableCellBold", alignment: "right", fillColor: "#f8fafc" },
                { text: "\u20B9{{total_tax_amount}}", style: "tableCellBold", alignment: "right", fillColor: "#f8fafc" }
              ]
            ]
          },
          layout: "lightHorizontalLines",
          margin: [0, 4, 0, 12]
        },
        {
          text: "You are requested to kindly make the above payment as soon as possible from the receipt of this letter otherwise interest will be charged on delay payment. Please find the banking details below.",
          margin: [0, 0, 0, 10],
          fontSize: 9.5
        },
        {
          stack: [
            {
              text: "FLAT COST BANKING DETAILS",
              style: "bankHeader"
            },
            {
              text: "\u201CPIONEER HOUSING SENROOFS PHASE III COLLECTION A/ C. , Kotak Mahindra Bank Ltd., Mulund West Branch, Account No. 4946470941 and IFSC CODE KKBK0000642. MIRC Code : 400485006",
              style: "bankText",
              margin: [0, 2, 0, 6]
            },
            {
              text: "GST BANKING DETAILS",
              style: "bankHeader"
            },
            {
              text: "\u201CPIONEER HOUSING\u201D Bank of India A/ C. No. 009020110000971, Small Scale Ind Andheri - East Br., and IFSC CODE BKID0000090. MIRC Code : 400013050.",
              style: "bankText",
              margin: [0, 2, 0, 12]
            }
          ]
        },
        {
          columns: [
            { text: "" },
            {
              stack: [
                { text: "Yours Faithfully,", margin: [0, 0, 0, 4] },
                { text: "For PIONEER HOUSING", bold: true, margin: [0, 0, 0, 36] },
                { text: "AUTHORISED SIGNATORY", style: "signatory" }
              ],
              alignment: "right",
              width: 200
            }
          ]
        }
      ]
    },
    variables: [
      { id: "current_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Vipin Tomar", required: true, group: "Customer Details", order: 1, bindings: [] },
      { id: "customer_address", label: "Customer Address", type: "textarea", defaultValue: "Flat No 402, Building A, Sunrise Heights, Mumbai 400078", required: true, group: "Customer Details", order: 2, bindings: [] },
      { id: "customer_email", label: "Email", type: "email", defaultValue: "vipintomar@gmail.com", required: false, group: "Contact Details", order: 3, bindings: [] },
      { id: "customer_phone", label: "Mobile", type: "phone", defaultValue: "+91 98765 43210", required: false, group: "Contact Details", order: 4, bindings: [] },
      { id: "slab_completion_date", label: "Slab Completion Date", type: "date", defaultValue: "2026-10-25", required: true, group: "Document Details", order: 5, bindings: [] },
      { id: "installment_name", label: "Installment Name", type: "text", defaultValue: "14th Slab", required: true, group: "Document Details", order: 6, bindings: [] },
      { id: "unit_name", label: "Flat No.", type: "text", defaultValue: "1402", required: true, group: "Property Details", order: 7, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "14th", required: true, group: "Property Details", order: 8, bindings: [] },
      { id: "wing", label: "Tower / Wing", type: "text", defaultValue: "A", required: true, group: "Property Details", order: 9, bindings: [] },
      { id: "project_address", label: "Project Address", type: "textarea", defaultValue: "L.B.S. Marg, Mulund West, Mumbai - 400080", required: true, group: "Project Details", order: 10, bindings: [] },
      { id: "final_amount", label: "Total Final Amount", type: "currency", defaultValue: 42e4, required: true, group: "Financial Details", order: 11, bindings: [] },
      { id: "final_amount_in_words", label: "Final Amount in Words", type: "text", defaultValue: "Rupees Four Lakh Twenty Thousand Only", required: false, group: "Financial Details", order: 12, bindings: [] },
      { id: "previous_slabs_amount", label: "Previous Slabs Amount", type: "currency", defaultValue: 35e5, required: false, group: "Financial Details", order: 13, bindings: [] },
      { id: "previous_slabs_gst_amount", label: "Previous Slabs GST Amount", type: "currency", defaultValue: 175e3, required: false, group: "Financial Details", order: 14, bindings: [] },
      { id: "latest_slab_amount", label: "Current Slab Amount", type: "currency", defaultValue: 4e5, required: true, group: "Financial Details", order: 15, bindings: [] },
      { id: "latest_slab_gst_amount", label: "Current Slab GST Amount", type: "currency", defaultValue: 2e4, required: true, group: "Financial Details", order: 16, bindings: [] },
      { id: "total_percentage", label: "Total Work Percentage", type: "percent", defaultValue: 85, required: false, group: "Financial Details", order: 17, bindings: [] },
      { id: "pending_amount_as_per_work", label: "Pending Flat Cost As Per Work", type: "currency", defaultValue: 39e5, required: false, group: "Financial Details", order: 18, bindings: [] },
      { id: "pending_tax_as_per_work", label: "Pending Tax As Per Work", type: "currency", defaultValue: 195e3, required: false, group: "Financial Details", order: 19, bindings: [] },
      { id: "amount_paid", label: "Amount Paid Till Date", type: "currency", defaultValue: 35e5, required: false, group: "Financial Details", order: 20, bindings: [] },
      { id: "tax_paid", label: "Tax Paid Till Date", type: "currency", defaultValue: 175e3, required: false, group: "Financial Details", order: 21, bindings: [] },
      { id: "total_due_amount", label: "Total Flat Cost Due", type: "currency", defaultValue: 4e5, required: true, group: "Financial Details", order: 22, bindings: [] },
      { id: "total_tax_amount", label: "Total Tax Due", type: "currency", defaultValue: 2e4, required: true, group: "Financial Details", order: 23, bindings: [] }
    ]
  },
  // =========================================================================
  // DEMAND 2: Dimple Realtors - WestWood
  // =========================================================================
  {
    id: "master-demand-2",
    name: "Demand Letter 2 - Dimple Realtors (WestWood)",
    category: "Demand Letters",
    description: "Agreement for sale payment demand letter with TDS 1% deduction breakup, architect certificate reference, and dual SBI bank accounts.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        headerTitle: { fontSize: 15, bold: true, alignment: "center", color: "#0f172a", margin: [0, 8, 0, 8] },
        tableHeader: { bold: true, fontSize: 9.5, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9.5 },
        boldCell: { fontSize: 9.5, bold: true },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" }
      },
      content: [
        {
          columns: [
            { text: "" },
            { text: "Date: {{slab_completion_date}}", alignment: "right", bold: true }
          ],
          margin: [0, 0, 0, 12]
        },
        {
          stack: [
            { text: "To,", bold: true },
            { text: "{{customer_name}}", bold: true },
            { text: "{{customer_address}}", color: "#334155" }
          ],
          margin: [0, 0, 0, 10]
        },
        {
          text: "Ref: Agreement for sale of Flat No. {{unit_name}} on the {{unit_floor}} Floor, Wing {{wing}} in the building known as {{project_name}}, situated on all that piece and parcel of lands bearing {{project_address}}",
          margin: [0, 0, 0, 8]
        },
        {
          text: "Sub: Demand Letter for Payment",
          style: "headerTitle"
        },
        {
          text: "Dear Sir/ Madam,",
          margin: [0, 0, 0, 6]
        },
        {
          text: "This is to inform you that {{installment_name}} Work is commenced on site for Sale Building known as {{project_name}} and certificate for Architect is enclosed herewith for your reference. As per the clause 4 of the Agreement for sale, the payment due till commencement of the above work is \u20B9{{pending_amount_as_per_work}}/- out of which we have received \u20B9{{amount_paid}}/-. So the balance amount of \u20B9{{total_due_amount}}/- and GST of \u20B9{{total_tax_amount}}/- is due.",
          margin: [0, 0, 0, 10]
        },
        {
          text: "Breakup of payment",
          bold: true,
          margin: [0, 0, 0, 4]
        },
        {
          table: {
            widths: [200, 140],
            body: [
              [
                { text: "Payment Due", style: "tableCell" },
                { text: "\u20B9{{total_due_amount_with_tds}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "Less: TDS @ 1%", style: "tableCell" },
                { text: "\u20B9{{pending_tds_as_per_work}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "Balance", style: "boldCell", fillColor: "#f8fafc" },
                { text: "\u20B9{{balance_as_per_work}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" }
              ]
            ]
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 8]
        },
        {
          text: "Kindly pay online TDS of \u20B9{{pending_tds_as_per_work}}",
          bold: true,
          color: "#0369a1",
          margin: [0, 0, 0, 8]
        },
        {
          text: "We hereby call upon you to pay the amount of \u20B9{{balance_as_per_work}} and GST \u20B9{{total_tax_amount}}/- which is payable immediately on receipt of this letter. We further inform that under the said Agreement for sale, you shall be liable to pay interest on all amounts due and payable under the said Agreement for sale, if the same remains unpaid for 7 days or more after becoming due.",
          margin: [0, 0, 0, 12]
        },
        {
          columns: [
            {
              stack: [
                { text: "1. Kindly issue all 100 % of Flat Cost by RTGS/ NEFT in favour of \u201CDimple Realtors Pvt Ltd \u2013 WestWood \u2013 Collection Account\u201D, A/ c no. 40794790823 State Bank of India, Backbay Reclamation (Mumbai) Branch, IFSC \u2013 SBIN0001593.", fontSize: 8.5, color: "#334155", margin: [0, 0, 0, 4] },
                { text: "2. Kindly issue all GST Amount by RTGS/ NEFT in favour of \u201CDimple Realtors Pvt Ltd Tax A/ c.\u201D State Bank of India, Borivali (West) Branch, A/ c no \u2013 40107382026, IFSC \u2013 SBIN0006441.", fontSize: 8.5, color: "#334155" }
              ],
              width: "*"
            },
            {
              stack: [
                { text: "Thanking You,", margin: [0, 0, 0, 2] },
                { text: "For Dimple Realtors Pvt. Ltd.,", bold: true, margin: [0, 0, 0, 36] },
                { text: "Authorised Signatory", style: "signatory" }
              ],
              width: 170,
              alignment: "right"
            }
          ]
        }
      ]
    },
    variables: [
      { id: "slab_completion_date", label: "Date / Slab Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Rajesh Sharma", required: true, group: "Customer Details", order: 1, bindings: [] },
      { id: "customer_address", label: "Customer Address", type: "textarea", defaultValue: "B-204, Greenfield Heights, Malad West, Mumbai 400064", required: true, group: "Customer Details", order: 2, bindings: [] },
      { id: "unit_name", label: "Flat No.", type: "text", defaultValue: "804", required: true, group: "Property Details", order: 3, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "8th", required: true, group: "Property Details", order: 4, bindings: [] },
      { id: "wing", label: "Wing", type: "text", defaultValue: "B", required: true, group: "Property Details", order: 5, bindings: [] },
      { id: "project_name", label: "Project Name", type: "text", defaultValue: "WestWood", required: true, group: "Project Details", order: 6, bindings: [] },
      { id: "project_address", label: "Project Address", type: "textarea", defaultValue: "CTS No. 452, Off Link Road, Goregaon West, Mumbai", required: true, group: "Project Details", order: 7, bindings: [] },
      { id: "installment_name", label: "Installment Name / Stage", type: "text", defaultValue: "8th Slab", required: true, group: "Document Details", order: 8, bindings: [] },
      { id: "pending_amount_as_per_work", label: "Payment Due Till Commencement", type: "currency", defaultValue: 52e5, required: true, group: "Financial Details", order: 9, bindings: [] },
      { id: "amount_paid", label: "Amount Received", type: "currency", defaultValue: 45e5, required: true, group: "Financial Details", order: 10, bindings: [] },
      { id: "total_due_amount", label: "Balance Flat Amount Due", type: "currency", defaultValue: 7e5, required: true, group: "Financial Details", order: 11, bindings: [] },
      { id: "total_tax_amount", label: "GST Due Amount", type: "currency", defaultValue: 35e3, required: true, group: "Financial Details", order: 12, bindings: [] },
      { id: "total_due_amount_with_tds", label: "Payment Due Before TDS", type: "currency", defaultValue: 7e5, required: true, group: "Financial Details", order: 13, bindings: [] },
      { id: "pending_tds_as_per_work", label: "TDS @ 1%", type: "currency", defaultValue: 7e3, required: true, group: "Financial Details", order: 14, bindings: [] },
      { id: "balance_as_per_work", label: "Net Balance Due", type: "currency", defaultValue: 693e3, required: true, group: "Financial Details", order: 15, bindings: [] }
    ]
  },
  // =========================================================================
  // DEMAND 3: Gurukrupa Realcon Developers
  // =========================================================================
  {
    id: "master-demand-3",
    name: "Demand Letter 3 - Gurukrupa Realcon Developers",
    category: "Demand Letters",
    description: "2-page formal demand letter with agreement details, demand percentage, flat cost & GST particulars table, and IDBI Bank account particulars.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        companyTitle: { fontSize: 14, bold: true, alignment: "center", color: "#0f172a" },
        letterHeader: { fontSize: 9.5, color: "#334155" },
        tableHeader: { bold: true, fontSize: 9, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9 },
        boldCell: { fontSize: 9, bold: true },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" }
      },
      content: [
        { text: "Gurukrupa Realcon Developers Private Limited", style: "companyTitle" },
        {
          canvas: [{ type: "line", x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 1, lineColor: "#cbd5e1" }],
          margin: [0, 4, 0, 12]
        },
        {
          columns: [
            {
              stack: [
                { text: "Letter No -: {{project_name}} / {{wing}} {{unit_name}} / Demand", bold: true },
                { text: "Payee -: {{customer_name}}", bold: true },
                { text: "Address -: {{customer_address}}", color: "#334155" },
                { text: "Project & Wing Unit No -: {{project_name}} / {{wing}} {{unit_name}}" },
                { text: "Project Address-: {{project_address}}", color: "#334155" }
              ],
              width: "*"
            },
            {
              text: "Date: {{slab_completion_date}}",
              alignment: "right",
              bold: true,
              width: 140
            }
          ],
          margin: [0, 0, 0, 12]
        },
        {
          text: "Dear Sir/ Madam\nHope you are doing well and keeping safe.",
          margin: [0, 0, 0, 6]
        },
        {
          text: "We would just like to inform you that we have successfully completed {{installment_name}} and as per our agreed terms and conditions under the payment schedule mentioned Below.",
          margin: [0, 0, 0, 8]
        },
        {
          columns: [
            {
              stack: [
                { text: "Agreement Execution Date -: {{effective_date}}" },
                { text: "Agreement Registration Date -: {{agreement_date}}" }
              ]
            },
            {
              stack: [
                { text: "Agreement Value -: \u20B9{{agreement_amount}}", bold: true },
                { text: "Demand Percentage -: {{total_percentage}} %", bold: true }
              ]
            }
          ],
          margin: [0, 0, 0, 10]
        },
        {
          text: "We request you to complete the payment as early as possible. Hereby attaching the \u201CArchitect Certificate\u201D with this letter for your reference.",
          margin: [0, 0, 0, 8]
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", 120, 110],
            body: [
              [
                { text: "Particulars", style: "tableHeader" },
                { text: "Flat Cost", style: "tableHeader", alignment: "right" },
                { text: "GST 5%", style: "tableHeader", alignment: "right" }
              ],
              [
                { text: "Agreement Value (AV)", style: "tableCell" },
                { text: "\u20B9{{agreement_amount}}", style: "tableCell", alignment: "right" },
                { text: "\u20B9{{total_gst}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "Amount Bill till date ({{total_percentage}} %) of AV", style: "tableCellBold" },
                { text: "\u20B9{{pending_amount_as_per_work}}", style: "tableCellBold", alignment: "right" },
                { text: "\u20B9{{pending_tax_as_per_work}}", style: "tableCellBold", alignment: "right" }
              ],
              [
                { text: "Amount Received till date", style: "tableCell" },
                { text: "\u20B9{{amount_paid}}", style: "tableCell", alignment: "right" },
                { text: "\u20B9{{tax_paid}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "Total Amount Payable", style: "boldCell", fillColor: "#f8fafc" },
                { text: "\u20B9{{total_due_amount}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" },
                { text: "\u20B9{{total_tax_amount}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" }
              ]
            ]
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 8]
        },
        {
          text: "Note: Delay in the payment shall levy interest on your due payment as agreed in the Agreement.",
          fontSize: 8.5,
          italics: true,
          color: "#64748b",
          margin: [0, 0, 0, 16],
          pageBreak: "after"
        },
        // PAGE 2
        {
          text: "Please Issue the Amount in Cheque or RTGS as mentioned below-:",
          bold: true,
          margin: [0, 0, 0, 8]
        },
        {
          table: {
            headerRows: 1,
            widths: [80, 120, 110, 110, 80],
            body: [
              [
                { text: "Payment Term", style: "tableHeader" },
                { text: "Company Name", style: "tableHeader" },
                { text: "Bank Name & Branch", style: "tableHeader" },
                { text: "Account No", style: "tableHeader" },
                { text: "IFSC Code", style: "tableHeader" }
              ],
              [
                { text: "FLAT COST Payment", style: "tableCellBold" },
                { text: "Gurukrupa Realcon Developers Private Limited", style: "tableCell" },
                { text: "IDBI Bank\nGhatkopar East", style: "tableCell" },
                { text: "0033102000028848", style: "tableCellBold" },
                { text: "IBKL0000033", style: "tableCell" }
              ],
              [
                { text: "GST Payment", style: "tableCellBold" },
                { text: "Gurukrupa Realcon Developers Private Limited", style: "tableCell" },
                { text: "IDBI Bank\nGhatkopar East", style: "tableCell" },
                { text: "0033102000028820", style: "tableCellBold" },
                { text: "IBKL0000033", style: "tableCell" }
              ]
            ]
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 16]
        },
        {
          text: "If you have any query kindly contact our \u201C Customer Service Manager Mr. Devendra Naik Mobile 7208119728\u201D If you do not provide payment within 7 days after receiving this email/ the letter we shall again send you a reminder letter via email/ RPAD or Courier after that our customer care executive reminds you on call also. Your Cooperation and promptness in making a said payment will enable us to hand over the possession of the said flat on time. Please ignore this letter if already paid.",
          fontSize: 9,
          color: "#475569",
          margin: [0, 0, 0, 24]
        },
        {
          stack: [
            { text: "Yours Faithfully,", margin: [0, 0, 0, 2] },
            { text: "For Gurukrupa Realcon Developers Private Limited", bold: true, margin: [0, 0, 0, 40] },
            { text: "This is auto generated demand it doesn't require signature", italics: true, color: "#64748b", fontSize: 9 }
          ]
        }
      ]
    },
    variables: [
      { id: "slab_completion_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "project_name", label: "Project Name", type: "text", defaultValue: "Marina Enclave", required: true, group: "Project Details", order: 1, bindings: [] },
      { id: "wing", label: "Wing", type: "text", defaultValue: "Wing C", required: true, group: "Property Details", order: 2, bindings: [] },
      { id: "unit_name", label: "Unit No", type: "text", defaultValue: "1103", required: true, group: "Property Details", order: 3, bindings: [] },
      { id: "customer_name", label: "Payee Name", type: "text", defaultValue: "Pooja Mehta", required: true, group: "Customer Details", order: 4, bindings: [] },
      { id: "customer_address", label: "Address", type: "textarea", defaultValue: "Flat 502, Palm Beach Residency, Vashi, Navi Mumbai", required: true, group: "Customer Details", order: 5, bindings: [] },
      { id: "project_address", label: "Project Address", type: "textarea", defaultValue: "Jankalyan Nagar, Malad West, Mumbai 400095", required: true, group: "Project Details", order: 6, bindings: [] },
      { id: "installment_name", label: "Completed Stage", type: "text", defaultValue: "11th Slab RCC Work", required: true, group: "Document Details", order: 7, bindings: [] },
      { id: "effective_date", label: "Agreement Execution Date", type: "date", defaultValue: "2025-08-15", required: false, group: "Document Details", order: 8, bindings: [] },
      { id: "agreement_date", label: "Agreement Registration Date", type: "date", defaultValue: "2025-08-28", required: false, group: "Document Details", order: 9, bindings: [] },
      { id: "agreement_amount", label: "Agreement Value (AV)", type: "currency", defaultValue: 85e5, required: true, group: "Financial Details", order: 10, bindings: [] },
      { id: "total_percentage", label: "Demand Percentage", type: "percent", defaultValue: 70, required: true, group: "Financial Details", order: 11, bindings: [] },
      { id: "total_gst", label: "Total GST (5%) on AV", type: "currency", defaultValue: 425e3, required: false, group: "Financial Details", order: 12, bindings: [] },
      { id: "pending_amount_as_per_work", label: "Amount Billed Till Date", type: "currency", defaultValue: 595e4, required: true, group: "Financial Details", order: 13, bindings: [] },
      { id: "pending_tax_as_per_work", label: "GST Billed Till Date", type: "currency", defaultValue: 297500, required: true, group: "Financial Details", order: 14, bindings: [] },
      { id: "amount_paid", label: "Amount Received Till Date", type: "currency", defaultValue: 51e5, required: false, group: "Financial Details", order: 15, bindings: [] },
      { id: "tax_paid", label: "Tax Received Till Date", type: "currency", defaultValue: 255e3, required: false, group: "Financial Details", order: 16, bindings: [] },
      { id: "total_due_amount", label: "Total Flat Cost Payable", type: "currency", defaultValue: 85e4, required: true, group: "Financial Details", order: 17, bindings: [] },
      { id: "total_tax_amount", label: "Total GST Payable", type: "currency", defaultValue: 42500, required: true, group: "Financial Details", order: 18, bindings: [] }
    ]
  },
  // =========================================================================
  // DEMAND 4: Sankalp Builders - Tax Invoice
  // =========================================================================
  {
    id: "master-demand-4",
    name: "Demand Letter 4 - Sankalp Builders (Tax Invoice)",
    category: "Demand Letters",
    description: "Statutory Tax Invoice and Demand Letter with GSTIN, HSN/SAC code 995411, CGST/SGST calculation, and RERA registration.",
    definition: {
      pageSize: "A4",
      pageMargins: [36, 36, 36, 36],
      defaultStyle: { font: "Roboto", fontSize: 9.5, color: "#1e293b", lineHeight: 1.25 },
      styles: {
        companyTitle: { fontSize: 15, bold: true, color: "#0f172a" },
        invoiceTitle: { fontSize: 14, bold: true, alignment: "center", color: "#0f172a" },
        subHeader: { fontSize: 8.5, color: "#475569" },
        tableHeader: { bold: true, fontSize: 8.5, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 8.5 },
        tableCellBold: { fontSize: 8.5, bold: true },
        signatory: { bold: true, fontSize: 9.5, color: "#0f172a" }
      },
      content: [
        {
          columns: [
            {
              stack: [
                { text: "SANKALP BUILDERS", style: "companyTitle" },
                { text: "E-123-124, Behind IOC Petrol Pump, Sahakar Marg, Jaipur 302015", style: "subHeader" },
                { text: "GSTIN: 08ACOFS3617H1ZT | Original For Recipient", style: "subHeader", margin: [0, 2, 0, 0] }
              ],
              width: "*"
            },
            {
              stack: [
                { text: "Tax Invoice", style: "invoiceTitle" },
                { text: "Date: {{current_date}}", alignment: "right", bold: true, margin: [0, 2, 0, 0] },
                { text: "Invoice No: {{project_name}} / {{unit_name}} / Demand", alignment: "right", fontSize: 8.5 }
              ],
              width: 220
            }
          ],
          margin: [0, 0, 0, 8]
        },
        {
          canvas: [{ type: "line", x1: 0, y1: 2, x2: 523, y2: 2, lineWidth: 1, lineColor: "#cbd5e1" }],
          margin: [0, 0, 0, 8]
        },
        {
          columns: [
            {
              stack: [
                { text: "Customer Name : {{customer_name}}", bold: true },
                { text: "Address : {{customer_address}}" },
                { text: "State : Rajasthan  |  State Code : 8" }
              ],
              width: "*"
            },
            {
              stack: [
                { text: "Mobile : {{customer_phone}}" },
                { text: "Email : {{customer_email}}" }
              ],
              width: 200
            }
          ],
          margin: [0, 0, 0, 8]
        },
        {
          text: "DEMAND LETTER",
          alignment: "center",
          bold: true,
          fontSize: 11,
          margin: [0, 0, 0, 4]
        },
        {
          text: "Subject: Demand letter for due amount of Unit No. {{wing}} {{unit_name}} in {{project_name}} at {{project_address}}.",
          bold: true,
          fontSize: 9,
          margin: [0, 0, 0, 2]
        },
        {
          text: "Ref: {{total_percentage}} % amount due | {{installment_name}}",
          fontSize: 8.5,
          color: "#475569",
          margin: [0, 0, 0, 6]
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", 50, 75, 55, 55],
            body: [
              [
                { text: "Description", style: "tableHeader" },
                { text: "HSN/SAC", style: "tableHeader" },
                { text: "Amount (A)", style: "tableHeader", alignment: "right" },
                { text: "CGST (B)", style: "tableHeader", alignment: "right" },
                { text: "SGST (C)", style: "tableHeader", alignment: "right" }
              ],
              [
                { text: "Sale of Residential Unit No {{unit_name}} in the project {{project_name}} (GST calculated on 2/3rd value as per N/N 11/2017 CGST Rate)", style: "tableCell" },
                { text: "995411", style: "tableCell" },
                { text: "\u20B9{{latest_slab_amount}}", style: "tableCell", alignment: "right" },
                { text: "\u20B9{{latest_tax_as_per_work_cgst}}", style: "tableCell", alignment: "right" },
                { text: "\u20B9{{latest_tax_as_per_work_sgst}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "{{latest_slab_percentage}} % amount Due of Sale consideration (i)", style: "tableCell" },
                { text: "", style: "tableCell" },
                { text: "\u20B9{{latest_slab_amount}}", style: "tableCell", alignment: "right" },
                { text: "", style: "tableCell" },
                { text: "", style: "tableCell" }
              ],
              [
                { text: "GST (ii)", style: "tableCell" },
                { text: "", style: "tableCell" },
                { text: "\u20B9{{latest_slab_gst_amount}}", style: "tableCell", alignment: "right" },
                { text: "", style: "tableCell" },
                { text: "", style: "tableCell" }
              ],
              [
                { text: "Total (iii) = (i) + (ii)", style: "tableCellBold" },
                { text: "", style: "tableCell" },
                { text: "\u20B9{{latest_slab_total_amount}}", style: "tableCellBold", alignment: "right" },
                { text: "", style: "tableCell" },
                { text: "", style: "tableCell" }
              ],
              [
                { text: "Add:- Previous Demand Value ({{previous_slabs_percentage}}%) + GST (iv)", style: "tableCell" },
                { text: "", style: "tableCell" },
                { text: "\u20B9{{previous_slabs_total_amount}}", style: "tableCell", alignment: "right" },
                { text: "", style: "tableCell" },
                { text: "", style: "tableCell" }
              ],
              [
                { text: "Total Amount Due {{total_percentage}}% (v)", style: "tableCellBold" },
                { text: "", style: "tableCell" },
                { text: "\u20B9{{total_pending_amount_as_per_work}}", style: "tableCellBold", alignment: "right" },
                { text: "", style: "tableCell" },
                { text: "", style: "tableCell" }
              ],
              [
                { text: "Amount Received Till Date (vi)", style: "tableCell" },
                { text: "", style: "tableCell" },
                { text: "\u20B9{{total_paid}}", style: "tableCell", alignment: "right" },
                { text: "", style: "tableCell" },
                { text: "", style: "tableCell" }
              ],
              [
                { text: "Net Due (vii) = (v - vi)", style: "tableCellBold", fillColor: "#f8fafc" },
                { text: "", style: "tableCell", fillColor: "#f8fafc" },
                { text: "\u20B9{{final_amount}}", style: "tableCellBold", alignment: "right", fillColor: "#f8fafc" },
                { text: "", style: "tableCell", fillColor: "#f8fafc" },
                { text: "", style: "tableCell", fillColor: "#f8fafc" }
              ]
            ]
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 8]
        },
        {
          text: "Therefore, you are requested to make the payment of outstanding dues within 15 days from the date of issuance of this tax invoice to avoid interest charges on delayed payment as per the terms & condition of the firm.",
          fontSize: 8.5,
          margin: [0, 0, 0, 4]
        },
        {
          text: "Note: GST or any other govt. taxes and charges which may be applicable as per Govt. norms, shall be paid by Buyer.",
          fontSize: 8,
          italics: true,
          color: "#475569",
          margin: [0, 0, 0, 6]
        },
        {
          stack: [
            { text: "The Cheque, Demand Draft or RTGS can be made in the following bank account details:.", bold: true, fontSize: 8.5 },
            { text: "Account Name : SANKALP BUILDERS RERA COLLECTION ACCOUNT\nBank Account No. : 777705514422\nBank & Branch : ICICI Bank, Sahakar Marg, Jaipur | IFSC Code : ICIC0006790.", fontSize: 8.5, color: "#334155", margin: [0, 2, 0, 4] },
            { text: "For any further clarification please call us on 7073877746 or mail us on crm@sankalpbuilders.com", fontSize: 8.5, color: "#0284c7" },
            { text: "RERA Registration No. {{project_rera}} | RERA Website : http:// rera.rajasthan.gov.in/", fontSize: 8.5, bold: true, margin: [0, 2, 0, 8] }
          ]
        },
        {
          columns: [
            { text: "" },
            {
              stack: [
                { text: "Thanking you,", margin: [0, 0, 0, 2] },
                { text: "For M/ s Sankalp Builders", bold: true, margin: [0, 0, 0, 28] },
                { text: "(Authorized Signatory)", style: "signatory" }
              ],
              alignment: "right",
              width: 180
            }
          ]
        }
      ]
    },
    variables: [
      { id: "current_date", label: "Invoice Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "project_name", label: "Project Name", type: "text", defaultValue: "The Rise", required: true, group: "Project Details", order: 1, bindings: [] },
      { id: "wing", label: "Tower / Wing", type: "text", defaultValue: "Tower A", required: false, group: "Property Details", order: 2, bindings: [] },
      { id: "unit_name", label: "Unit No.", type: "text", defaultValue: "A-502", required: true, group: "Property Details", order: 3, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Sunil Agarwal", required: true, group: "Customer Details", order: 4, bindings: [] },
      { id: "customer_address", label: "Customer Address", type: "textarea", defaultValue: "Plot 45, Civil Lines, Jaipur 302006", required: true, group: "Customer Details", order: 5, bindings: [] },
      { id: "customer_phone", label: "Mobile", type: "phone", defaultValue: "9829012345", required: false, group: "Contact Details", order: 6, bindings: [] },
      { id: "customer_email", label: "Email", type: "email", defaultValue: "sunil.agarwal@gmail.com", required: false, group: "Contact Details", order: 7, bindings: [] },
      { id: "project_address", label: "Project Address", type: "textarea", defaultValue: "Ajmer Road, Jaipur, Rajasthan", required: true, group: "Project Details", order: 8, bindings: [] },
      { id: "total_percentage", label: "Total Amount Due %", type: "percent", defaultValue: 75, required: false, group: "Financial Details", order: 9, bindings: [] },
      { id: "installment_name", label: "Stage / Milestone", type: "text", defaultValue: "On Completion of 5th Floor Slab", required: true, group: "Document Details", order: 10, bindings: [] },
      { id: "latest_slab_percentage", label: "Current Slab % Due", type: "percent", defaultValue: 10, required: false, group: "Financial Details", order: 11, bindings: [] },
      { id: "latest_slab_amount", label: "Current Slab Consideration", type: "currency", defaultValue: 6e5, required: true, group: "Financial Details", order: 12, bindings: [] },
      { id: "latest_tax_as_per_work_cgst", label: "CGST (B)", type: "currency", defaultValue: 15e3, required: false, group: "Financial Details", order: 13, bindings: [] },
      { id: "latest_tax_as_per_work_sgst", label: "SGST (C)", type: "currency", defaultValue: 15e3, required: false, group: "Financial Details", order: 14, bindings: [] },
      { id: "latest_slab_gst_amount", label: "Current Slab GST Total", type: "currency", defaultValue: 3e4, required: false, group: "Financial Details", order: 15, bindings: [] },
      { id: "latest_slab_total_amount", label: "Total (Consideration + GST)", type: "currency", defaultValue: 63e4, required: false, group: "Financial Details", order: 16, bindings: [] },
      { id: "previous_slabs_percentage", label: "Previous Demanded %", type: "percent", defaultValue: 65, required: false, group: "Financial Details", order: 17, bindings: [] },
      { id: "previous_slabs_total_amount", label: "Previous Demand Value + GST", type: "currency", defaultValue: 4095e3, required: false, group: "Financial Details", order: 18, bindings: [] },
      { id: "total_pending_amount_as_per_work", label: "Total Amount Due (v)", type: "currency", defaultValue: 4725e3, required: false, group: "Financial Details", order: 19, bindings: [] },
      { id: "total_paid", label: "Amount Received Till Date (vi)", type: "currency", defaultValue: 4095e3, required: false, group: "Financial Details", order: 20, bindings: [] },
      { id: "final_amount", label: "Net Due (vii) =(v-vi)", type: "currency", defaultValue: 63e4, required: true, group: "Financial Details", order: 21, bindings: [] },
      { id: "project_rera", label: "RERA Registration No.", type: "text", defaultValue: "RAJ/P/2021/1542", required: false, group: "Project Details", order: 22, bindings: [] }
    ]
  },
  // =========================================================================
  // DEMAND 5: AK Hitech Associates (Sapphire)
  // =========================================================================
  {
    id: "master-demand-5",
    name: "Demand Letter 5 - AK Hitech Associates (Sapphire)",
    category: "Demand Letters",
    description: "Payment intimation for Sapphire project (Kharghar) with TDS 1% deduction and 2 separate Axis Bank accounts for Flat Cost and GST.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        title: { fontSize: 15, bold: true, alignment: "center", color: "#0f172a", margin: [0, 0, 0, 10] },
        tableHeader: { bold: true, fontSize: 9, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9 },
        boldCell: { fontSize: 9, bold: true },
        bankBox: { fontSize: 8.5, color: "#334155" },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" }
      },
      content: [
        { text: "DEMAND LETTER", style: "title" },
        {
          columns: [
            {
              stack: [
                { text: "To,", bold: true },
                { text: "{{customer_name}}", bold: true },
                { text: "{{customer_address}}", color: "#334155" },
                { text: "Email :- {{customer_email}}" },
                { text: "Mob :- {{customer_phone}}" }
              ],
              width: "*"
            },
            {
              text: "Date: {{current_date}}",
              alignment: "right",
              bold: true,
              width: 140
            }
          ],
          margin: [0, 0, 0, 10]
        },
        {
          text: "Subject :- Intimation for payment of {{installment_name}} against your Booking of Flat No. {{unit_name}} on {{unit_floor}} , \u201CSapphire \u201D situated at Plot No.01, Sector-34C, Kharghar, Navi Mumbai.",
          bold: true,
          margin: [0, 0, 0, 8]
        },
        {
          text: "Dear Madam/ Sir, ,\nWe have to inform you that a payment of \u20B9{{amount_without_tds_final}} is due as below.",
          margin: [0, 0, 0, 8]
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", 120, 100],
            body: [
              [
                { text: "INSTALLMENT DUE", style: "tableHeader" },
                { text: "ON FLAT COST", style: "tableHeader", alignment: "right" },
                { text: "GST", style: "tableHeader", alignment: "right" }
              ],
              [
                { text: "Previous Demand Value", style: "tableCell" },
                { text: "\u20B9{{previous_slabs_amount}}", style: "tableCell", alignment: "right" },
                { text: "\u20B9{{previous_slabs_gst_amount}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "{{installment_name}}", style: "tableCell" },
                { text: "\u20B9{{latest_slab_amount}}", style: "tableCell", alignment: "right" },
                { text: "\u20B9{{latest_slab_gst_amount}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "Total Amount Due {{total_percentage}}%", style: "boldCell" },
                { text: "\u20B9{{pending_amount_as_per_work}}", style: "boldCell", alignment: "right" },
                { text: "\u20B9{{pending_tax_as_per_work}}", style: "boldCell", alignment: "right" }
              ],
              [
                { text: "Less Amount Received \u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026.", style: "tableCell" },
                { text: "\u20B9{{amount_paid}}", style: "tableCell", alignment: "right" },
                { text: "\u20B9{{tax_paid}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "AMOUNT DUE \u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026.", style: "boldCell" },
                { text: "\u20B9{{total_due_amount}}", style: "boldCell", alignment: "right" },
                { text: "\u20B9{{total_tax_amount}}", style: "boldCell", alignment: "right" }
              ],
              [
                { text: "Less: TDS @ 1%", style: "tableCell" },
                { text: "\u20B9{{pending_tds_as_per_work}}", style: "tableCell", alignment: "right" },
                { text: "-", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "Balance", style: "boldCell", fillColor: "#f8fafc" },
                { text: "\u20B9{{balance_as_per_work}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" },
                { text: "\u20B9{{total_tax_amount}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" }
              ]
            ]
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 6]
        },
        {
          text: "Kindly pay online TDS of \u20B9{{pending_tds_as_per_work}}",
          bold: true,
          color: "#0369a1",
          margin: [0, 0, 0, 8]
        },
        {
          table: {
            widths: ["*", "*"],
            body: [
              [
                { text: "Flat Cost Banking Details", style: "tableHeader" },
                { text: "For GST Banking Details", style: "tableHeader" }
              ],
              [
                {
                  stack: [
                    { text: "Favouring Name : A K HITECH ASSOCIATES SAPPHIRE COLLECTION ACCOUNT", bold: true },
                    { text: "Bank Name : AXIS BANK" },
                    { text: "Current A/ C No. : 924020002973152", bold: true },
                    { text: "Bank IFSC : UTIB0001365" }
                  ],
                  style: "bankBox"
                },
                {
                  stack: [
                    { text: "Favouring Name : A K HITECH ASSOCIATES", bold: true },
                    { text: "Bank Name : AXIS BANK" },
                    { text: "Current A/ C No. : 923020031598565", bold: true },
                    { text: "Bank IFSC : UTIB0001365" }
                  ],
                  style: "bankBox"
                }
              ]
            ]
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 10]
        },
        {
          text: "You are requested to kindly make the above payment within 15 days ({{due_date}}) from the receipt of this letter otherwise arrears will be charge on delay payment. Pl find above banking details.",
          fontSize: 9,
          margin: [0, 0, 0, 12]
        },
        {
          columns: [
            { text: "" },
            {
              stack: [
                { text: "Yours Faithfully,", margin: [0, 0, 0, 2] },
                { text: "For AK Hitech Associates", bold: true, margin: [0, 0, 0, 36] },
                { text: "Authorized Signatory", style: "signatory" }
              ],
              alignment: "right",
              width: 180
            }
          ]
        }
      ]
    },
    variables: [
      { id: "current_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Mahesh Patil", required: true, group: "Customer Details", order: 1, bindings: [] },
      { id: "customer_address", label: "Customer Address", type: "textarea", defaultValue: "Row House No. 12, Sector 20, Kharghar, Navi Mumbai", required: true, group: "Customer Details", order: 2, bindings: [] },
      { id: "customer_email", label: "Email", type: "email", defaultValue: "patil.mahesh@rediffmail.com", required: false, group: "Contact Details", order: 3, bindings: [] },
      { id: "customer_phone", label: "Mobile", type: "phone", defaultValue: "9820512345", required: false, group: "Contact Details", order: 4, bindings: [] },
      { id: "installment_name", label: "Installment Name", type: "text", defaultValue: "Plinth Level", required: true, group: "Document Details", order: 5, bindings: [] },
      { id: "unit_name", label: "Flat No.", type: "text", defaultValue: "302", required: true, group: "Property Details", order: 6, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "3rd Floor", required: true, group: "Property Details", order: 7, bindings: [] },
      { id: "amount_without_tds_final", label: "Total Payment Due", type: "currency", defaultValue: 525e3, required: true, group: "Financial Details", order: 8, bindings: [] },
      { id: "previous_slabs_amount", label: "Previous Slabs Amount", type: "currency", defaultValue: 1e6, required: false, group: "Financial Details", order: 9, bindings: [] },
      { id: "previous_slabs_gst_amount", label: "Previous Slabs GST", type: "currency", defaultValue: 5e4, required: false, group: "Financial Details", order: 10, bindings: [] },
      { id: "latest_slab_amount", label: "Current Slab Amount", type: "currency", defaultValue: 5e5, required: true, group: "Financial Details", order: 11, bindings: [] },
      { id: "latest_slab_gst_amount", label: "Current Slab GST", type: "currency", defaultValue: 25e3, required: true, group: "Financial Details", order: 12, bindings: [] },
      { id: "total_percentage", label: "Total Amount Due %", type: "percent", defaultValue: 30, required: false, group: "Financial Details", order: 13, bindings: [] },
      { id: "pending_amount_as_per_work", label: "Pending Flat Cost As Per Work", type: "currency", defaultValue: 15e5, required: false, group: "Financial Details", order: 14, bindings: [] },
      { id: "pending_tax_as_per_work", label: "Pending Tax As Per Work", type: "currency", defaultValue: 75e3, required: false, group: "Financial Details", order: 15, bindings: [] },
      { id: "amount_paid", label: "Amount Received", type: "currency", defaultValue: 1e6, required: false, group: "Financial Details", order: 16, bindings: [] },
      { id: "tax_paid", label: "Tax Paid", type: "currency", defaultValue: 5e4, required: false, group: "Financial Details", order: 17, bindings: [] },
      { id: "total_due_amount", label: "Amount Due", type: "currency", defaultValue: 5e5, required: true, group: "Financial Details", order: 18, bindings: [] },
      { id: "total_tax_amount", label: "Total Tax Due", type: "currency", defaultValue: 25e3, required: true, group: "Financial Details", order: 19, bindings: [] },
      { id: "pending_tds_as_per_work", label: "TDS @ 1%", type: "currency", defaultValue: 5e3, required: false, group: "Financial Details", order: 20, bindings: [] },
      { id: "balance_as_per_work", label: "Balance Flat Cost", type: "currency", defaultValue: 495e3, required: true, group: "Financial Details", order: 21, bindings: [] },
      { id: "due_date", label: "Due Date (15 Days)", type: "date", defaultValue: "2026-11-19", required: false, group: "Document Details", order: 22, bindings: [] }
    ]
  },
  // =========================================================================
  // DEMAND 6: Royal Buildcon (Avencia)
  // =========================================================================
  {
    id: "master-demand-6",
    name: "Demand Letter 6 - Royal Buildcon (Avencia)",
    category: "Demand Letters",
    description: "Demand letter for Avencia project (Pushpaknagar) with TDS 1% deduction, agreement value, and IndusInd Bank collection account.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        companyTitle: { fontSize: 16, bold: true, alignment: "center", color: "#0f172a" },
        docTitle: { fontSize: 12, bold: true, alignment: "center", color: "#334155", margin: [0, 4, 0, 10] },
        tableHeader: { bold: true, fontSize: 9.5, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9.5 },
        boldCell: { fontSize: 9.5, bold: true },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" },
        footerText: { fontSize: 8.5, color: "#64748b", alignment: "center" }
      },
      content: [
        { text: "ROYAL BUILDCON", style: "companyTitle" },
        { text: "DEMAND LETTER", style: "docTitle" },
        {
          columns: [
            {
              stack: [
                { text: "To,", bold: true },
                { text: "{{customer_name}}", bold: true },
                { text: "{{customer_address}}", color: "#334155" },
                { text: "Email :- {{customer_email}}" },
                { text: "Mob :- {{customer_phone}}" }
              ],
              width: "*"
            },
            {
              text: "Date: {{current_date}}",
              alignment: "right",
              bold: true,
              width: 140
            }
          ],
          margin: [0, 0, 0, 10]
        },
        {
          text: "Subject :- Intimation for payment of {{installment_name}} against your Booking of Flat No. {{unit_name}} on {{unit_floor}} floor, \u201CAVENCIA \u201D Plot-04, Sector-5, Pushpaknagar, Dapoli, Navi Mumbai, Maharastra.",
          bold: true,
          margin: [0, 0, 0, 6]
        },
        {
          text: "Agreement Amount: \u20B9{{agreement_amount}}",
          bold: true,
          color: "#0369a1",
          margin: [0, 0, 0, 8]
        },
        {
          text: "Dear Madam/ Sir, ,\nWe have to inform you that a payment of \u20B9{{balance_as_per_work_without_exceed}} is due as below.",
          margin: [0, 0, 0, 8]
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", 140],
            body: [
              [
                { text: "INSTALLMENT DUE", style: "tableHeader" },
                { text: "ON FLAT COST", style: "tableHeader", alignment: "right" }
              ],
              [
                { text: "Previous Demand Value", style: "tableCell" },
                { text: "\u20B9{{previous_slabs_amount}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "{{installment_name}}", style: "tableCell" },
                { text: "\u20B9{{latest_slab_amount}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "Total Amount Due {{total_percentage}}%", style: "boldCell" },
                { text: "\u20B9{{pending_amount_as_per_work}}", style: "boldCell", alignment: "right" }
              ],
              [
                { text: "Less Amount Received \u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026.", style: "tableCell" },
                { text: "\u20B9{{amount_paid}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "AMOUNT DUE \u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026.", style: "boldCell" },
                { text: "\u20B9{{total_due_amount_without_exceed}}", style: "boldCell", alignment: "right" }
              ],
              [
                { text: "Less: TDS @ 1%", style: "tableCell" },
                { text: "\u20B9{{total_tds_amount_as_per_work}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "Balance", style: "boldCell", fillColor: "#f8fafc" },
                { text: "\u20B9{{balance_as_per_work_without_exceed}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" }
              ]
            ]
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 8]
        },
        {
          columns: [
            {
              stack: [
                { text: "Flat Amount Collection Banking Details:", bold: true, fontSize: 9 },
                { text: "Favouring Name : ROYAL BUILDCON AVENCIA COLLECTION A/ C", bold: true, fontSize: 8.5 },
                { text: "Bank Name : IndusInd Bank, Belapur Branch", fontSize: 8.5 },
                { text: "Current A/ C No. : 201029817183 | IFSC : INDB0000599", bold: true, fontSize: 8.5 }
              ],
              width: "*"
            },
            {
              text: "Kindly pay online TDS of \u20B9{{tds_balance}}",
              bold: true,
              color: "#0369a1",
              alignment: "right",
              width: 180
            }
          ],
          margin: [0, 0, 0, 10]
        },
        {
          text: "You are requested to kindly make the above payment within 15 days from the receipt of this letter otherwise arrears will be charged on delay payment. Please find above banking details.",
          fontSize: 9,
          margin: [0, 0, 0, 16]
        },
        {
          columns: [
            { text: "" },
            {
              stack: [
                { text: "Yours Faithfully,", margin: [0, 0, 0, 36] },
                { text: "Authorized Signatory", style: "signatory" }
              ],
              alignment: "right",
              width: 170
            }
          ],
          margin: [0, 0, 0, 20]
        },
        {
          text: "OFFICE ADDRESS: 905, Mayuresh Chambers. plot-60 sector-11, Cbd Belapur, Navi Mumbai, Maharashtra-400614.",
          style: "footerText"
        }
      ]
    },
    variables: [
      { id: "current_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Rohan Deshmukh", required: true, group: "Customer Details", order: 1, bindings: [] },
      { id: "customer_address", label: "Customer Address", type: "textarea", defaultValue: "Flat 101, Shanti Niketan, Panvel, Navi Mumbai 410206", required: true, group: "Customer Details", order: 2, bindings: [] },
      { id: "customer_email", label: "Email", type: "email", defaultValue: "rohan.deshmukh@gmail.com", required: false, group: "Contact Details", order: 3, bindings: [] },
      { id: "customer_phone", label: "Mobile", type: "phone", defaultValue: "9833445566", required: false, group: "Contact Details", order: 4, bindings: [] },
      { id: "installment_name", label: "Installment Name", type: "text", defaultValue: "Top Slab Casting", required: true, group: "Document Details", order: 5, bindings: [] },
      { id: "unit_name", label: "Flat No.", type: "text", defaultValue: "A-701", required: true, group: "Property Details", order: 6, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "7th", required: true, group: "Property Details", order: 7, bindings: [] },
      { id: "agreement_amount", label: "Agreement Amount", type: "currency", defaultValue: 65e5, required: true, group: "Financial Details", order: 8, bindings: [] },
      { id: "balance_as_per_work_without_exceed", label: "Net Due Balance", type: "currency", defaultValue: 643500, required: true, group: "Financial Details", order: 9, bindings: [] },
      { id: "previous_slabs_amount", label: "Previous Slabs Demanded", type: "currency", defaultValue: 45e5, required: false, group: "Financial Details", order: 10, bindings: [] },
      { id: "latest_slab_amount", label: "Current Slab Demanded", type: "currency", defaultValue: 65e4, required: true, group: "Financial Details", order: 11, bindings: [] },
      { id: "total_percentage", label: "Total Demand %", type: "percent", defaultValue: 80, required: false, group: "Financial Details", order: 12, bindings: [] },
      { id: "pending_amount_as_per_work", label: "Total Billed Till Date", type: "currency", defaultValue: 515e4, required: false, group: "Financial Details", order: 13, bindings: [] },
      { id: "amount_paid", label: "Amount Received Till Date", type: "currency", defaultValue: 45e5, required: false, group: "Financial Details", order: 14, bindings: [] },
      { id: "total_due_amount_without_exceed", label: "Total Due Flat Cost", type: "currency", defaultValue: 65e4, required: true, group: "Financial Details", order: 15, bindings: [] },
      { id: "total_tds_amount_as_per_work", label: "TDS @ 1%", type: "currency", defaultValue: 6500, required: false, group: "Financial Details", order: 16, bindings: [] },
      { id: "tds_balance", label: "TDS Online Payment", type: "currency", defaultValue: 6500, required: false, group: "Financial Details", order: 17, bindings: [] }
    ]
  },
  // =========================================================================
  // DEMAND 7: LMP Group (Rita Palace)
  // =========================================================================
  {
    id: "master-demand-7",
    name: "Demand Letter 7 - LMP Group (Rita Palace)",
    category: "Demand Letters",
    description: "Demand note for Rita Palace (Borivali West) with A.V. percentage calculation, Bank of Baroda account, and PAN/GSTIN registration.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 36, 40, 36],
      defaultStyle: { font: "Roboto", fontSize: 9.5, color: "#1e293b", lineHeight: 1.25 },
      styles: {
        companyTitle: { fontSize: 15, bold: true, alignment: "center", color: "#0f172a" },
        docTitle: { fontSize: 11, bold: true, alignment: "center", color: "#475569", margin: [0, 2, 0, 8] },
        tableHeader: { bold: true, fontSize: 8.5, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 8.5 },
        boldCell: { fontSize: 8.5, bold: true },
        signatory: { bold: true, fontSize: 9.5, color: "#0f172a" },
        footerText: { fontSize: 8, color: "#64748b", alignment: "center" }
      },
      content: [
        { text: "LMP GROUP RITA PALACE", style: "companyTitle" },
        { text: "Demand Note", style: "docTitle" },
        {
          columns: [
            {
              stack: [
                { text: "To,", bold: true },
                { text: "{{customer_name}}", bold: true },
                { text: "{{customer_address}}", color: "#334155" },
                { text: "Email :- {{customer_email}}" },
                { text: "Mob :- {{customer_phone}}" }
              ],
              width: "*"
            },
            {
              text: "Date: {{current_date}}",
              alignment: "right",
              bold: true,
              width: 140
            }
          ],
          margin: [0, 0, 0, 8]
        },
        {
          text: "Subject :- Intimation for payment due on {{installment_name}} stage against your Booking of Flat No. {{unit_name}} on {{unit_floor}} floor, \u201CRITA PALCE\u201D Wing {{wing}}, HARSHA PARK, CHANDRAVARKAR ROAD, OPP: MUNICIPAL GARDEN, BORIVALI (WEST) MUMBAI - 400 092.",
          bold: true,
          margin: [0, 0, 0, 6]
        },
        {
          text: "Dear Madam/ Sir, ,\nWe have to inform you that a payment of \u20B9{{balance_as_per_work}} is due as below. Your total payable Agreement Value is \u20B9{{agreement_amount}}",
          margin: [0, 0, 0, 6]
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", 160],
            body: [
              [
                { text: "INSTALLMENT DUE", style: "tableHeader" },
                { text: "AMOUNT DUE ON PURCHASE AREA", style: "tableHeader", alignment: "right" }
              ],
              [
                { text: "Previous Demand Value", style: "tableCell" },
                { text: "\u20B9{{previous_slabs_amount}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "{{installment_name}} Stage {{latest_slab_percentage}}% of A.V.", style: "tableCell" },
                { text: "\u20B9{{latest_slab_amount}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "Total Amount Due {{total_percentage}}%", style: "boldCell" },
                { text: "\u20B9{{pending_amount_as_per_work}}", style: "boldCell", alignment: "right" }
              ],
              [
                { text: "Less Amount Received \u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026.", style: "tableCell" },
                { text: "\u20B9{{amount_paid}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "AMOUNT DUE \u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026.", style: "boldCell" },
                { text: "\u20B9{{total_due_amount}}", style: "boldCell", alignment: "right" }
              ],
              [
                { text: "Less: TDS @ 1%", style: "tableCell" },
                { text: "\u20B9{{pending_tds_as_per_work}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "Balance", style: "boldCell", fillColor: "#f8fafc" },
                { text: "\u20B9{{balance_as_per_work}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" }
              ]
            ]
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 6]
        },
        {
          stack: [
            { text: "Kindly pay total GST of \u20B9{{tax_balance}} seperately OR Kindly pay GST upto this stage \u20B9{{total_tax_amount}}", bold: true, color: "#b45309", fontSize: 8.5 },
            { text: "Kindly pay online TDS of \u20B9{{pending_tds_as_per_work}}", bold: true, color: "#0369a1", fontSize: 8.5, margin: [0, 2, 0, 4] }
          ]
        },
        {
          stack: [
            { text: "Our Bank Details:", bold: true, fontSize: 8.5 },
            { text: "Favouring Name : LMP GROUP RITA PALACE\nBank Name : BANK OF BARODA | Current A/ C No. : 03860200002856\nBank IFSC : BARB0BORIVL (5th figure is zero) | BRANCH : BORIVALI (W)", fontSize: 8.5, color: "#334155", margin: [0, 2, 0, 4] }
          ]
        },
        {
          text: "You are requested to kindly make the above payment within fifteen days from date of invoice. Interest will be charged on delayed payments as per norms.",
          fontSize: 8.5,
          margin: [0, 0, 0, 8]
        },
        {
          columns: [
            {
              stack: [
                { text: "GSTIN: 27AAHFL3298C1Z8", bold: true, fontSize: 8.5 },
                { text: "PAN: AAHFL3298C", bold: true, fontSize: 8.5 }
              ],
              width: "*"
            },
            {
              stack: [
                { text: "Yours Faithfully,", margin: [0, 0, 0, 2] },
                { text: "For LMP GROUP RITA PALACE", bold: true },
                { text: "Accounts Dept.", margin: [0, 0, 0, 16] }
              ],
              alignment: "right",
              width: 180
            }
          ],
          margin: [0, 0, 0, 6]
        },
        {
          text: "(This is a computer generated authorised demand note and does not require to be signed)",
          style: "footerText",
          italics: true,
          margin: [0, 0, 0, 4]
        },
        {
          text: "Off: Kahan Bhavan, L.T.road, Behind Diamond Cinema, next to Purohit Hospital , Borivali west Mumbai-92\n98200 49360 | Email: lmpgroup.rpchsl@gmail.com",
          style: "footerText"
        }
      ]
    },
    variables: [
      { id: "current_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Ketan Shah", required: true, group: "Customer Details", order: 1, bindings: [] },
      { id: "customer_address", label: "Customer Address", type: "textarea", defaultValue: "B-14, Shanti Nagar, S.V. Road, Borivali West, Mumbai 400092", required: true, group: "Customer Details", order: 2, bindings: [] },
      { id: "customer_email", label: "Email", type: "email", defaultValue: "ketanshah@yahoo.com", required: false, group: "Contact Details", order: 3, bindings: [] },
      { id: "customer_phone", label: "Mobile", type: "phone", defaultValue: "9821123456", required: false, group: "Contact Details", order: 4, bindings: [] },
      { id: "installment_name", label: "Installment Name / Stage", type: "text", defaultValue: "Brickwork & Plaster", required: true, group: "Document Details", order: 5, bindings: [] },
      { id: "unit_name", label: "Flat No.", type: "text", defaultValue: "503", required: true, group: "Property Details", order: 6, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "5th", required: true, group: "Property Details", order: 7, bindings: [] },
      { id: "wing", label: "Wing", type: "text", defaultValue: "A", required: true, group: "Property Details", order: 8, bindings: [] },
      { id: "agreement_amount", label: "Agreement Value (A.V.)", type: "currency", defaultValue: 12e6, required: true, group: "Financial Details", order: 9, bindings: [] },
      { id: "balance_as_per_work", label: "Net Balance Due", type: "currency", defaultValue: 1188e3, required: true, group: "Financial Details", order: 10, bindings: [] },
      { id: "previous_slabs_amount", label: "Previous Demand Value", type: "currency", defaultValue: 72e5, required: false, group: "Financial Details", order: 11, bindings: [] },
      { id: "latest_slab_percentage", label: "Current Stage % of A.V.", type: "percent", defaultValue: 10, required: false, group: "Financial Details", order: 12, bindings: [] },
      { id: "latest_slab_amount", label: "Current Stage Amount", type: "currency", defaultValue: 12e5, required: true, group: "Financial Details", order: 13, bindings: [] },
      { id: "total_percentage", label: "Total Demand % of A.V.", type: "percent", defaultValue: 70, required: false, group: "Financial Details", order: 14, bindings: [] },
      { id: "pending_amount_as_per_work", label: "Total Billed Till Date", type: "currency", defaultValue: 84e5, required: false, group: "Financial Details", order: 15, bindings: [] },
      { id: "amount_paid", label: "Amount Received Till Date", type: "currency", defaultValue: 72e5, required: false, group: "Financial Details", order: 16, bindings: [] },
      { id: "total_due_amount", label: "Amount Due", type: "currency", defaultValue: 12e5, required: true, group: "Financial Details", order: 17, bindings: [] },
      { id: "pending_tds_as_per_work", label: "TDS @ 1%", type: "currency", defaultValue: 12e3, required: false, group: "Financial Details", order: 18, bindings: [] },
      { id: "tax_balance", label: "Total GST Due Seperately", type: "currency", defaultValue: 6e4, required: false, group: "Financial Details", order: 19, bindings: [] },
      { id: "total_tax_amount", label: "GST Upto This Stage", type: "currency", defaultValue: 42e4, required: false, group: "Financial Details", order: 20, bindings: [] }
    ]
  },
  // =========================================================================
  // RECEIPT 1: Pioneer Housing (Senroofs)
  // =========================================================================
  {
    id: "master-receipt-1",
    name: "Receipt 1 - Pioneer Housing (Senroofs)",
    category: "Receipts",
    description: "Official payment receipt for Pioneer Housing Senroofs project with flat/wing details, cheque/RTGS particulars table, and realization terms.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        companyTitle: { fontSize: 16, bold: true, alignment: "center", color: "#0f172a" },
        subHeader: { fontSize: 9, alignment: "center", color: "#475569", margin: [0, 2, 0, 4] },
        receiptTitle: { fontSize: 13, bold: true, alignment: "center", color: "#0f172a", margin: [0, 4, 0, 10] },
        tableHeader: { bold: true, fontSize: 9.5, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9.5 },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" }
      },
      content: [
        { text: "PIONEER HOUSING", style: "companyTitle" },
        { text: "R.O. Address : 322, Commerce House,140, N. M. Road, Fort,Mumbai - 400 001", style: "subHeader" },
        { text: "RECEIPT", style: "receiptTitle" },
        {
          columns: [
            {
              stack: [
                { text: "Flat No: {{unit_name}} on Floor: {{unit_floor}}", bold: true },
                { text: "in Building: D1 Wing: {{unit_wing}}" },
                { text: "at: SENROOFS Project on {{site_address}}", color: "#334155" }
              ],
              width: "*"
            },
            {
              stack: [
                { text: "Receipt No. : {{receipt_number}}", bold: true },
                { text: "Date : {{payment_date}}" }
              ],
              width: 160,
              alignment: "right"
            }
          ],
          margin: [0, 0, 0, 14]
        },
        {
          stack: [
            { text: "Received with thanks from : {{customer_name}} {{remark}} \u20B9{{amount_paid}}", bold: true, fontSize: 10.5 },
            { text: "the sum of : {{amount_in_words}}", italics: true, color: "#334155", margin: [0, 4, 0, 4] },
            { text: "by as under as per details in margin hereof", color: "#64748b", fontSize: 9 }
          ],
          margin: [0, 0, 0, 12]
        },
        {
          table: {
            headerRows: 1,
            widths: [100, 120, 90, "*"],
            body: [
              [
                { text: "Amount", style: "tableHeader", alignment: "right" },
                { text: "Chq/ RTGS No.", style: "tableHeader" },
                { text: "Date", style: "tableHeader" },
                { text: "Name of Bank / Branch", style: "tableHeader" }
              ],
              [
                { text: "\u20B9{{amount_paid}}", style: "tableCell", bold: true, alignment: "right" },
                { text: "{{cheque_number}}", style: "tableCell" },
                { text: "{{cheque_date}}", style: "tableCell" },
                { text: "{{bank_name}}", style: "tableCell" }
              ]
            ]
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 16]
        },
        {
          text: "Subject to Realisation of Cheque",
          fontSize: 8.5,
          italics: true,
          color: "#64748b",
          margin: [0, 0, 0, 20]
        },
        {
          columns: [
            { text: "" },
            {
              stack: [
                { text: "For PIONEER HOUSING,", bold: true, margin: [0, 0, 0, 36] },
                { text: "Authorised Signatory", style: "signatory" }
              ],
              alignment: "right",
              width: 180
            }
          ],
          margin: [0, 0, 0, 24]
        },
        {
          text: "This is auto generated receipt it doesn't require stamp",
          fontSize: 8.5,
          italics: true,
          alignment: "center",
          color: "#94a3b8"
        }
      ]
    },
    variables: [
      { id: "receipt_number", label: "Receipt No.", type: "text", defaultValue: "PH/2026/0892", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "payment_date", label: "Payment Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 1, bindings: [] },
      { id: "unit_name", label: "Flat No.", type: "text", defaultValue: "1402", required: true, group: "Property Details", order: 2, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "14th", required: true, group: "Property Details", order: 3, bindings: [] },
      { id: "unit_wing", label: "Building Wing", type: "text", defaultValue: "A", required: true, group: "Property Details", order: 4, bindings: [] },
      { id: "site_address", label: "Site Address", type: "textarea", defaultValue: "Senroofs, Nahur West, Mumbai 400078", required: true, group: "Project Details", order: 5, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Vipin Tomar", required: true, group: "Customer Details", order: 6, bindings: [] },
      { id: "amount_paid", label: "Amount Paid", type: "currency", defaultValue: 4e5, required: true, group: "Financial Details", order: 7, bindings: [] },
      { id: "amount_in_words", label: "Amount in Words", type: "text", defaultValue: "Rupees Four Lakh Only", required: true, group: "Financial Details", order: 8, bindings: [] },
      { id: "remark", label: "Payment Remark / Stage", type: "text", defaultValue: "towards 14th Slab casting", required: false, group: "Document Details", order: 9, bindings: [] },
      { id: "cheque_number", label: "Cheque / RTGS / UTR No.", type: "text", defaultValue: "HDFC001928374", required: true, group: "Bank Details", order: 10, bindings: [] },
      { id: "cheque_date", label: "Cheque / Transfer Date", type: "date", defaultValue: "2026-11-03", required: true, group: "Bank Details", order: 11, bindings: [] },
      { id: "bank_name", label: "Bank Name & Branch", type: "text", defaultValue: "HDFC Bank, Mulund West", required: true, group: "Bank Details", order: 12, bindings: [] }
    ]
  },
  // =========================================================================
  // RECEIPT 2: Standard Payment Receipt
  // =========================================================================
  {
    id: "master-receipt-2",
    name: "Receipt 2 - Standard Payment Receipt",
    category: "Receipts",
    description: "Payment receipt with RERA registration, company landline contact, Basic + GST breakdown, unit info, and prominent amount callout.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        receiptTitle: { fontSize: 14, bold: true, alignment: "center", color: "#0f172a" },
        amountBanner: { fontSize: 18, bold: true, color: "#0369a1", margin: [0, 8, 0, 8] },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" }
      },
      content: [
        {
          columns: [
            {
              stack: [
                { text: "{{project_by}}", bold: true, fontSize: 13, color: "#0f172a" },
                { text: "Contact : {{sub_company_landline}}", fontSize: 9, color: "#475569" }
              ],
              width: "*"
            },
            {
              text: "Rera No.: {{rera}}",
              alignment: "right",
              bold: true,
              fontSize: 9.5,
              width: 180
            }
          ],
          margin: [0, 0, 0, 8]
        },
        {
          canvas: [{ type: "line", x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 1, lineColor: "#cbd5e1" }],
          margin: [0, 0, 0, 12]
        },
        {
          columns: [
            { text: "Date: {{payment_date}}", bold: true },
            { text: "RECEIPT", style: "receiptTitle" },
            { text: "Receipt No.: {{receipt_number}}", alignment: "right", bold: true }
          ],
          margin: [0, 0, 0, 14]
        },
        {
          stack: [
            { text: "Received with thanks from {{customer_name}}", bold: true, fontSize: 11 },
            { text: "Basic: \u20B9{{amount_without_tax}} {{tds_payment_type}} + GST: \u20B9{{tax_amount}} = Total: \u20B9{{amount_for_paid}}", color: "#334155", margin: [0, 4, 0, 4] },
            { text: "a sum of {{amount_in_words}} against Unit No.: {{unit_wing}}- {{unit_name}} On {{unit_floor}} Floor", color: "#334155" },
            { text: "\u20B9{{amount_for_paid}}", style: "amountBanner" }
          ],
          margin: [0, 0, 0, 12]
        },
        {
          stack: [
            { text: "Cheque/ D.D. No./ RTGS : {{cheque_number}} Dated : {{cheque_date}}", bold: true },
            { text: "Bank Name: {{bank_name}}" },
            { text: "Remark: {{remark}}", italics: true, color: "#475569" }
          ],
          margin: [0, 0, 0, 16]
        },
        {
          columns: [
            {
              text: "Cheques are subject to realisation",
              fontSize: 8.5,
              italics: true,
              color: "#64748b",
              margin: [0, 40, 0, 0]
            },
            {
              stack: [
                { text: "For {{project_by}}", bold: true, margin: [0, 0, 0, 36] },
                { text: "Authorised Signatory", style: "signatory" }
              ],
              alignment: "right",
              width: 180
            }
          ],
          margin: [0, 0, 0, 20]
        },
        {
          text: "This is an auto- generated Payment Receipt.",
          alignment: "center",
          fontSize: 8.5,
          italics: true,
          color: "#94a3b8"
        }
      ]
    },
    variables: [
      { id: "rera", label: "RERA No.", type: "text", defaultValue: "P51800001234", required: true, group: "Project Details", order: 0, bindings: [] },
      { id: "project_by", label: "Developer / Company Name", type: "text", defaultValue: "Dimple Realtors Pvt. Ltd.", required: true, group: "Company Details", order: 1, bindings: [] },
      { id: "sub_company_landline", label: "Contact / Landline", type: "phone", defaultValue: "+91-22-28901234", required: false, group: "Contact Details", order: 2, bindings: [] },
      { id: "payment_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 3, bindings: [] },
      { id: "receipt_number", label: "Receipt No.", type: "text", defaultValue: "DR/REC/2026/104", required: true, group: "Document Details", order: 4, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Rajesh Sharma", required: true, group: "Customer Details", order: 5, bindings: [] },
      { id: "amount_without_tax", label: "Basic Amount", type: "currency", defaultValue: 693e3, required: true, group: "Financial Details", order: 6, bindings: [] },
      { id: "tds_payment_type", label: "TDS Note / Breakup", type: "text", defaultValue: "(Net of TDS)", required: false, group: "Financial Details", order: 7, bindings: [] },
      { id: "tax_amount", label: "GST Amount", type: "currency", defaultValue: 35e3, required: true, group: "Financial Details", order: 8, bindings: [] },
      { id: "amount_for_paid", label: "Total Amount Received", type: "currency", defaultValue: 728e3, required: true, group: "Financial Details", order: 9, bindings: [] },
      { id: "amount_in_words", label: "Amount in Words", type: "text", defaultValue: "Rupees Seven Lakh Twenty Eight Thousand Only", required: true, group: "Financial Details", order: 10, bindings: [] },
      { id: "unit_wing", label: "Wing", type: "text", defaultValue: "B", required: false, group: "Property Details", order: 11, bindings: [] },
      { id: "unit_name", label: "Unit No.", type: "text", defaultValue: "804", required: true, group: "Property Details", order: 12, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "8th", required: true, group: "Property Details", order: 13, bindings: [] },
      { id: "cheque_number", label: "Cheque / D.D. / RTGS No.", type: "text", defaultValue: "SBI092837192", required: true, group: "Bank Details", order: 14, bindings: [] },
      { id: "cheque_date", label: "Dated", type: "date", defaultValue: "2026-11-02", required: true, group: "Bank Details", order: 15, bindings: [] },
      { id: "bank_name", label: "Bank Name", type: "text", defaultValue: "State Bank of India, Borivali", required: true, group: "Bank Details", order: 16, bindings: [] },
      { id: "remark", label: "Remark", type: "text", defaultValue: "Part Payment against Flat 804", required: false, group: "Document Details", order: 17, bindings: [] }
    ]
  },
  // =========================================================================
  // RECEIPT 3: Comprehensive Receipt (PAN & GST)
  // =========================================================================
  {
    id: "master-receipt-3",
    name: "Receipt 3 - Comprehensive Receipt (PAN & GST)",
    category: "Receipts",
    description: "Comprehensive receipt featuring dual company/project header with PAN, GSTIN, RERA, Basic + GST breakdown, and prominent amount box.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        receiptTitle: { fontSize: 14, bold: true, alignment: "center", color: "#0f172a" },
        amountBanner: { fontSize: 18, bold: true, color: "#059669", margin: [0, 8, 0, 8] },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" }
      },
      content: [
        {
          columns: [
            {
              stack: [
                { text: "{{project_by}}", bold: true, fontSize: 12, color: "#0f172a" },
                { text: "{{sub_company_address}}", fontSize: 8.5, color: "#475569" },
                { text: "Contact : {{sub_company_landline}}", fontSize: 8.5 },
                { text: "PAN : {{sub_company_pan}}", bold: true, fontSize: 8.5 }
              ],
              width: "*"
            },
            {
              stack: [
                { text: "Project : {{project_name}}", bold: true, fontSize: 11 },
                { text: "{{site_address}}", fontSize: 8.5, color: "#475569" },
                { text: "Rera No.: {{rera}}", bold: true, fontSize: 8.5 },
                { text: "GST : {{sub_company_gst}}", bold: true, fontSize: 8.5 }
              ],
              width: 220,
              alignment: "right"
            }
          ],
          margin: [0, 0, 0, 8]
        },
        {
          canvas: [{ type: "line", x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 1, lineColor: "#cbd5e1" }],
          margin: [0, 0, 0, 12]
        },
        {
          columns: [
            { text: "Date: {{payment_date}}", bold: true },
            { text: "RECEIPT", style: "receiptTitle" },
            { text: "Receipt No.: {{receipt_number}}", alignment: "right", bold: true }
          ],
          margin: [0, 0, 0, 14]
        },
        {
          stack: [
            { text: "Received with the thanks from {{customer_name}}", bold: true, fontSize: 11 },
            { text: "Basic: \u20B9 {{amount_without_tax}} + GST: \u20B9 {{tax_amount}} = Total: \u20B9 {{amount_for_paid}}", color: "#334155", margin: [0, 4, 0, 4] },
            { text: "a sum of {{amount_in_words}} on account of amount received against Unit No.: {{unit_wing}}- {{unit_name}}", color: "#334155" },
            { text: "\u20B9{{amount_paid}}", style: "amountBanner" }
          ],
          margin: [0, 0, 0, 12]
        },
        {
          stack: [
            { text: "Cheque/ D.D. No./ RTGS : {{cheque_number}} Dated : {{cheque_date}}", bold: true },
            { text: "Bank Name: {{bank_name}}" },
            { text: "Remark: {{remark}}", italics: true, color: "#475569" }
          ],
          margin: [0, 0, 0, 16]
        },
        {
          columns: [
            {
              text: "Cheques are subject to realisation",
              fontSize: 8.5,
              italics: true,
              color: "#64748b",
              margin: [0, 40, 0, 0]
            },
            {
              stack: [
                { text: "For {{project_by}}", bold: true, margin: [0, 0, 0, 36] },
                { text: "Authorised Signatory", style: "signatory" }
              ],
              alignment: "right",
              width: 180
            }
          ],
          margin: [0, 0, 0, 20]
        },
        {
          text: "This is an auto- generated Payment Receipt.",
          alignment: "center",
          fontSize: 8.5,
          italics: true,
          color: "#94a3b8"
        }
      ]
    },
    variables: [
      { id: "project_by", label: "Company / Developer", type: "text", defaultValue: "Gurukrupa Realcon Developers Pvt. Ltd.", required: true, group: "Company Details", order: 0, bindings: [] },
      { id: "sub_company_address", label: "Company Address", type: "textarea", defaultValue: "Gurukrupa Heights, Ghatkopar East, Mumbai - 400077", required: false, group: "Company Details", order: 1, bindings: [] },
      { id: "sub_company_landline", label: "Contact No.", type: "phone", defaultValue: "+91-22-25123456", required: false, group: "Contact Details", order: 2, bindings: [] },
      { id: "sub_company_pan", label: "Company PAN", type: "text", defaultValue: "AABCG1234F", required: false, group: "Company Details", order: 3, bindings: [] },
      { id: "project_name", label: "Project Name", type: "text", defaultValue: "Marina Enclave", required: true, group: "Project Details", order: 4, bindings: [] },
      { id: "site_address", label: "Site Address", type: "textarea", defaultValue: "Jankalyan Nagar, Malad West, Mumbai - 400095", required: false, group: "Project Details", order: 5, bindings: [] },
      { id: "rera", label: "RERA No.", type: "text", defaultValue: "P51800004567", required: false, group: "Project Details", order: 6, bindings: [] },
      { id: "sub_company_gst", label: "GSTIN", type: "text", defaultValue: "27AABCG1234F1Z2", required: false, group: "Company Details", order: 7, bindings: [] },
      { id: "payment_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 8, bindings: [] },
      { id: "receipt_number", label: "Receipt No.", type: "text", defaultValue: "GRD/2026/512", required: true, group: "Document Details", order: 9, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Pooja Mehta", required: true, group: "Customer Details", order: 10, bindings: [] },
      { id: "amount_without_tax", label: "Basic Amount", type: "currency", defaultValue: 85e4, required: true, group: "Financial Details", order: 11, bindings: [] },
      { id: "tax_amount", label: "GST Amount", type: "currency", defaultValue: 42500, required: true, group: "Financial Details", order: 12, bindings: [] },
      { id: "amount_for_paid", label: "Total Amount", type: "currency", defaultValue: 892500, required: true, group: "Financial Details", order: 13, bindings: [] },
      { id: "amount_paid", label: "Amount Paid", type: "currency", defaultValue: 892500, required: true, group: "Financial Details", order: 14, bindings: [] },
      { id: "amount_in_words", label: "Amount in Words", type: "text", defaultValue: "Rupees Eight Lakh Ninety Two Thousand Five Hundred Only", required: true, group: "Financial Details", order: 15, bindings: [] },
      { id: "unit_wing", label: "Wing", type: "text", defaultValue: "Wing C", required: false, group: "Property Details", order: 16, bindings: [] },
      { id: "unit_name", label: "Unit No.", type: "text", defaultValue: "1103", required: true, group: "Property Details", order: 17, bindings: [] },
      { id: "cheque_number", label: "Cheque / RTGS / UTR No.", type: "text", defaultValue: "ICIC00088921", required: true, group: "Bank Details", order: 18, bindings: [] },
      { id: "cheque_date", label: "Dated", type: "date", defaultValue: "2026-11-03", required: true, group: "Bank Details", order: 19, bindings: [] },
      { id: "bank_name", label: "Bank Name", type: "text", defaultValue: "ICICI Bank, Ghatkopar", required: true, group: "Bank Details", order: 20, bindings: [] },
      { id: "remark", label: "Remark", type: "text", defaultValue: "11th Slab RCC milestone payment", required: false, group: "Document Details", order: 21, bindings: [] }
    ]
  },
  // =========================================================================
  // RECEIPT 4: Sankalp Builders
  // =========================================================================
  {
    id: "master-receipt-4",
    name: "Receipt 4 - Sankalp Builders",
    category: "Receipts",
    description: "Statutory payment receipt for Sankalp Builders (Jaipur) with GSTIN, RERA, detailed tax breakdown table (Basic, CGST, SGST, Total), and terms.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 9.5, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        companyTitle: { fontSize: 15, bold: true, alignment: "center", color: "#0f172a" },
        subHeader: { fontSize: 8.5, alignment: "center", color: "#475569" },
        receiptTitle: { fontSize: 13, bold: true, alignment: "center", color: "#0f172a" },
        tableHeader: { bold: true, fontSize: 9, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9 },
        boldCell: { fontSize: 9, bold: true },
        signatory: { bold: true, fontSize: 9.5, color: "#0f172a" },
        noteText: { fontSize: 8, color: "#64748b", lineHeight: 1.2 }
      },
      content: [
        { text: "SANKALP BUILDERS", style: "companyTitle" },
        { text: "Corp. Off.. E-123-124, Behind IOC Petrol Pump, Sahakar Marg, Jaipur -302015 (Raj.)\nPhone: +91-141-247-0007/2470008", style: "subHeader", margin: [0, 2, 0, 8] },
        {
          columns: [
            { text: "GSTIN: {{sub_company_gst}}", bold: true, fontSize: 9 },
            { text: "RECEIPT", style: "receiptTitle" },
            { text: "Rera REG No.: {{rera}}", alignment: "right", bold: true, fontSize: 9 }
          ],
          margin: [0, 0, 0, 6]
        },
        {
          canvas: [{ type: "line", x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 1, lineColor: "#cbd5e1" }],
          margin: [0, 0, 0, 10]
        },
        {
          columns: [
            { text: "Date: {{payment_date}}", bold: true },
            { text: "Receipt No.: {{receipt_number}}", alignment: "right", bold: true }
          ],
          margin: [0, 0, 0, 8]
        },
        {
          text: "Received with the thanks from {{customer_name}}\na sum of {{amount_in_words}} vide {{payment_mode}}: {{cheque_number}} Dated: {{cheque_date}} Drawn on {{bank_name}} on account of {{remark}} in respect of provisional Unit No. {{unit_name}} in the project {{project_name}} {{site_address}}",
          margin: [0, 0, 0, 8]
        },
        {
          text: "In accordance with the terms and conditions of booking. The break- up the amount received is as under:-",
          fontSize: 9,
          color: "#475569",
          margin: [0, 0, 0, 6]
        },
        {
          table: {
            headerRows: 1,
            widths: [50, "*", 120],
            body: [
              [
                { text: "Sr. No.", style: "tableHeader", alignment: "center" },
                { text: "Particulars", style: "tableHeader" },
                { text: "Amount(Rs.)", style: "tableHeader", alignment: "right" }
              ],
              [
                { text: "1.", style: "tableCell", alignment: "center" },
                { text: "Basic Consideration", style: "tableCell" },
                { text: "\u20B9{{amount_without_tax}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "2.", style: "tableCell", alignment: "center" },
                { text: "CGST", style: "tableCell" },
                { text: "\u20B9{{cgst}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "3.", style: "tableCell", alignment: "center" },
                { text: "SGST", style: "tableCell" },
                { text: "\u20B9{{sgst}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "4.", style: "boldCell", alignment: "center", fillColor: "#f8fafc" },
                { text: "Total Amount", style: "boldCell", fillColor: "#f8fafc" },
                { text: "\u20B9{{amount_for_paid}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" }
              ]
            ]
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 8]
        },
        {
          columns: [
            {
              text: "Receipt of cheque shall be valid subject to realization.",
              fontSize: 8.5,
              italics: true,
              color: "#64748b",
              margin: [0, 16, 0, 0]
            },
            {
              stack: [
                { text: "For M/ s Sankalp Builders", bold: true, margin: [0, 0, 0, 30] },
                { text: "(Authorised Signatory)", style: "signatory" }
              ],
              alignment: "right",
              width: 170
            }
          ],
          margin: [0, 0, 0, 12]
        },
        {
          stack: [
            { text: "Note:", bold: true, fontSize: 8.5 },
            { text: "1. This receipt is not transerable.", style: "noteText" },
            { text: "2. This receipt is neither a dcoument of title nor a document giving any other right in the respect of immovable property and thus entering into a transaction of subsequent sale/ purchase etc. based on this receipt would be so at his/ her own risk.", style: "noteText" },
            { text: "3. The amount mentioned in this receipt may be liable to be forfeited, in accordance with the terms and conditions of the booking if all payments are not mode on time or the other breach by the applicant(s).", style: "noteText" }
          ]
        }
      ]
    },
    variables: [
      { id: "rera", label: "RERA REG No.", type: "text", defaultValue: "RAJ/P/2021/1542", required: true, group: "Project Details", order: 0, bindings: [] },
      { id: "sub_company_gst", label: "GSTIN", type: "text", defaultValue: "08ACOFS3617H1ZT", required: true, group: "Company Details", order: 1, bindings: [] },
      { id: "payment_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 2, bindings: [] },
      { id: "receipt_number", label: "Receipt No.", type: "text", defaultValue: "SB/2026/0431", required: true, group: "Document Details", order: 3, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Sunil Agarwal", required: true, group: "Customer Details", order: 4, bindings: [] },
      { id: "amount_in_words", label: "Amount in Words", type: "text", defaultValue: "Rupees Six Lakh Thirty Thousand Only", required: true, group: "Financial Details", order: 5, bindings: [] },
      { id: "payment_mode", label: "Payment Mode", type: "text", defaultValue: "RTGS", required: true, group: "Bank Details", order: 6, bindings: [] },
      { id: "cheque_number", label: "Cheque / UTR No.", type: "text", defaultValue: "HDFCR52026110291", required: true, group: "Bank Details", order: 7, bindings: [] },
      { id: "cheque_date", label: "Instrument Date", type: "date", defaultValue: "2026-11-02", required: true, group: "Bank Details", order: 8, bindings: [] },
      { id: "bank_name", label: "Drawn On (Bank)", type: "text", defaultValue: "HDFC Bank, Jaipur", required: true, group: "Bank Details", order: 9, bindings: [] },
      { id: "remark", label: "On Account Of", type: "text", defaultValue: "5th Floor Slab Milestone", required: false, group: "Document Details", order: 10, bindings: [] },
      { id: "unit_name", label: "Provisional Unit No.", type: "text", defaultValue: "A-502", required: true, group: "Property Details", order: 11, bindings: [] },
      { id: "project_name", label: "Project Name", type: "text", defaultValue: "The Rise", required: true, group: "Project Details", order: 12, bindings: [] },
      { id: "site_address", label: "Project Site Address", type: "textarea", defaultValue: "Ajmer Road, Jaipur", required: true, group: "Project Details", order: 13, bindings: [] },
      { id: "amount_without_tax", label: "Basic Consideration", type: "currency", defaultValue: 6e5, required: true, group: "Financial Details", order: 14, bindings: [] },
      { id: "cgst", label: "CGST (2.5%)", type: "currency", defaultValue: 15e3, required: true, group: "Financial Details", order: 15, bindings: [] },
      { id: "sgst", label: "SGST (2.5%)", type: "currency", defaultValue: 15e3, required: true, group: "Financial Details", order: 16, bindings: [] },
      { id: "amount_for_paid", label: "Total Amount Received", type: "currency", defaultValue: 63e4, required: true, group: "Financial Details", order: 17, bindings: [] }
    ]
  },
  // =========================================================================
  // RECEIPT 5: Margin Table Receipt
  // =========================================================================
  {
    id: "master-receipt-5",
    name: "Receipt 5 - Margin Table Receipt",
    category: "Receipts",
    description: "Compact payment receipt format with upper right metadata box, payment mode table, unit details, and 10% booking cancellation clause.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        tableHeader: { bold: true, fontSize: 9.5, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9.5 },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" },
        notice: { fontSize: 8.5, color: "#64748b", italics: true }
      },
      content: [
        {
          columns: [
            { text: "" },
            {
              stack: [
                { text: "Receipt No. : {{receipt_number}}", bold: true },
                { text: "Date : {{payment_date}}" },
                { text: "\u20B9{{amount_paid}}", fontSize: 18, bold: true, color: "#0369a1", margin: [0, 4, 0, 0] }
              ],
              alignment: "right",
              width: 180
            }
          ],
          margin: [0, 0, 0, 16]
        },
        {
          stack: [
            { text: "Received with thanks from :", color: "#64748b" },
            { text: "{{customer_name}}", bold: true, fontSize: 12, margin: [0, 2, 0, 6] },
            { text: "the sum of : {{amount_in_words}}", italics: true, margin: [0, 0, 0, 4] },
            { text: "by as under as per details in margin hereof", color: "#64748b", fontSize: 9 }
          ],
          margin: [0, 0, 0, 14]
        },
        {
          table: {
            headerRows: 1,
            widths: [80, 110, 90, "*"],
            body: [
              [
                { text: "Mode", style: "tableHeader" },
                { text: "Chq/ RTGS No.", style: "tableHeader" },
                { text: "DATED", style: "tableHeader" },
                { text: "Name of Bank / Branch", style: "tableHeader" }
              ],
              [
                { text: "{{payment_mode}}", style: "tableCell" },
                { text: "{{cheque_number}}", style: "tableCell" },
                { text: "{{cheque_date}}", style: "tableCell" },
                { text: "{{bank_name}}", style: "tableCell" }
              ]
            ]
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 14]
        },
        {
          text: "ON ACCOUNT OF EARNEST MONEY / FULL PAYMENT / GST TOWARDS THE PURCHASE VALUE OF SHOP / FLAT NO. {{unit_name}} ON FLOOR {{unit_floor}}",
          bold: true,
          fontSize: 9.5,
          color: "#334155",
          margin: [0, 0, 0, 16]
        },
        {
          columns: [
            {
              stack: [
                { text: "ALL PAYMENT BY CHEQUE ARE ACKNOWLEDGED SUBJECT TO REALISATION", style: "notice" },
                { text: "*On Cancellation of booking 10% payment will be deducted", style: "notice", color: "#ef4444" }
              ],
              width: "*"
            },
            {
              text: "Authorised Signatory",
              style: "signatory",
              alignment: "right",
              width: 160,
              margin: [0, 20, 0, 0]
            }
          ],
          margin: [0, 0, 0, 24]
        },
        {
          text: "This is computer generated copy",
          alignment: "center",
          style: "notice"
        }
      ]
    },
    variables: [
      { id: "receipt_number", label: "Receipt No.", type: "text", defaultValue: "REC/2026/0921", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "payment_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 1, bindings: [] },
      { id: "amount_paid", label: "Amount Paid", type: "currency", defaultValue: 25e4, required: true, group: "Financial Details", order: 2, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Amitabh Banerjee", required: true, group: "Customer Details", order: 3, bindings: [] },
      { id: "amount_in_words", label: "Amount in Words", type: "text", defaultValue: "Rupees Two Lakh Fifty Thousand Only", required: true, group: "Financial Details", order: 4, bindings: [] },
      { id: "payment_mode", label: "Mode", type: "text", defaultValue: "Cheque", required: true, group: "Bank Details", order: 5, bindings: [] },
      { id: "cheque_number", label: "Chq / RTGS No.", type: "text", defaultValue: "000412", required: true, group: "Bank Details", order: 6, bindings: [] },
      { id: "cheque_date", label: "Dated", type: "date", defaultValue: "2026-11-01", required: true, group: "Bank Details", order: 7, bindings: [] },
      { id: "bank_name", label: "Name of Bank / Branch", type: "text", defaultValue: "Axis Bank, Bandra West", required: true, group: "Bank Details", order: 8, bindings: [] },
      { id: "unit_name", label: "Shop / Flat No.", type: "text", defaultValue: "Flat 402", required: true, group: "Property Details", order: 9, bindings: [] },
      { id: "unit_floor", label: "On Floor", type: "text", defaultValue: "4th Floor", required: true, group: "Property Details", order: 10, bindings: [] }
    ]
  },
  // =========================================================================
  // RECEIPT 6: Royal Buildcon
  // =========================================================================
  {
    id: "master-receipt-6",
    name: "Receipt 6 - Royal Buildcon",
    category: "Receipts",
    description: "Full-scale company receipt with dual Customer and Company/GSTIN detail blocks, 9-column instrument and tax breakdown table, and terms.",
    definition: {
      pageSize: "A4",
      pageMargins: [36, 36, 36, 36],
      defaultStyle: { font: "Roboto", fontSize: 9.5, color: "#1e293b", lineHeight: 1.25 },
      styles: {
        companyTitle: { fontSize: 16, bold: true, alignment: "center", color: "#0f172a" },
        receiptTitle: { fontSize: 12, bold: true, alignment: "center", color: "#475569", margin: [0, 2, 0, 8] },
        sectionHead: { fontSize: 9.5, bold: true, color: "#0f172a", margin: [0, 2, 0, 2] },
        tableHeader: { bold: true, fontSize: 8, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 8 },
        tableCellBold: { fontSize: 8, bold: true },
        signatory: { bold: true, fontSize: 9.5, color: "#0f172a" },
        noteText: { fontSize: 8, color: "#64748b", lineHeight: 1.2 }
      },
      content: [
        { text: "ROYAL BUILDCON", style: "companyTitle" },
        { text: "RECEIPT", style: "receiptTitle" },
        {
          columns: [
            { text: "Receipt No.: {{receipt_number}}", bold: true },
            { text: "Date: {{current_date}}", alignment: "right", bold: true }
          ],
          margin: [0, 0, 0, 8]
        },
        {
          columns: [
            {
              stack: [
                { text: "CUSTOMER DETAILS", style: "sectionHead" },
                { text: "{{customer_name}}", bold: true },
                { text: "{{customer_address}}", color: "#334155" },
                { text: "(M): {{customer_contact}}" },
                { text: "UNIT DETAILS", style: "sectionHead", margin: [0, 6, 0, 2] },
                { text: "Project : {{project_name}}" },
                { text: "Unit No.: {{unit_name}}" },
                { text: "Floor: {{unit_floor}}  |  Block: {{unit_wing}}" }
              ],
              width: "*"
            },
            {
              stack: [
                { text: "COMPANY DETAILS", style: "sectionHead" },
                { text: "ROYAL BUILDCON", bold: true },
                { text: "Plot-60, Sector-11, Cbd Belapur, Navi Mumbai, Maharashtra 400614", color: "#334155" },
                { text: "Tel: 7977174537 / 8080200802" },
                { text: "Email: vinit@hitechinfragroup.com / hitech270918@gmail.com" },
                { text: "State: Maharashtra  |  State Code: 27" },
                { text: "GSTIN: 27ABAFR3966R1ZD", bold: true }
              ],
              width: 240
            }
          ],
          margin: [0, 0, 0, 8]
        },
        {
          text: "Received with thanks from a sum of Rs. {{amount_paid}} /- ( {{amount_in_words}} )",
          bold: true,
          fontSize: 9.5,
          margin: [0, 0, 0, 6]
        },
        {
          table: {
            headerRows: 1,
            widths: [20, 45, 55, 60, "*", 55, 45, 45, 55],
            body: [
              [
                { text: "S.No", style: "tableHeader" },
                { text: "Mode", style: "tableHeader" },
                { text: "Inst. Date", style: "tableHeader" },
                { text: "Inst. No", style: "tableHeader" },
                { text: "Bank", style: "tableHeader" },
                { text: "Amount", style: "tableHeader", alignment: "right" },
                { text: "CGST", style: "tableHeader", alignment: "right" },
                { text: "SGST", style: "tableHeader", alignment: "right" },
                { text: "Total Amount", style: "tableHeader", alignment: "right" }
              ],
              [
                { text: "1", style: "tableCell" },
                { text: "{{payment_mode}}", style: "tableCell" },
                { text: "{{cheque_date}}", style: "tableCell" },
                { text: "{{cheque_number}}", style: "tableCell" },
                { text: "{{bank_name}}", style: "tableCell" },
                { text: "\u20B9{{amount_without_tax}}", style: "tableCell", alignment: "right" },
                { text: "\u20B9{{cgst}}", style: "tableCell", alignment: "right" },
                { text: "\u20B9{{sgst}}", style: "tableCell", alignment: "right" },
                { text: "\u20B9{{amount_for_paid}}", style: "tableCell", alignment: "right" }
              ],
              [
                { text: "Total", style: "tableCellBold", colSpan: 5 },
                {},
                {},
                {},
                {},
                { text: "\u20B9{{amount_without_tax}}", style: "tableCellBold", alignment: "right" },
                { text: "\u20B9{{cgst}}", style: "tableCellBold", alignment: "right" },
                { text: "\u20B9{{sgst}}", style: "tableCellBold", alignment: "right" },
                { text: "\u20B9{{amount_for_paid}}", style: "tableCellBold", alignment: "right" }
              ]
            ]
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 8]
        },
        {
          text: "Total Amount Received: \u20B9{{amount_paid}}",
          bold: true,
          fontSize: 11,
          color: "#0369a1",
          margin: [0, 0, 0, 8]
        },
        {
          stack: [
            { text: "Terms & Conditions.", bold: true, fontSize: 8.5 },
            { text: "1. This receipt is non transferable.", style: "noteText" },
            { text: "2. This receipt is neither a dcoument of title nor a document giving any other right in the respect of immovable property and thus entering into a transaction of subsequent sale/ purchase etc. based on this receipt would be so at his/ her own risk.", style: "noteText" },
            { text: "3. The amount mentioned in this receipt may be liable to be forfeited, in accordance with the terms and conditions of the booking if all payments are not mode on time or the other breach by the applicant(s).", style: "noteText" }
          ],
          margin: [0, 0, 0, 10]
        },
        {
          columns: [
            {
              text: "This is an auto- generated payment receipt and therefore does not require any signature.",
              fontSize: 8,
              italics: true,
              color: "#94a3b8",
              margin: [0, 18, 0, 0]
            },
            {
              stack: [
                { text: "Authorized Signatory", style: "signatory" }
              ],
              alignment: "right",
              width: 150
            }
          ],
          margin: [0, 0, 0, 10]
        },
        {
          text: "SITE ADDRESS: Plot-04, Sector-5, Pushpaknagar, Dapoli, Navi Mumbai, Maharastra",
          fontSize: 8,
          color: "#64748b",
          alignment: "center"
        }
      ]
    },
    variables: [
      { id: "receipt_number", label: "Receipt No.", type: "text", defaultValue: "RB/REC/2026/184", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "current_date", label: "Receipt Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 1, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Rohan Deshmukh", required: true, group: "Customer Details", order: 2, bindings: [] },
      { id: "customer_address", label: "Customer Address", type: "textarea", defaultValue: "Flat 101, Shanti Niketan, Panvel 410206", required: true, group: "Customer Details", order: 3, bindings: [] },
      { id: "customer_contact", label: "Customer Mobile", type: "phone", defaultValue: "9833445566", required: false, group: "Contact Details", order: 4, bindings: [] },
      { id: "project_name", label: "Project Name", type: "text", defaultValue: "Avencia", required: true, group: "Project Details", order: 5, bindings: [] },
      { id: "unit_name", label: "Unit No.", type: "text", defaultValue: "A-701", required: true, group: "Property Details", order: 6, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "7th", required: true, group: "Property Details", order: 7, bindings: [] },
      { id: "unit_wing", label: "Block / Wing", type: "text", defaultValue: "A", required: false, group: "Property Details", order: 8, bindings: [] },
      { id: "amount_paid", label: "Amount Paid", type: "currency", defaultValue: 65e4, required: true, group: "Financial Details", order: 9, bindings: [] },
      { id: "amount_in_words", label: "Amount in Words", type: "text", defaultValue: "Rupees Six Lakh Fifty Thousand Only", required: true, group: "Financial Details", order: 10, bindings: [] },
      { id: "payment_mode", label: "Instrument Mode", type: "text", defaultValue: "NEFT", required: true, group: "Bank Details", order: 11, bindings: [] },
      { id: "cheque_date", label: "Instrument Date", type: "date", defaultValue: "2026-11-03", required: true, group: "Bank Details", order: 12, bindings: [] },
      { id: "cheque_number", label: "Instrument No.", type: "text", defaultValue: "INDBN20261103001", required: true, group: "Bank Details", order: 13, bindings: [] },
      { id: "bank_name", label: "Bank Name", type: "text", defaultValue: "IndusInd Bank, Belapur", required: true, group: "Bank Details", order: 14, bindings: [] },
      { id: "amount_without_tax", label: "Amount (Basic)", type: "currency", defaultValue: 619048, required: true, group: "Financial Details", order: 15, bindings: [] },
      { id: "cgst", label: "CGST", type: "currency", defaultValue: 15476, required: true, group: "Financial Details", order: 16, bindings: [] },
      { id: "sgst", label: "SGST", type: "currency", defaultValue: 15476, required: true, group: "Financial Details", order: 17, bindings: [] },
      { id: "amount_for_paid", label: "Total Amount", type: "currency", defaultValue: 65e4, required: true, group: "Financial Details", order: 18, bindings: [] }
    ]
  },
  // =========================================================================
  // RECEIPT 7: LMP Group (Rita Palace)
  // =========================================================================
  {
    id: "master-receipt-7",
    name: "Receipt 7 - LMP Group (Rita Palace)",
    category: "Receipts",
    description: "Rita Palace (Borivali West) receipt format with unit and building coordinates, payment acknowledgment, instrument table, and office footer.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 9.5, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        companyTitle: { fontSize: 15, bold: true, alignment: "center", color: "#0f172a" },
        receiptTitle: { fontSize: 12, bold: true, alignment: "center", color: "#475569", margin: [0, 2, 0, 10] },
        tableHeader: { bold: true, fontSize: 9, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9 },
        signatory: { bold: true, fontSize: 9.5, color: "#0f172a" },
        footerText: { fontSize: 8, color: "#64748b", alignment: "center" }
      },
      content: [
        { text: "LMP GROUP RITA PALACE", style: "companyTitle" },
        { text: "RECEIPT", style: "receiptTitle" },
        {
          columns: [
            {
              stack: [
                { text: "Flat No: {{unit_name}} on Floor: {{unit_floor}}", bold: true },
                { text: "in Building: RITA PALACE Wing: {{unit_wing}}" },
                { text: "Project on {{site_address}}", color: "#334155" }
              ],
              width: "*"
            },
            {
              stack: [
                { text: "Receipt No. : {{receipt_number}}", bold: true },
                { text: "Date : {{payment_date}}" }
              ],
              width: 160,
              alignment: "right"
            }
          ],
          margin: [0, 0, 0, 12]
        },
        {
          stack: [
            { text: "Received with thanks from : {{customer_name}} {{remark}} \u20B9{{amount_paid}}", bold: true, fontSize: 10.5 },
            { text: "the sum of : {{amount_in_words}}", italics: true, color: "#334155", margin: [0, 4, 0, 4] },
            { text: "by as under as per details", color: "#64748b", fontSize: 8.5 }
          ],
          margin: [0, 0, 0, 12]
        },
        {
          table: {
            headerRows: 1,
            widths: [100, 120, 90, "*"],
            body: [
              [
                { text: "Amount", style: "tableHeader", alignment: "right" },
                { text: "Chq/ RTGS No.", style: "tableHeader" },
                { text: "Date", style: "tableHeader" },
                { text: "Name of Bank / Branch", style: "tableHeader" }
              ],
              [
                { text: "\u20B9{{amount_paid}}", style: "tableCell", bold: true, alignment: "right" },
                { text: "{{cheque_number}}", style: "tableCell" },
                { text: "{{cheque_date}}", style: "tableCell" },
                { text: "{{bank_name}}", style: "tableCell" }
              ]
            ]
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 14]
        },
        {
          text: "Subject to Realisation of Cheque",
          fontSize: 8.5,
          italics: true,
          color: "#64748b",
          margin: [0, 0, 0, 16]
        },
        {
          columns: [
            { text: "" },
            {
              stack: [
                { text: "For LMP GROUP RITA PALACE,", bold: true },
                { text: "Account department", margin: [0, 0, 0, 30] }
              ],
              alignment: "right",
              width: 190
            }
          ],
          margin: [0, 0, 0, 16]
        },
        {
          text: "This is auto generated receipt it doesn't require stamp",
          style: "footerText",
          italics: true,
          margin: [0, 0, 0, 8]
        },
        {
          text: "Off: Kahan Bhavan, L.T.road, Behind Diamond Cinema, next to Purohit Hospital , Borivali west Mumbai-92\n98200 49360 | Email: lmpgroup.rpchsl@gmail.com",
          style: "footerText"
        }
      ]
    },
    variables: [
      { id: "receipt_number", label: "Receipt No.", type: "text", defaultValue: "LMP/REC/2026/088", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "payment_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 1, bindings: [] },
      { id: "unit_name", label: "Flat No.", type: "text", defaultValue: "503", required: true, group: "Property Details", order: 2, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "5th", required: true, group: "Property Details", order: 3, bindings: [] },
      { id: "unit_wing", label: "Wing", type: "text", defaultValue: "A", required: true, group: "Property Details", order: 4, bindings: [] },
      { id: "site_address", label: "Project Site Address", type: "textarea", defaultValue: "Rita Palace, Harsha Park, Chandravarkar Road, Borivali West, Mumbai - 400092", required: true, group: "Project Details", order: 5, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Ketan Shah", required: true, group: "Customer Details", order: 6, bindings: [] },
      { id: "remark", label: "Remark", type: "text", defaultValue: "against Brickwork & Plaster milestone", required: false, group: "Document Details", order: 7, bindings: [] },
      { id: "amount_paid", label: "Amount Paid", type: "currency", defaultValue: 1188e3, required: true, group: "Financial Details", order: 8, bindings: [] },
      { id: "amount_in_words", label: "Amount in Words", type: "text", defaultValue: "Rupees Eleven Lakh Eighty Eight Thousand Only", required: true, group: "Financial Details", order: 9, bindings: [] },
      { id: "cheque_number", label: "Chq / RTGS No.", type: "text", defaultValue: "BARBN2026110298", required: true, group: "Bank Details", order: 10, bindings: [] },
      { id: "cheque_date", label: "Date", type: "date", defaultValue: "2026-11-02", required: true, group: "Bank Details", order: 11, bindings: [] },
      { id: "bank_name", label: "Bank / Branch", type: "text", defaultValue: "Bank of Baroda, Borivali West", required: true, group: "Bank Details", order: 12, bindings: [] }
    ]
  }
];

// server/seeds/masters.ts
function seedMasters(db2, adminUserId) {
  let userId = adminUserId;
  if (!userId) {
    const userRow = db2.prepare(`SELECT id FROM users ORDER BY role = 'admin' DESC, created_at ASC LIMIT 1`).get();
    userId = userRow?.id || "admin";
  }
  const mastersDir = path5.resolve("data", "masters");
  if (!fs4.existsSync(mastersDir)) {
    fs4.mkdirSync(mastersDir, { recursive: true });
  }
  const ts = nowIso();
  const results = [];
  for (const master of MASTERS) {
    const prepared = prepareDefinition(master.definition);
    const normalized = normalizeVariableList(master.variables);
    const syncedVars = syncBindings(prepared.definition, normalized.variables);
    const bundle = bundleFrom(prepared.definition, syncedVars);
    const jsonFileName = `${master.id.replace(/^master-/, "")}.json`;
    const jsonFilePath = path5.join(mastersDir, jsonFileName);
    fs4.writeFileSync(jsonFilePath, JSON.stringify(bundle, null, 2), "utf8");
    const existing = db2.prepare(`SELECT id FROM document_masters WHERE id = ?`).get(master.id);
    if (existing) {
      db2.prepare(
        `UPDATE document_masters SET
          name = ?,
          description = ?,
          category = ?,
          document_definition = ?,
          variable_schema = ?,
          warnings = ?,
          updated_at = ?
         WHERE id = ?`
      ).run(
        master.name,
        master.description,
        master.category,
        JSON.stringify(prepared.definition),
        JSON.stringify({ variables: syncedVars }),
        JSON.stringify(prepared.warnings),
        ts,
        master.id
      );
    } else {
      insertMaster(db2, {
        id: master.id,
        name: master.name,
        description: master.description,
        category: master.category,
        documentDefinition: JSON.stringify(prepared.definition),
        variableSchema: JSON.stringify({ variables: syncedVars }),
        warnings: JSON.stringify(prepared.warnings),
        createdBy: userId,
        createdAt: ts,
        updatedAt: ts
      });
    }
    results.push({ id: master.id, name: master.name, variablesCount: syncedVars.length });
  }
  return results;
}

// server/index.ts
var envPath = path6.resolve(process.cwd(), ".env");
if (fs5.existsSync(envPath)) {
  try {
    process.loadEnvFile?.(envPath);
  } catch {
  }
}
ensureDirs();
cleanupTemporaryFiles();
var db = openDatabase();
var email = process.env.ADMIN_EMAIL?.trim() || "admin@buildesk.local";
var password = process.env.ADMIN_PASSWORD || "Buildesk123!";
if (countUsers(db) === 0) {
  if (email && password.length >= 8) {
    createUser(db, { email, name: "Administrator", password, role: "admin" });
    console.log(JSON.stringify({ level: "info", message: "Created the initial administrator.", email }));
  }
}
seedMasters(db);
var app = createApp(db);
var dist = path6.resolve("dist");
if (fs5.existsSync(dist)) {
  app.use(express2.static(dist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path6.join(dist, "index.html"));
  });
}
var host = process.env.HOST || "0.0.0.0";
var port = Number(process.env.PORT || 8787);
var server = app.listen(port, host, () => {
  console.log(JSON.stringify({ level: "info", message: `Document Studio API listening on ${host}:${port}` }));
});
function shutdown(signal) {
  console.log(JSON.stringify({ level: "info", message: `Received ${signal}, shutting down gracefully...` }));
  server.close(() => {
    try {
      db.close();
    } catch {
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 1e4);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
