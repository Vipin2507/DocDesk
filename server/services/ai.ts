import { prepareDefinition } from "../../shared/document";
import { applyAiCandidates, type VariableCandidate } from "../../shared/variables";
import type { DocumentDefinition, VariableDefinition } from "../../shared/types";
import { AppError } from "./errors";
import type { PageLayout } from "./layout";

export interface AiStatus {
  available: boolean;
  provider: "openai" | "anthropic" | null;
}

export function aiStatus(): AiStatus {
  const openai = Boolean(process.env.OPENAI_API_KEY);
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const choice = (process.env.DOCUMENT_AI_PROVIDER || "auto").toLowerCase();
  let provider: AiStatus["provider"] = null;
  if (choice === "openai" && openai) provider = "openai";
  else if (choice === "anthropic" && anthropic) provider = "anthropic";
  else if (choice === "auto") provider = openai ? "openai" : anthropic ? "anthropic" : null;
  return { available: provider !== null, provider };
}

function unavailable(): AppError {
  return new AppError(
    503,
    "AI_UNAVAILABLE",
    "No AI provider is configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY on the server. You can continue with standard extraction, JSON import, or manual variables.",
  );
}

function compactPages(pages: PageLayout[]) {
  const limit = Math.max(1, Number(process.env.AI_MAX_PAGES || 4));
  return pages.slice(0, limit).map((page, index) => ({
    page: index + 1,
    width: Math.round(page.width),
    height: Math.round(page.height),
    lines: page.glyphs.slice(0, 400).map((glyph) => ({
      text: glyph.text,
      x: Math.round(glyph.x),
      y: Math.round(glyph.y),
      fontSize: Math.round(glyph.fontSize),
    })),
  }));
}

async function completeJson(system: string, user: string): Promise<string> {
  const status = aiStatus();
  if (!status.provider) throw unavailable();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    if (status.provider === "openai") {
      const response = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0.1,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!response.ok) {
        throw new AppError(502, "AI_FAILED", "The AI provider rejected the reconstruction request. Standard extraction is still available.");
      }
      const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new AppError(502, "AI_FAILED", "The AI provider returned an empty response.");
      return content;
    }
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: 8000,
        temperature: 0.1,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!response.ok) {
      throw new AppError(502, "AI_FAILED", "The AI provider rejected the reconstruction request. Standard extraction is still available.");
    }
    const body = (await response.json()) as { content?: { text?: string }[] };
    const content = body.content?.map((part) => part.text || "").join("\n");
    if (!content) throw new AppError(502, "AI_FAILED", "The AI provider returned an empty response.");
    return content;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError(504, "AI_TIMEOUT", "The AI request timed out. Try standard extraction or a smaller document.");
    }
    throw new AppError(502, "AI_FAILED", "The AI provider could not be reached. Standard extraction is still available.");
  } finally {
    clearTimeout(timer);
  }
}

function parseModelJson(raw: string): unknown {
  const fenced = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(fenced);
  } catch {
    throw new AppError(422, "AI_INVALID_OUTPUT", "The AI response was not valid JSON and was discarded.");
  }
}

export async function reconstructWithAi(pages: PageLayout[]): Promise<{
  definition: DocumentDefinition;
  variables: VariableDefinition[];
  warnings: string[];
}> {
  const raw = await completeJson(
    "You reconstruct business documents as PDFMake JSON. Return only a JSON object with keys documentDefinition, variables, warnings, and confidence. documentDefinition must contain a content array using text, table, columns, or stack nodes. Use {{variable_id}} placeholders for values that should change. Do not include JavaScript, functions, or remote image URLs. Never invent parties, amounts, or dates that are not in the source.",
    JSON.stringify({ pages: compactPages(pages) }),
  );
  const parsed = parseModelJson(raw) as {
    documentDefinition?: unknown;
    variables?: { id?: string; label?: string; type?: string; value?: string; confidence?: number }[];
    warnings?: unknown;
  };
  const prepared = prepareDefinition(parsed.documentDefinition);
  if (prepared.errors.length) {
    throw new AppError(422, "AI_INVALID_OUTPUT", "The AI response was not a valid PDFMake definition and was discarded.", prepared.errors);
  }
  const candidates: VariableCandidate[] = (parsed.variables ?? []).flatMap((item) => {
    if (!item || typeof item.label !== "string" || typeof item.value !== "string") return [];
    return [
      {
        label: item.label,
        value: item.value,
        type: (item.type as VariableCandidate["type"]) || "text",
        group: "General",
        id: typeof item.id === "string" ? item.id : undefined,
        confidence: typeof item.confidence === "number" ? item.confidence : 0.5,
      },
    ];
  });
  const applied = applyAiCandidates(prepared.definition, candidates);
  const warnings = [
    "AI reconstruction is an approximation. Review the preview against the original PDF before saving the template.",
    ...prepared.warnings,
    ...(Array.isArray(parsed.warnings) ? parsed.warnings.filter((item): item is string => typeof item === "string").slice(0, 8) : []),
  ];
  if (!applied.variables.length) {
    warnings.push("The model did not return usable variables. You can mark fields manually in the editor.");
  }
  return { definition: applied.definition, variables: applied.variables, warnings };
}

export async function detectVariablesWithAi(definition: DocumentDefinition, text: string): Promise<VariableCandidate[]> {
  const raw = await completeJson(
    "Identify editable business fields in a document. Return only JSON: {\"variables\":[{\"id\":\"customer_name\",\"label\":\"Customer Name\",\"type\":\"text\",\"value\":\"the exact source text\",\"confidence\":0.9}]}. Types may be text, textarea, number, currency, date, percent, email, or phone. Values must be copied exactly from the document. Do not invent fields.",
    JSON.stringify({ text: text.slice(0, 12000), outline: definition.content.slice(0, 80) }),
  );
  const parsed = parseModelJson(raw) as { variables?: VariableCandidate[] };
  if (!Array.isArray(parsed.variables)) {
    throw new AppError(422, "AI_INVALID_OUTPUT", "The AI variable response did not match the expected schema and was discarded.");
  }
  return parsed.variables.filter((item) => item && typeof item.label === "string" && typeof item.value === "string");
}
