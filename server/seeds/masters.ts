import fs from "node:fs";
import path from "node:path";
import { MASTERS } from "../masters-data";
import { prepareDefinition, bundleFrom } from "../../shared/document";
import { normalizeVariableList, syncBindings } from "../../shared/variables";
import { insertMaster, nowIso, type DB } from "../db";

export function seedMasters(db: DB, adminUserId?: string) {
  // If adminUserId not provided, look up first admin or user
  let userId = adminUserId;
  if (!userId) {
    const userRow = db.prepare(`SELECT id FROM users ORDER BY role = 'admin' DESC, created_at ASC LIMIT 1`).get() as { id: string } | undefined;
    userId = userRow?.id || "admin";
  }

  const mastersDir = path.resolve("data", "masters");
  if (!fs.existsSync(mastersDir)) {
    fs.mkdirSync(mastersDir, { recursive: true });
  }

  const ts = nowIso();
  const results = [];

  for (const master of MASTERS) {
    const prepared = prepareDefinition(master.definition);
    const normalized = normalizeVariableList(master.variables);
    const syncedVars = syncBindings(prepared.definition, normalized.variables);

    const bundle = bundleFrom(prepared.definition, syncedVars);
    const jsonFileName = `${master.id.replace(/^master-/, "")}.json`;
    const jsonFilePath = path.join(mastersDir, jsonFileName);
    fs.writeFileSync(jsonFilePath, JSON.stringify(bundle, null, 2), "utf8");

    // Check if master already exists in database
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

