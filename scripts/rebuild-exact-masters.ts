import fs from "node:fs";
import path from "node:path";
import { MASTER_CATALOG } from "../server/masters-catalog";
import { prepareDefinition, bundleFrom } from "../shared/document";
import { syncBindings } from "../shared/variables";
import { openDatabase, insertMaster, nowIso, findUserByEmail, type DB } from "../server/db";
import { extractPdf } from "../server/services/pdf-extract";
import { pagesToExactDefinition } from "../server/services/layout";
import { ensureDirs } from "../server/storage";

const root = path.resolve("Demand and Receipt format");
const mastersDir = path.resolve("data", "masters");

function upsertMaster(
  db: DB,
  input: {
    id: string;
    name: string;
    description: string;
    category: string;
    definition: unknown;
    variables: unknown[];
    warnings: string[];
    userId: string;
  },
) {
  const ts = nowIso();
  const existing = db.prepare(`SELECT id FROM document_masters WHERE id = ?`).get(input.id) as { id: string } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE document_masters SET
        name = ?, description = ?, category = ?, document_definition = ?, variable_schema = ?, warnings = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      input.name,
      input.description,
      input.category,
      JSON.stringify(input.definition),
      JSON.stringify({ variables: input.variables }),
      JSON.stringify(input.warnings),
      ts,
      input.id,
    );
    return;
  }
  insertMaster(db, {
    id: input.id,
    name: input.name,
    description: input.description,
    category: input.category,
    documentDefinition: JSON.stringify(input.definition),
    variableSchema: JSON.stringify({ variables: input.variables }),
    warnings: JSON.stringify(input.warnings),
    createdBy: input.userId,
    createdAt: ts,
    updatedAt: ts,
  });
}

async function buildOne(entry: (typeof MASTER_CATALOG)[number]) {
  const pdfPath = path.join(root, entry.sourcePdf);
  if (!fs.existsSync(pdfPath)) throw new Error(`Missing PDF: ${pdfPath}`);
  const buffer = fs.readFileSync(pdfPath);
  const extracted = await extractPdf(buffer, { renderPages: true });
  const exact = pagesToExactDefinition(extracted.pages);
  const prepared = prepareDefinition(exact.definition);
  if (prepared.errors.length) {
    throw new Error(`${entry.id}: ${prepared.errors.map((error) => error.message).join("; ")}`);
  }
  const variables = syncBindings(prepared.definition, exact.variables);
  const warnings = [...exact.warnings, ...prepared.warnings];
  const bundle = bundleFrom(prepared.definition, variables);
  const outPath = path.join(mastersDir, `${entry.id.replace(/^master-/, "")}.json`);
  fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2), "utf8");
  return {
    ...entry,
    definition: prepared.definition,
    variables,
    warnings,
    variableCount: variables.length,
    outPath,
    imageCount: Object.keys(prepared.definition.images || {}).length,
  };
}

async function main() {
  ensureDirs();
  fs.mkdirSync(mastersDir, { recursive: true });
  const db = openDatabase();
  const admin =
    findUserByEmail(db, process.env.ADMIN_EMAIL || "admin@buildesk.local") ||
    (db.prepare(`SELECT id, email, name, role, created_at AS createdAt FROM users LIMIT 1`).get() as
      | { id: string; email: string; name: string; role: "admin" | "editor" | "viewer"; createdAt: string }
      | undefined);
  if (!admin) throw new Error("No user exists. Start the app once so the administrator can be created.");

  const summary: { id: string; variables: number; images: number }[] = [];
  for (const entry of MASTER_CATALOG) {
    process.stdout.write(`Building ${entry.id} from ${entry.sourcePdf}… `);
    const built = await buildOne(entry);
    upsertMaster(db, {
      id: built.id,
      name: built.name,
      description: built.description,
      category: built.category,
      definition: built.definition,
      variables: built.variables,
      warnings: built.warnings,
      userId: admin.id,
    });
    // Also copy original PDF next to the master for Compare.
    const originalDir = path.join(mastersDir, "originals");
    fs.mkdirSync(originalDir, { recursive: true });
    fs.copyFileSync(path.join(root, entry.sourcePdf), path.join(originalDir, entry.sourcePdf));
    console.log(`ok (${built.variableCount} fields, ${built.imageCount} page image${built.imageCount === 1 ? "" : "s"})`);
    summary.push({ id: built.id, variables: built.variableCount, images: built.imageCount });
  }

  db.close();
  console.log(JSON.stringify({ rebuilt: summary.length, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
