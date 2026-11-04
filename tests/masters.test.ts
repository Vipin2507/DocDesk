import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MASTERS } from "../server/masters-data";
import { openDatabase, createUser } from "../server/db";
import { seedMasters } from "../server/seeds/masters";
import { createFromMaster } from "../server/services/convert";
import { parseUploadedJson } from "../shared/document";
import { resolveDocument } from "../shared/binding";
import { renderPdf } from "../server/services/pdfmake";

describe("Sample Demand and Receipt Masters", () => {
  it("defines exactly 7 demand letter masters and 7 receipt masters", () => {
    expect(MASTERS).toHaveLength(14);
    const demandMasters = MASTERS.filter((m) => m.category === "Demand Letters");
    const receiptMasters = MASTERS.filter((m) => m.category === "Receipts");
    expect(demandMasters).toHaveLength(7);
    expect(receiptMasters).toHaveLength(7);
  });

  it("seeds all 14 masters into SQLite database and saves valid JSON bundles to data/masters", async () => {
    const db = openDatabase(":memory:");
    const user = createUser(db, { email: "admin@test.local", name: "Admin", password: "password123", role: "admin" });
    const seeded = seedMasters(db, user.id);
    expect(seeded).toHaveLength(14);

    const mastersDir = path.resolve("data", "masters");
    expect(fs.existsSync(mastersDir)).toBe(true);

    for (const master of MASTERS) {
      const fileName = `${master.id.replace(/^master-/, "")}.json`;
      const filePath = path.join(mastersDir, fileName);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, "utf8");
      const parsed = parseUploadedJson(content);
      expect(parsed.classification).toBe("bundle");
      expect(parsed.errors).toHaveLength(0);

      // Test creating a template draft from the master
      const template = createFromMaster(db, user, master.id);
      expect(template).not.toBeNull();
      expect(template?.name).toBe(master.name);
      expect(template?.category).toBe(master.category);

      const docDef = JSON.parse(template!.documentDefinition);
      const variables = JSON.parse(template!.variableSchema).variables;
      expect(variables.length).toBeGreaterThan(0);

      // Verify each variable is bound to at least one node in document definition
      const unbound = variables.filter((v: { bindings: unknown[] }) => !v.bindings || v.bindings.length === 0);
      expect(unbound).toHaveLength(0);

      // Verify document resolves with default values without strict errors
      const values: Record<string, unknown> = {};
      for (const v of variables) values[v.id] = v.defaultValue;
      const resolved = resolveDocument(docDef, variables, values, { strict: false });
      expect(resolved.errors).toHaveLength(0);

      // Verify PDF renders cleanly
      const pdfBuffer = await renderPdf(resolved.definition);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
    }

    db.close();
  });
});

