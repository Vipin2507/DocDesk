import fs from "node:fs";
import path from "node:path";
import type { DocumentDefinition, VariableDefinition } from "../shared/types";
import { MASTER_CATALOG } from "./masters-catalog";
import { parseUploadedJson } from "../shared/document";

export interface MasterSpec {
  id: string;
  name: string;
  category: "Demand Letters" | "Receipts";
  description: string;
  definition: DocumentDefinition;
  variables: VariableDefinition[];
}

function loadMaster(id: string): MasterSpec {
  const entry = MASTER_CATALOG.find((item) => item.id === id);
  if (!entry) throw new Error(`Unknown master ${id}`);
  const filePath = path.resolve("data", "masters", `${id.replace(/^master-/, "")}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Exact master JSON missing for ${id}. Run: npx tsx --env-file=.env scripts/rebuild-exact-masters.ts`);
  }
  const parsed = parseUploadedJson(fs.readFileSync(filePath, "utf8"));
  if (!parsed.definition) throw new Error(`Master JSON for ${id} has no document definition.`);
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    description: entry.description,
    definition: parsed.definition,
    variables: (parsed.classification === "bundle" ? parsed.variables : []) as VariableDefinition[],
  };
}

export const MASTERS: MasterSpec[] = MASTER_CATALOG.map((entry) => loadMaster(entry.id));
