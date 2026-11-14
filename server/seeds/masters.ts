import fs from "node:fs";
import path from "node:path";
import { MASTER_CATALOG } from "../masters-catalog";
import { prepareDefinition, parseUploadedJson, bundleFrom } from "../../shared/document";
import { normalizeVariableList, syncBindings } from "../../shared/variables";
import { insertMaster, nowIso, type DB } from "../db";

export function seedMasters(db: DB, adminUserId?: string) {
  let userId = adminUserId;
  if (!userId) {
    const userRow = db.prepare(`SELECT id FROM users ORDER BY role = 'admin' DESC, created_at ASC LIMIT 1`).get() as
      | { id: string }
      | undefined;
    userId = userRow?.id || "admin";
  }

  const mastersDir = path.resolve("data", "masters");
  if (!fs.existsSync(mastersDir)) {
    fs.mkdirSync(mastersDir, { recursive: true });
  }

  const ts = nowIso();
  const results = [];

  for (const master of MASTER_CATALOG) {
    const jsonFileName = `${master.id.replace(/^master-/, "")}.json`;
    const jsonFilePath = path.join(mastersDir, jsonFileName);
    if (!fs.existsSync(jsonFilePath)) {
      throw new Error(
        `Exact master JSON missing for ${master.id}. Run: npx tsx --env-file=.env scripts/rebuild-exact-masters.ts`,
      );
    }

    const parsed = parseUploadedJson(fs.readFileSync(jsonFilePath, "utf8"));
    if (parsed.classification !== "bundle" && parsed.classification !== "pdfmake") {
      throw new Error(`Master JSON for ${master.id} is not a valid document bundle.`);
    }
    const prepared = prepareDefinition(parsed.definition);
    const normalized = normalizeVariableList(parsed.classification === "bundle" ? parsed.variables : []);
    const syncedVars = syncBindings(prepared.definition, normalized.variables);
    const bundle = bundleFrom(prepared.definition, syncedVars);
    fs.writeFileSync(jsonFilePath, JSON.stringify(bundle, null, 2), "utf8");

    const existing = db.prepare(`SELECT id FROM document_masters WHERE id = ?`).get(master.id) as { id: string } | undefined;
    if (existing) {
      db.prepare(
        `UPDATE document_masters SET
          name = ?,
          description = ?,
          category = ?,
          document_definition = ?,
          variable_schema = ?,
          warnings = ?,
          updated_at = ?
         WHERE id = ?`,
      ).run(
        master.name,
        master.description,
        master.category,
        JSON.stringify(prepared.definition),
        JSON.stringify({ variables: syncedVars }),
        JSON.stringify(prepared.warnings),
        ts,
        master.id,
      );
    } else {
      insertMaster(db, {
        id: master.id,
        name: master.name,
        description: master.description,
        category: master.category,
        documentDefinition: JSON.stringify(prepared.definition),
        variableSchema: JSON.stringify({ variables: syncedVars }),
        warnings: JSON.stringify(prepared.warnings),
        createdBy: userId,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    results.push({ id: master.id, name: master.name, variablesCount: syncedVars.length });
  }

  return results;
}
