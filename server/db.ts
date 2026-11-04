import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { databasePath } from "./storage";

export type Role = "admin" | "editor" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface TemplateRow {
  id: string;
  name: string;
  description: string;
  category: string;
  sourceType: string;
  originalFilePath: string | null;
  originalFileName: string | null;
  documentDefinition: string;
  variableSchema: string;
  version: number;
  status: string;
  warnings: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  updatedByName?: string;
}

const SCHEMA = `
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

export type DB = Database.Database;

export function openDatabase(file = databasePath()): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  if (file !== ":memory:") db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createUser(
  db: DB,
  input: { email: string; name: string; password: string; role: Role },
): User {
  const user: User = {
    id: crypto.randomUUID(),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    role: input.role,
    createdAt: nowIso(),
  };
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(user.id, user.email, user.name, bcrypt.hashSync(input.password, 10), user.role, user.createdAt);
  return user;
}

export function countUsers(db: DB): number {
  return (db.prepare(`SELECT COUNT(*) AS count FROM users`).get() as { count: number }).count;
}

export function findUserByEmail(db: DB, email: string): (User & { passwordHash: string }) | null {
  const row = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.trim().toLowerCase()) as
    | Record<string, string>
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as Role,
    createdAt: row.created_at,
    passwordHash: row.password_hash,
  };
}

export function findUserById(db: DB, id: string): User | null {
  const row = db.prepare(`SELECT id, email, name, role, created_at FROM users WHERE id = ?`).get(id) as
    | Record<string, string>
    | undefined;
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role as Role, createdAt: row.created_at };
}

export function createSession(db: DB, userId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  db.prepare(`INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    crypto.randomUUID(),
    userId,
    tokenHash,
    new Date(Date.now() + 7 * 864e5).toISOString(),
    nowIso(),
  );
  return token;
}

export function userForToken(db: DB, token: string | undefined): User | null {
  if (!token) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, nowIso()) as Record<string, string> | undefined;
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role as Role, createdAt: row.created_at };
}

export function deleteSession(db: DB, token: string | undefined): void {
  if (!token) return;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
}

export function audit(
  db: DB,
  entry: { userId?: string | null; action: string; entity: string; entityId?: string | null; meta?: unknown },
): void {
  db.prepare(`INSERT INTO audit_logs (id, user_id, action, entity, entity_id, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    crypto.randomUUID(),
    entry.userId ?? null,
    entry.action,
    entry.entity,
    entry.entityId ?? null,
    JSON.stringify(entry.meta ?? {}),
    nowIso(),
  );
}

export function insertUpload(
  db: DB,
  input: {
    userId: string;
    originalName: string;
    storedPath: string;
    mime: string;
    size: number;
    kind: string;
    pageCount: number | null;
  },
): string {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO uploads (id, user_id, original_name, stored_path, mime, size_bytes, kind, page_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.userId, input.originalName, input.storedPath, input.mime, input.size, input.kind, input.pageCount, nowIso());
  return id;
}

export function getUpload(db: DB, id: string, userId: string) {
  return db.prepare(`SELECT * FROM uploads WHERE id = ? AND user_id = ?`).get(id, userId) as
    | {
        id: string;
        original_name: string;
        stored_path: string;
        mime: string;
        size_bytes: number;
        kind: string;
        page_count: number | null;
      }
    | undefined;
}

function mapTemplate(row: Record<string, unknown>): TemplateRow {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    category: String(row.category),
    sourceType: String(row.source_type),
    originalFilePath: (row.original_file_path as string | null) ?? null,
    originalFileName: (row.original_file_name as string | null) ?? null,
    documentDefinition: String(row.document_definition),
    variableSchema: String(row.variable_schema),
    version: Number(row.version),
    status: String(row.status),
    warnings: String(row.warnings ?? "[]"),
    createdBy: String(row.created_by),
    updatedBy: String(row.updated_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdByName: row.created_by_name ? String(row.created_by_name) : undefined,
    updatedByName: row.updated_by_name ? String(row.updated_by_name) : undefined,
  };
}

const TEMPLATE_SELECT = `
  SELECT t.*, cu.name AS created_by_name, uu.name AS updated_by_name
  FROM templates t
  JOIN users cu ON cu.id = t.created_by
  JOIN users uu ON uu.id = t.updated_by
`;

export function insertTemplate(
  db: DB,
  input: Omit<TemplateRow, "createdByName" | "updatedByName">,
): void {
  db.prepare(
    `INSERT INTO templates (
      id, name, description, category, source_type, original_file_path, original_file_name,
      document_definition, variable_schema, version, status, warnings, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    input.updatedAt,
  );
  db.prepare(
    `INSERT INTO template_versions (id, template_id, version_number, document_definition, variable_schema, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), input.id, input.version, input.documentDefinition, input.variableSchema, input.createdBy, input.createdAt);
}

export function getTemplate(db: DB, id: string): TemplateRow | null {
  const row = db.prepare(`${TEMPLATE_SELECT} WHERE t.id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? mapTemplate(row) : null;
}

export function updateTemplate(db: DB, id: string, patch: Partial<TemplateRow> & { updatedBy: string }): TemplateRow | null {
  const current = getTemplate(db, id);
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  };
  const definitionChanged =
    next.documentDefinition !== current.documentDefinition || next.variableSchema !== current.variableSchema;
  if (definitionChanged) next.version = current.version + 1;
  db.prepare(
    `UPDATE templates SET name = ?, description = ?, category = ?, document_definition = ?, variable_schema = ?,
      version = ?, status = ?, warnings = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
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
    id,
  );
  if (definitionChanged) {
    db.prepare(
      `INSERT INTO template_versions (id, template_id, version_number, document_definition, variable_schema, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(crypto.randomUUID(), id, next.version, next.documentDefinition, next.variableSchema, next.updatedBy, next.updatedAt);
  }
  return getTemplate(db, id);
}

const SORTS: Record<string, string> = {
  updated_at: "t.updated_at",
  created_at: "t.created_at",
  name: "t.name",
  status: "t.status",
  category: "t.category",
};

export function listTemplates(
  db: DB,
  query: { q?: string; status?: string; category?: string; source?: string; sort?: string; dir?: string; page?: number; pageSize?: number },
) {
  const where: string[] = [];
  const params: unknown[] = [];
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
  const total = (db.prepare(`SELECT COUNT(*) AS count FROM templates t JOIN users cu ON cu.id = t.created_by ${clause}`).get(...params) as { count: number }).count;
  const rows = db
    .prepare(`${TEMPLATE_SELECT} ${clause} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as Record<string, unknown>[];
  return { items: rows.map(mapTemplate), total, page, pageSize };
}

export function templateStats(db: DB) {
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const count = (sql: string, ...params: unknown[]) =>
    (db.prepare(sql).get(...params) as { count: number }).count;
  return {
    totalTemplates: count(`SELECT COUNT(*) AS count FROM templates`),
    totalGenerated: count(`SELECT COUNT(*) AS count FROM generated_documents`),
    recentlyModified: count(`SELECT COUNT(*) AS count FROM templates WHERE updated_at >= ?`, weekAgo),
    draftTemplates: count(`SELECT COUNT(*) AS count FROM templates WHERE status = 'draft'`),
    activeTemplates: count(`SELECT COUNT(*) AS count FROM templates WHERE status = 'active'`),
  };
}

export function deleteTemplate(db: DB, id: string): void {
  db.prepare(`UPDATE generated_documents SET template_id = NULL WHERE template_id = ?`).run(id);
  db.prepare(`DELETE FROM data_presets WHERE template_id = ?`).run(id);
  db.prepare(`DELETE FROM template_versions WHERE template_id = ?`).run(id);
  db.prepare(`DELETE FROM templates WHERE id = ?`).run(id);
}

export function listVersions(db: DB, templateId: string) {
  return db
    .prepare(
      `SELECT v.id, v.version_number AS versionNumber, v.created_at AS createdAt, u.name AS createdByName
       FROM template_versions v LEFT JOIN users u ON u.id = v.created_by
       WHERE v.template_id = ? ORDER BY v.version_number DESC`,
    )
    .all(templateId) as { id: string; versionNumber: number; createdAt: string; createdByName: string | null }[];
}

export function getVersion(db: DB, templateId: string, versionNumber: number) {
  return db
    .prepare(`SELECT * FROM template_versions WHERE template_id = ? AND version_number = ?`)
    .get(templateId, versionNumber) as
    | { document_definition: string; variable_schema: string; version_number: number }
    | undefined;
}

export function insertGenerated(
  db: DB,
  input: {
    templateId: string | null;
    templateName: string;
    documentName: string;
    fileName: string;
    values: string;
    filePath: string;
    userId: string;
  },
): string {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO generated_documents (
      id, template_id, template_name, document_name, file_name, variable_values, generated_file_path, generated_by, generated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.templateId, input.templateName, input.documentName, input.fileName, input.values, input.filePath, input.userId, nowIso());
  return id;
}

export function listGenerated(db: DB, page = 1, pageSize = 10) {
  const size = Math.min(50, Math.max(1, pageSize));
  const current = Math.max(1, page);
  const total = (db.prepare(`SELECT COUNT(*) AS count FROM generated_documents`).get() as { count: number }).count;
  const items = db
    .prepare(
      `SELECT g.id, g.template_id AS templateId, g.template_name AS templateName, g.document_name AS documentName,
              g.file_name AS fileName, g.generated_at AS generatedAt, u.name AS generatedByName
       FROM generated_documents g LEFT JOIN users u ON u.id = g.generated_by
       ORDER BY g.generated_at DESC LIMIT ? OFFSET ?`,
    )
    .all(size, (current - 1) * size);
  return { items, total, page: current, pageSize: size };
}

export function getGenerated(db: DB, id: string) {
  return db.prepare(`SELECT * FROM generated_documents WHERE id = ?`).get(id) as
    | { id: string; file_name: string; generated_file_path: string; document_name: string }
    | undefined;
}

export function listPresets(db: DB, templateId: string) {
  return db
    .prepare(
      `SELECT id, name, variable_values AS variableValues, created_at AS createdAt
       FROM data_presets WHERE template_id = ? ORDER BY created_at DESC`,
    )
    .all(templateId) as { id: string; name: string; variableValues: string; createdAt: string }[];
}

export function insertPreset(db: DB, input: { templateId: string; name: string; values: string; userId: string }): string {
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO data_presets (id, template_id, name, variable_values, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    id,
    input.templateId,
    input.name,
    input.values,
    input.userId,
    nowIso(),
  );
  return id;
}

export function deletePreset(db: DB, templateId: string, presetId: string): void {
  db.prepare(`DELETE FROM data_presets WHERE id = ? AND template_id = ?`).run(presetId, templateId);
}

export function insertJob(db: DB, userId: string): string {
  const id = crypto.randomUUID();
  const ts = nowIso();
  db.prepare(`INSERT INTO jobs (id, user_id, status, created_at, updated_at) VALUES (?, ?, 'processing', ?, ?)`).run(id, userId, ts, ts);
  return id;
}

export function finishJob(db: DB, id: string, result: unknown): void {
  db.prepare(`UPDATE jobs SET status = 'completed', result = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(result), nowIso(), id);
}

export function failJob(db: DB, id: string, message: string): void {
  db.prepare(`UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`).run(message, nowIso(), id);
}

export interface MasterRow {
  id: string;
  name: string;
  description: string;
  category: string;
  documentDefinition: string;
  variableSchema: string;
  warnings: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
}

function mapMaster(row: Record<string, unknown>): MasterRow {
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
    createdByName: row.created_by_name ? String(row.created_by_name) : undefined,
  };
}

export function insertMaster(
  db: DB,
  input: Omit<MasterRow, "createdByName">,
): void {
  db.prepare(
    `INSERT INTO document_masters (
      id, name, description, category, document_definition, variable_schema, warnings, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    input.updatedAt,
  );
}

export function listMasters(db: DB): MasterRow[] {
  const rows = db
    .prepare(
      `SELECT m.*, u.name AS created_by_name
       FROM document_masters m JOIN users u ON u.id = m.created_by
       ORDER BY m.name COLLATE NOCASE`,
    )
    .all() as Record<string, unknown>[];
  return rows.map(mapMaster);
}

export function getMaster(db: DB, id: string): MasterRow | null {
  const row = db
    .prepare(
      `SELECT m.*, u.name AS created_by_name
       FROM document_masters m JOIN users u ON u.id = m.created_by
       WHERE m.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapMaster(row) : null;
}

export function deleteMaster(db: DB, id: string): void {
  db.prepare(`DELETE FROM document_masters WHERE id = ?`).run(id);
}

export function getJob(db: DB, id: string, userId: string) {
  return db.prepare(`SELECT id, status, result, error, created_at AS createdAt FROM jobs WHERE id = ? AND user_id = ?`).get(id, userId) as
    | { id: string; status: string; result: string | null; error: string | null; createdAt: string }
    | undefined;
}
