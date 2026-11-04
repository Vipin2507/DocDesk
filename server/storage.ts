import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function projectRoot(): string {
  return process.cwd();
}

export function dataRoot(): string {
  const configured = process.env.DATA_DIR;
  return configured ? path.resolve(configured) : path.resolve(projectRoot(), "data");
}

export function ensureDirs(): void {
  for (const folder of ["uploads", "generated", "tmp"]) {
    fs.mkdirSync(path.join(dataRoot(), folder), { recursive: true });
  }
}

export function databasePath(): string {
  if (process.env.DATABASE_URL) {
    const configured = process.env.DATABASE_URL;
    const file = configured.startsWith("file:") ? configured.slice("file:".length) : configured;
    return path.isAbsolute(file) ? file : path.resolve(projectRoot(), file);
  }
  return path.join(dataRoot(), "document-studio.db");
}

export function newStoredName(extension: string): string {
  return `${crypto.randomUUID()}${extension}`;
}

export function writeUpload(buffer: Buffer, extension: string): string {
  ensureDirs();
  const name = newStoredName(extension);
  const full = path.join(dataRoot(), "uploads", name);
  fs.writeFileSync(full, buffer);
  return full;
}

export function writeGenerated(buffer: Buffer): string {
  ensureDirs();
  const full = path.join(dataRoot(), "generated", newStoredName(".pdf"));
  fs.writeFileSync(full, buffer);
  return full;
}

export function readFile(file: string): Buffer {
  return fs.readFileSync(file);
}

export function removeFile(file: string | null | undefined): void {
  if (!file) return;
  const root = dataRoot();
  const resolved = path.resolve(file);
  if (!resolved.startsWith(root)) return;
  fs.rmSync(resolved, { force: true });
}

export function cleanupTemporaryFiles(maxAgeMs = 24 * 60 * 60 * 1000): void {
  const folder = path.join(dataRoot(), "tmp");
  if (!fs.existsSync(folder)) return;
  const now = Date.now();
  for (const name of fs.readdirSync(folder)) {
    const full = path.join(folder, name);
    try {
      const stat = fs.statSync(full);
      if (now - stat.mtimeMs > maxAgeMs) fs.rmSync(full, { force: true });
    } catch {
      /* a file can disappear between read and delete */
    }
  }
}
