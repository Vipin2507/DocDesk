import crypto from "node:crypto";
import fs from "node:fs";
import { initialValues, primaryFilenameValue, resolveDocument } from "../../shared/binding";
import { buildPdfFilename } from "../../shared/format";
import { genericJsonToDefinition, parseUploadedJson, prepareDefinition } from "../../shared/document";
import { applyAiCandidates, extractVariables, normalizeVariableList, syncBindings } from "../../shared/variables";
import type { DocumentDefinition, VariableDefinition } from "../../shared/types";
import { CATEGORIES } from "../../shared/types";
import {
  audit,
  finishJob,
  failJob,
  getMaster,
  getTemplate,
  getUpload,
  insertGenerated,
  insertJob,
  insertMaster,
  insertTemplate,
  nowIso,
  type DB,
  type User,
} from "../db";
import { readFile, removeFile, writeGenerated, writeUpload } from "../storage";
import { detectVariablesWithAi, reconstructWithAi } from "./ai";
import { AppError } from "./errors";
import { extractPdf } from "./pdf-extract";
import { pagesToDefinition } from "./layout";
import { renderPdf } from "./pdfmake";

function titleFrom(filename: string): string {
  return filename.replace(/\.(pdf|json)$/i, "").replace(/[_-]+/g, " ").trim() || "Untitled document";
}

function categoryFor(name: string): string {
  const found = CATEGORIES.find((category) => name.toLowerCase().includes(category.toLowerCase().replace(/s$/, "")));
  return found || "Custom Documents";
}

export function createDraft(
  db: DB,
  user: User,
  input: {
    name: string;
    category?: string;
    sourceType: "pdf" | "json" | "blank";
    definition: DocumentDefinition;
    variables: VariableDefinition[];
    warnings: string[];
    originalPath?: string | null;
    originalName?: string | null;
    description?: string;
  },
) {
  const ts = nowIso();
  const id = crypto.randomUUID();
  insertTemplate(db, {
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
    updatedAt: ts,
  });
  audit(db, { userId: user.id, action: "template.create", entity: "template", entityId: id, meta: { source: input.sourceType } });
  return getTemplate(db, id);
}

export async function convertUpload(db: DB, user: User, uploadId: string, mode: string) {
  const upload = getUpload(db, uploadId, user.id);
  if (!upload) throw new AppError(404, "NOT_FOUND", "That upload could not be found. Please upload the file again.");
  const buffer = readFile(upload.stored_path);
  if (upload.kind === "pdf") {
    if (mode !== "standard" && mode !== "ai") {
      throw new AppError(400, "MODE", "Choose standard extraction or AI reconstruction for a PDF.");
    }
    const extracted = await extractPdf(buffer);
    if (mode === "ai") {
      const ai = await reconstructWithAi(extracted.pages);
      return createDraft(db, user, {
        name: titleFrom(upload.original_name),
        sourceType: "pdf",
        definition: ai.definition,
        variables: ai.variables,
        warnings: ai.warnings,
        originalPath: upload.stored_path,
        originalName: upload.original_name,
      });
    }
    const layout = pagesToDefinition(extracted.pages);
    const prepared = prepareDefinition(layout.definition);
    if (prepared.errors.length) {
      throw new AppError(422, "RECONSTRUCTION_FAILED", "The PDF could not be turned into a valid document definition.", prepared.errors);
    }
    const extractedVars = extractVariables(prepared.definition);
    return createDraft(db, user, {
      name: titleFrom(upload.original_name),
      sourceType: "pdf",
      definition: extractedVars.definition,
      variables: extractedVars.variables,
      warnings: [...layout.warnings, ...prepared.warnings],
      originalPath: upload.stored_path,
      originalName: upload.original_name,
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
    const prepared = prepareDefinition(generated);
    const vars = extractVariables(prepared.definition);
    return createDraft(db, user, {
      name: titleFrom(upload.original_name),
      sourceType: "json",
      definition: vars.definition,
      variables: vars.variables,
      warnings: ["Generic JSON was imported as a field table. It is not a designed document layout.", ...prepared.warnings],
      originalPath: upload.stored_path,
      originalName: upload.original_name,
    });
  }

  const prepared = prepareDefinition(parsed.definition);
  if (prepared.errors.length) {
    throw new AppError(422, "PDFMAKE_INVALID", "The PDFMake definition is not valid.", prepared.errors);
  }
  const normalized = parsed.classification === "bundle" ? normalizeVariableList(parsed.variables) : { variables: [], errors: [] };
  const withVariables =
    parsed.classification === "bundle" && normalized.variables.length
      ? { definition: prepared.definition, variables: syncBindings(prepared.definition, normalized.variables) }
      : extractVariables(prepared.definition);
  return createDraft(db, user, {
    name: titleFrom(upload.original_name),
    sourceType: "json",
    definition: withVariables.definition,
    variables: withVariables.variables,
    warnings: [
      ...(parsed.classification === "bundle"
        ? ["The JSON bundle was loaded without rewriting an existing variable schema."]
        : []),
      ...prepared.warnings,
      ...normalized.errors,
    ],
    originalPath: upload.stored_path,
    originalName: upload.original_name,
  });
}

function documentFromJson(raw: string, fallbackName: string) {
  const parsed = parseUploadedJson(raw);
  if (parsed.classification === "script" || parsed.classification === "invalid") {
    throw new AppError(400, "JSON_INVALID", parsed.errors[0]?.message || "The JSON could not be imported.", parsed.errors);
  }
  if (parsed.classification === "generic") {
    const generated = genericJsonToDefinition(parsed.value, fallbackName);
    const prepared = prepareDefinition(generated);
    const vars = extractVariables(prepared.definition);
    return {
      definition: vars.definition,
      variables: vars.variables,
      warnings: ["Generic JSON was imported as a field table. It is not a designed document layout.", ...prepared.warnings],
    };
  }
  const prepared = prepareDefinition(parsed.definition);
  if (prepared.errors.length) {
    throw new AppError(422, "PDFMAKE_INVALID", "The PDFMake definition is not valid.", prepared.errors);
  }
  const normalized = parsed.classification === "bundle" ? normalizeVariableList(parsed.variables) : { variables: [], errors: [] as string[] };
  const withVariables =
    parsed.classification === "bundle" && normalized.variables.length
      ? { definition: prepared.definition, variables: syncBindings(prepared.definition, normalized.variables) }
      : extractVariables(prepared.definition);
  return {
    definition: withVariables.definition,
    variables: withVariables.variables,
    warnings: [...prepared.warnings, ...normalized.errors],
  };
}

export function saveMaster(
  db: DB,
  user: User,
  input: { name?: string; category?: string; description?: string; json: string },
) {
  const name = String(input.name || "").trim().slice(0, 160) || "Untitled master";
  const built = documentFromJson(input.json, name);
  const ts = nowIso();
  const id = crypto.randomUUID();
  insertMaster(db, {
    id,
    name,
    description: String(input.description || "").slice(0, 500),
    category: input.category && CATEGORIES.includes(input.category as (typeof CATEGORIES)[number]) ? input.category : categoryFor(name),
    documentDefinition: JSON.stringify(built.definition),
    variableSchema: JSON.stringify({ variables: built.variables }),
    warnings: JSON.stringify(built.warnings),
    createdBy: user.id,
    createdAt: ts,
    updatedAt: ts,
  });
  audit(db, { userId: user.id, action: "master.create", entity: "master", entityId: id, meta: { name } });
  return getMaster(db, id);
}

export function createFromMaster(db: DB, user: User, masterId: string) {
  const master = getMaster(db, masterId);
  if (!master) throw new AppError(404, "NOT_FOUND", "That master format no longer exists.");
  const template = createDraft(db, user, {
    name: master.name,
    category: master.category,
    description: `Created from master: ${master.name}`,
    sourceType: "json",
    definition: JSON.parse(master.documentDefinition),
    variables: JSON.parse(master.variableSchema).variables,
    warnings: JSON.parse(master.warnings),
  });
  audit(db, { userId: user.id, action: "master.use", entity: "master", entityId: master.id, meta: { templateId: template?.id } });
  return template;
}

export function queueConversion(db: DB, user: User, uploadId: string, mode: string): string {
  const jobId = insertJob(db, user.id);
  setTimeout(() => {
    convertUpload(db, user, uploadId, mode)
      .then((template) => finishJob(db, jobId, { templateId: template?.id }))
      .catch((error: unknown) => {
        const message = error instanceof AppError ? error.message : "The conversion failed.";
        failJob(db, jobId, message);
      });
  }, 20);
  return jobId;
}

export async function renderResolved(
  definition: DocumentDefinition,
  variables: VariableDefinition[],
  values: Record<string, unknown>,
  strict: boolean,
): Promise<{ buffer: Buffer; errors: { path: string; message: string }[]; warnings: string[] }> {
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

export async function generateStored(
  db: DB,
  user: User,
  input: {
    templateId?: string | null;
    templateName: string;
    definition: DocumentDefinition;
    variables: VariableDefinition[];
    values: Record<string, unknown>;
    save: boolean;
  },
) {
  const rendered = await renderResolved(input.definition, input.variables, input.values, true);
  if (rendered.errors.length) {
    throw new AppError(422, "VALIDATION", "Fill the required fields before generating the PDF.", rendered.errors);
  }
  const fileName = buildPdfFilename(input.templateName, primaryFilenameValue(input.variables, input.values));
  let id: string | null = null;
  if (input.save) {
    const filePath = writeGenerated(rendered.buffer);
    id = insertGenerated(db, {
      templateId: input.templateId ?? null,
      templateName: input.templateName,
      documentName: fileName.replace(/\.pdf$/i, "").replace(/_/g, " "),
      fileName,
      values: JSON.stringify(input.values),
      filePath,
      userId: user.id,
    });
    audit(db, { userId: user.id, action: "document.generate", entity: "generated_document", entityId: id, meta: { templateId: input.templateId } });
  }
  return { id, fileName, buffer: rendered.buffer, warnings: rendered.warnings };
}

export async function suggestVariables(definition: DocumentDefinition, mode: string) {
  if (mode !== "ai") return { ...extractVariables(definition), warnings: [] as string[] };
  const text = JSON.stringify(definition.content);
  const candidates = await detectVariablesWithAi(definition, text);
  const applied = applyAiCandidates(definition, candidates);
  if (!applied.variables.length) {
    const heuristic = extractVariables(definition);
    return {
      ...heuristic,
      warnings: ["AI did not return variables that appear in the document. Heuristic detection was kept."],
    };
  }
  return { ...applied, warnings: [] as string[] };
}

export function removeStored(file: string | null): void {
  if (!file) return;
  if (fs.existsSync(file)) removeFile(file);
}

export function storeUpload(buffer: Buffer, extension: string): string {
  return writeUpload(buffer, extension);
}

export function valuesOf(variables: VariableDefinition[]): Record<string, unknown> {
  return initialValues(variables);
}
