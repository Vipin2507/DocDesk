import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import path from "node:path";
import { blankDefinition, bundleFrom, parseUploadedJson, prepareDefinition } from "../shared/document";
import {
  addVariable,
  deleteVariable,
  linkOccurrences,
  moveVariable,
  normalizeVariableList,
  renameVariable,
  updateVariable,
} from "../shared/variables";
import { CATEGORIES, MAX_UPLOAD_BYTES } from "../shared/types";
import type { DocumentDefinition, VariableDefinition } from "../shared/types";
import {
  audit,
  createSession,
  deleteMaster,
  deletePreset,
  deleteSession,
  deleteTemplate,
  findUserByEmail,
  getGenerated,
  getJob,
  getMaster,
  getTemplate,
  getUpload,
  getVersion,
  insertPreset,
  insertUpload,
  listGenerated,
  listMasters,
  listPresets,
  listTemplates,
  listVersions,
  templateStats,
  updateTemplate,
  userForToken,
  type DB,
  type User,
} from "./db";
import { dataRoot } from "./storage";
import { aiStatus } from "./services/ai";
import { convertUpload, createDraft, createFromMaster, generateStored, queueConversion, renderResolved, saveMaster, storeUpload, suggestVariables } from "./services/convert";
import { AppError } from "./services/errors";
import { inspectPdf } from "./services/pdf-extract";
import bcrypt from "bcryptjs";

const COOKIE = "ds_session";

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

const buckets = new Map<string, { count: number; reset: number }>();

function rateLimit(name: string, limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
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
        error: { code: "RATE_LIMITED", message: "Too many requests. Wait a moment and try again." },
      });
    }
    next();
  };
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function requireUser(req: Request): User {
  if (!req.user) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return req.user;
}

function requireRole(user: User, roles: User["role"][]) {
  if (!roles.includes(user.role)) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to do that.");
  }
}

function sendError(res: Response, error: unknown) {
  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details ?? undefined },
    });
  }
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: { code: "FILE_TOO_LARGE", message: "Files must be 20 MB or smaller." } });
  }
  const message = error instanceof Error ? error.message : "unknown";
  console.error(JSON.stringify({ level: "error", message }));
  return res.status(500).json({
    error: { code: "INTERNAL", message: "Something went wrong while processing the document. Try again." },
  });
}

function presentList(row: NonNullable<ReturnType<typeof getTemplate>>) {
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
    hasOriginal: Boolean(row.originalFilePath),
  };
}

function presentTemplate(row: NonNullable<ReturnType<typeof getTemplate>>, db: DB) {
  const schema = JSON.parse(row.variableSchema) as { variables?: VariableDefinition[] };
  return {
    ...presentList(row),
    originalFileName: row.originalFileName,
    documentDefinition: JSON.parse(row.documentDefinition) as DocumentDefinition,
    variables: schema.variables ?? [],
    warnings: JSON.parse(row.warnings) as string[],
    presets: listPresets(db, row.id).map((preset) => ({
      id: preset.id,
      name: preset.name,
      values: JSON.parse(preset.variableValues) as Record<string, unknown>,
      createdAt: preset.createdAt,
    })),
  };
}

function readDefinition(body: { documentDefinition?: unknown }): DocumentDefinition {
  const prepared = prepareDefinition(body.documentDefinition);
  if (prepared.errors.length) {
    throw new AppError(422, "PDFMAKE_INVALID", "The document definition is not valid.", prepared.errors);
  }
  return prepared.definition;
}

function readVariables(body: { variables?: unknown; variableSchema?: unknown }): VariableDefinition[] {
  const normalized = normalizeVariableList(body.variables ?? body.variableSchema ?? []);
  if (normalized.errors.length) {
    throw new AppError(422, "VARIABLES_INVALID", normalized.errors[0] || "The variable schema is not valid.", normalized.errors);
  }
  return normalized.variables;
}

export function createApp(db: DB) {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });
  const origins = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173").split(",").map((item) => item.trim());
  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: "12mb" }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    const origin = req.headers.origin;
    if (!origin) return next();
    const host = `${req.protocol}://${req.get("host")}`;
    const cleanOrigin = origin.replace(/^https?:\/\//, "");
    const cleanHost = (req.get("host") || "").replace(/^https?:\/\//, "");
    if (origin === host || cleanOrigin === cleanHost || origins.includes(origin)) return next();
    return res.status(403).json({ error: { code: "ORIGIN", message: "This request was blocked." } });
  });
  app.use((req, _res, next) => {
    const token = req.cookies?.[COOKIE] as string | undefined;
    req.user = userForToken(db, token) ?? undefined;
    next();
  });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

  app.get(["/healthz", "/api/health"], (_req, res) => {
    res.json({ ok: true });
  });

  app.post(
    "/api/auth/login",
    rateLimit("login", 10, 10 * 60 * 1000),
    asyncRoute(async (req, res) => {
      const email = String(req.body?.email || "");
      const password = String(req.body?.password || "");
      const user = findUserByEmail(db, email);
      if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        throw new AppError(401, "INVALID_LOGIN", "The email or password is incorrect.");
      }
      const token = createSession(db, user.id);
      audit(db, { userId: user.id, action: "auth.login", entity: "user", entityId: user.id });
      res.cookie(COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE === "true",
        path: "/",
        maxAge: 7 * 864e5,
      });
      res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    }),
  );

  app.post("/api/auth/logout", (req, res) => {
    deleteSession(db, req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, { path: "/" });
    res.json({ ok: true });
  });

  app.get("/api/auth/me", (req, res) => {
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
      user: req.user,
    });
  });

  studio.get("/stats", (_req, res) => {
    res.json(templateStats(db));
  });

  studio.get("/templates", (req, res) => {
    const result = listTemplates(db, {
      q: String(req.query.q || ""),
      status: String(req.query.status || ""),
      category: String(req.query.category || ""),
      source: String(req.query.source || ""),
      sort: String(req.query.sort || "updated_at"),
      dir: String(req.query.dir || "desc"),
      page: Number(req.query.page || 1),
      pageSize: Number(req.query.pageSize || 10),
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
      const template = createDraft(db, user, {
        name,
        category: String(req.body?.category || "Custom Documents"),
        sourceType: "blank",
        definition,
        variables,
        warnings: [],
      });
      if (!template) throw new AppError(500, "INTERNAL", "The template could not be created.");
      res.status(201).json({ template: presentTemplate(template, db) });
    }),
  );

  studio.get(
    "/templates/:id",
    asyncRoute(async (req, res) => {
      const template = getTemplate(db, req.params.id);
      if (!template) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
      res.json({ template: presentTemplate(template, db) });
    }),
  );

  studio.put(
    "/templates/:id",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const current = getTemplate(db, req.params.id);
      if (!current) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
      const definition = req.body?.documentDefinition ? readDefinition(req.body) : JSON.parse(current.documentDefinition);
      const variables = req.body?.variables ? readVariables(req.body) : JSON.parse(current.variableSchema).variables;
      const status = ["draft", "active", "archived"].includes(req.body?.status) ? req.body.status : current.status;
      const category = CATEGORIES.includes(req.body?.category) ? req.body.category : current.category;
      const updated = updateTemplate(db, current.id, {
        name: String(req.body?.name || current.name).slice(0, 160),
        description: String(req.body?.description ?? current.description).slice(0, 500),
        category,
        status,
        documentDefinition: JSON.stringify(definition),
        variableSchema: JSON.stringify({ variables }),
        warnings: JSON.stringify(Array.isArray(req.body?.warnings) ? req.body.warnings.slice(0, 20) : JSON.parse(current.warnings)),
        updatedBy: user.id,
      });
      audit(db, { userId: user.id, action: "template.update", entity: "template", entityId: current.id });
      res.json({ template: presentTemplate(updated!, db) });
    }),
  );

  studio.delete(
    "/templates/:id",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin"]);
      const current = getTemplate(db, req.params.id);
      if (!current) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
      deleteTemplate(db, current.id);
      audit(db, { userId: user.id, action: "template.delete", entity: "template", entityId: current.id, meta: { name: current.name } });
      res.json({ ok: true });
    }),
  );

  studio.get("/templates/:id/versions", (req, res) => {
    if (!getTemplate(db, req.params.id)) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
    res.json({ versions: listVersions(db, req.params.id) });
  });

  studio.post(
    "/templates/:id/duplicate",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const current = getTemplate(db, req.params.id);
      if (!current) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
      const copy = createDraft(db, user, {
        name: `Copy of ${current.name}`.slice(0, 160),
        category: current.category,
        sourceType: current.sourceType as "pdf" | "json" | "blank",
        definition: JSON.parse(current.documentDefinition),
        variables: JSON.parse(current.variableSchema).variables,
        warnings: JSON.parse(current.warnings),
        originalPath: current.originalFilePath,
        originalName: current.originalFileName,
      });
      res.status(201).json({ template: presentTemplate(copy!, db) });
    }),
  );

  studio.post(
    "/templates/:id/restore",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const current = getTemplate(db, req.params.id);
      if (!current) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
      const version = getVersion(db, current.id, Number(req.body?.versionNumber));
      if (!version) throw new AppError(404, "NOT_FOUND", "That version does not exist.");
      const updated = updateTemplate(db, current.id, {
        documentDefinition: version.document_definition,
        variableSchema: version.variable_schema,
        updatedBy: user.id,
      });
      audit(db, {
        userId: user.id,
        action: "template.restore",
        entity: "template",
        entityId: current.id,
        meta: { version: version.version_number },
      });
      res.json({ template: presentTemplate(updated!, db) });
    }),
  );

  studio.get(
    "/templates/:id/original",
    asyncRoute(async (req, res) => {
      const template = getTemplate(db, req.params.id);
      if (!template?.originalFilePath) throw new AppError(404, "NOT_FOUND", "This template has no original file.");
      const resolved = path.resolve(template.originalFilePath);
      if (!resolved.startsWith(dataRoot())) throw new AppError(404, "NOT_FOUND", "This template has no original file.");
      const type = template.originalFileName?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/json";
      res.setHeader("Content-Type", type);
      res.setHeader("Content-Disposition", `inline; filename="${(template.originalFileName || "original").replace(/"/g, "")}"`);
      res.sendFile(resolved);
    }),
  );

  studio.post(
    "/templates/:id/presets",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor", "viewer"]);
      const template = getTemplate(db, req.params.id);
      if (!template) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
      const name = String(req.body?.name || "Preset").slice(0, 80);
      const id = insertPreset(db, { templateId: template.id, name, values: JSON.stringify(req.body?.values ?? {}), userId: user.id });
      res.status(201).json({ id, name });
    }),
  );

  studio.delete(
    "/templates/:id/presets/:presetId",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      deletePreset(db, req.params.id, req.params.presetId);
      res.json({ ok: true });
    }),
  );

  function presentMaster(row: NonNullable<ReturnType<typeof getMaster>>, detail = false) {
    const variables = JSON.parse(row.variableSchema).variables as VariableDefinition[];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      variableCount: variables.length,
      warnings: JSON.parse(row.warnings) as string[],
      createdBy: row.createdByName ?? "Unknown",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...(detail
        ? {
            documentDefinition: JSON.parse(row.documentDefinition) as DocumentDefinition,
            variables,
          }
        : {}),
    };
  }

  studio.get("/masters", (_req, res) => {
    res.json({ items: listMasters(db).map((row) => presentMaster(row)) });
  });

  studio.get(
    "/masters/:id",
    asyncRoute(async (req, res) => {
      const master = getMaster(db, req.params.id);
      if (!master) throw new AppError(404, "NOT_FOUND", "That master format no longer exists.");
      res.json({ master: presentMaster(master, true) });
    }),
  );

  studio.post(
    "/masters",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const json = typeof req.body?.json === "string" ? req.body.json : JSON.stringify(req.body?.documentDefinition ?? req.body?.json ?? "");
      if (!json || json === '""') throw new AppError(400, "JSON_REQUIRED", "Paste a JSON document definition to save a master.");
      const master = saveMaster(db, user, {
        name: req.body?.name,
        category: req.body?.category,
        description: req.body?.description,
        json,
      });
      if (!master) throw new AppError(500, "INTERNAL", "The master could not be saved.");
      res.status(201).json({ master: presentMaster(master, true) });
    }),
  );

  studio.post(
    "/masters/:id/use",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const template = createFromMaster(db, user, req.params.id);
      if (!template) throw new AppError(500, "INTERNAL", "The document could not be created.");
      res.status(201).json({ template: presentTemplate(template, db) });
    }),
  );

  studio.delete(
    "/masters/:id",
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin"]);
      const master = getMaster(db, req.params.id);
      if (!master) throw new AppError(404, "NOT_FOUND", "That master format no longer exists.");
      deleteMaster(db, master.id);
      audit(db, { userId: user.id, action: "master.delete", entity: "master", entityId: master.id, meta: { name: master.name } });
      res.json({ ok: true });
    }),
  );

  studio.post(
    "/upload",
    rateLimit("upload", 30, 60_000),
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
        const id = insertUpload(db, {
          userId: user.id,
          originalName: name,
          storedPath: stored,
          mime: "application/pdf",
          size: file.size,
          kind: "pdf",
          pageCount: info.pageCount,
        });
        audit(db, { userId: user.id, action: "upload.pdf", entity: "upload", entityId: id });
        return res.status(201).json({ uploadId: id, kind: "pdf", filename: name, size: file.size, pageCount: info.pageCount });
      }
      if (lower.endsWith(".json") || file.mimetype.includes("json") || file.mimetype.startsWith("text/")) {
        const parsed = parseUploadedJson(file.buffer.toString("utf8"));
        if (parsed.classification === "script" || parsed.classification === "invalid") {
          throw new AppError(400, "JSON_INVALID", parsed.errors[0]?.message || "The JSON file is not valid.", parsed.errors);
        }
        const stored = storeUpload(file.buffer, ".json");
        const id = insertUpload(db, {
          userId: user.id,
          originalName: name,
          storedPath: stored,
          mime: "application/json",
          size: file.size,
          kind: "json",
          pageCount: null,
        });
        audit(db, { userId: user.id, action: "upload.json", entity: "upload", entityId: id, meta: { classification: parsed.classification } });
        return res.status(201).json({
          uploadId: id,
          kind: "json",
          filename: name,
          size: file.size,
          classification: parsed.classification,
          errors: parsed.errors,
        });
      }
      throw new AppError(400, "FILE_TYPE", "Upload a PDF or a JSON file.");
    }),
  );

  studio.post(
    "/convert",
    rateLimit("convert", 20, 60_000),
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const uploadId = String(req.body?.uploadId || "");
      const mode = String(req.body?.mode || "standard");
      const upload = getUpload(db, uploadId, user.id);
      if (!upload) throw new AppError(404, "NOT_FOUND", "That upload could not be found. Please upload the file again.");
      const large = (upload.page_count ?? 0) > 15 || upload.size_bytes > 8 * 1024 * 1024;
      if (large) {
        const jobId = queueConversion(db, user, uploadId, mode);
        return res.status(202).json({ mode: "queued", jobId });
      }
      const template = await convertUpload(db, user, uploadId, mode);
      if (!template) throw new AppError(500, "INTERNAL", "The document could not be created.");
      res.json({ mode: "inline", template: presentTemplate(template, db) });
    }),
  );

  studio.get("/jobs/:id", (req, res) => {
    const user = requireUser(req);
    const job = getJob(db, req.params.id, user.id);
    if (!job) throw new AppError(404, "NOT_FOUND", "That conversion job was not found.");
    res.json({
      id: job.id,
      status: job.status,
      error: job.error,
      templateId: job.result ? (JSON.parse(job.result).templateId as string | undefined) : undefined,
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
          message: "This JSON is valid, but it is not a PDFMake document definition.",
        });
      }
      const prepared = prepareDefinition(parsed.definition);
      res.json({
        classification: parsed.classification,
        valid: prepared.errors.length === 0,
        errors: prepared.errors,
        warnings: prepared.warnings,
      });
    }),
  );

  studio.post(
    "/extract-variables",
    rateLimit("ai", 10, 60_000),
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      requireRole(user, ["admin", "editor"]);
      const definition = readDefinition(req.body);
      const result = await suggestVariables(definition, String(req.body?.mode || "heuristic"));
      res.json(result);
    }),
  );

  studio.post(
    "/preview",
    rateLimit("preview", 40, 60_000),
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
    }),
  );

  studio.post(
    "/generate",
    rateLimit("generate", 20, 60_000),
    asyncRoute(async (req, res) => {
      const user = requireUser(req);
      const definition = readDefinition(req.body);
      const variables = readVariables(req.body);
      const generated = await generateStored(db, user, {
        templateId: req.body?.templateId ?? null,
        templateName: String(req.body?.templateName || "Document"),
        definition,
        variables,
        values: req.body?.values ?? {},
        save: req.body?.save !== false,
      });
      if (req.body?.download === true || req.query.download === "1") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${generated.fileName}"`);
        return res.send(generated.buffer);
      }
      res.json({ id: generated.id, fileName: generated.fileName, warnings: generated.warnings });
    }),
  );

  studio.get("/generated", (req, res) => {
    requireUser(req);
    res.json(listGenerated(db, Number(req.query.page || 1), Number(req.query.pageSize || 10)));
  });

  studio.get(
    "/generated/:id/file",
    asyncRoute(async (req, res) => {
      requireUser(req);
      const row = getGenerated(db, req.params.id);
      if (!row) throw new AppError(404, "NOT_FOUND", "That generated document was not found.");
      const resolved = path.resolve(row.generated_file_path);
      if (!resolved.startsWith(dataRoot())) throw new AppError(404, "NOT_FOUND", "That generated document was not found.");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${row.file_name.replace(/"/g, "")}"`);
      res.sendFile(resolved);
    }),
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
    }),
  );

  studio.get("/bundle/:id", (req, res) => {
    const template = getTemplate(db, req.params.id);
    if (!template) throw new AppError(404, "NOT_FOUND", "This template no longer exists.");
    const definition = JSON.parse(template.documentDefinition) as DocumentDefinition;
    const variables = (JSON.parse(template.variableSchema) as { variables: VariableDefinition[] }).variables;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${template.name.replace(/[^\w.-]+/g, "_")}.json"`);
    res.send(JSON.stringify(bundleFrom(definition, variables), null, 2));
  });

  app.use("/api/document-studio", studio);

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    sendError(res, error);
  });

  return app;
}
