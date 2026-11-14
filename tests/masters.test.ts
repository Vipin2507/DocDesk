import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MASTER_CATALOG } from "../server/masters-catalog";
import { openDatabase, createUser } from "../server/db";
import { seedMasters } from "../server/seeds/masters";
import { createFromMaster } from "../server/services/convert";
import { parseUploadedJson } from "../shared/document";
import { resolveDocument } from "../shared/binding";
import { renderPdf } from "../server/services/pdfmake";

describe("Sample Demand and Receipt Masters", () => {
  it("defines exactly 7 demand letter masters and 7 receipt masters", () => {
    expect(MASTER_CATALOG).toHaveLength(14);
    expect(MASTER_CATALOG.filter((item) => item.category === "Demand Letters")).toHaveLength(7);
    expect(MASTER_CATALOG.filter((item) => item.category === "Receipts")).toHaveLength(7);
  });

  it("seeds all 14 exact PDF masters and renders from their variables", async () => {
    const mastersDir = path.resolve("data", "masters");
    for (const master of MASTER_CATALOG) {
      const filePath = path.join(mastersDir, `${master.id.replace(/^master-/, "")}.json`);
      expect(fs.existsSync(filePath), `Missing ${filePath}. Run npm run masters:rebuild`).toBe(true);
    }

    const db = openDatabase(":memory:");
    const user = createUser(db, { email: "admin@test.local", name: "Admin", password: "password123", role: "admin" });
    const seeded = seedMasters(db, user.id);
    expect(seeded).toHaveLength(14);

    for (const master of MASTER_CATALOG) {
      const filePath = path.join(mastersDir, `${master.id.replace(/^master-/, "")}.json`);
      const parsed = parseUploadedJson(fs.readFileSync(filePath, "utf8"));
      expect(parsed.classification).toBe("bundle");
      expect(parsed.errors).toHaveLength(0);
      expect(parsed.definition?.images && Object.keys(parsed.definition.images).length).toBeGreaterThan(0);

      const template = createFromMaster(db, user, master.id);
      expect(template).not.toBeNull();
      expect(template?.name).toBe(master.name);

      const docDef = JSON.parse(template!.documentDefinition);
      const variables = JSON.parse(template!.variableSchema).variables;
      expect(variables.length).toBeGreaterThan(0);
      expect(variables.every((variable: { bindings: unknown[] }) => variable.bindings?.length > 0)).toBe(true);

      const values: Record<string, unknown> = {};
      for (const variable of variables) values[variable.id] = variable.defaultValue || variable.label;
      const resolved = resolveDocument(docDef, variables, values, { strict: false });
      expect(resolved.errors).toHaveLength(0);

      const pdfBuffer = await renderPdf(resolved.definition);
      expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
      expect(pdfBuffer.length).toBeGreaterThan(1000);
    }

    db.close();
  });
});

