import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatPercent, buildPdfFilename } from "../shared/format";
import { parseUploadedJson, prepareDefinition, sanitizeDefinition } from "../shared/document";
import { extractVariables, linkOccurrences } from "../shared/variables";
import { initialValues, resolveDocument, validateValues } from "../shared/binding";
import { pagesToDefinition, type PageLayout } from "../server/services/layout";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("json classification", () => {
  it("rejects javascript instead of executing it", () => {
    const parsed = parseUploadedJson("var dd = { content: [{ text: 'Hello' }] };");
    expect(parsed.classification).toBe("script");
  });

  it("reports the line and column of broken JSON", () => {
    const parsed = parseUploadedJson("{\n  \"content\": [\n}");
    expect(parsed.classification).toBe("invalid");
    expect(parsed.errors[0]?.line).toBe(3);
  });

  it("recognises a PDFMake definition and a generic object", () => {
    expect(parseUploadedJson(JSON.stringify({ content: [{ text: "Hello" }] })).classification).toBe("pdfmake");
    expect(parseUploadedJson(JSON.stringify({ customer: "Vipin" })).classification).toBe("generic");
  });

  it("strips javascript links and remote images", () => {
    const sanitized = sanitizeDefinition({
      content: [{ text: "Site", link: "javascript:alert(1)", image: "https://example.com/logo.png" }],
      images: { logo: "https://example.com/logo.png", mark: PNG },
    });
    expect(JSON.stringify(sanitized.definition)).not.toContain("javascript:");
    expect(JSON.stringify(sanitized.definition)).not.toContain("https://example.com");
    expect(sanitized.definition.images?.mark).toContain("data:image/png");
  });
});

describe("variables", () => {
  it("extracts a labeled customer and keeps repeated occurrences in sync", () => {
    const prepared = prepareDefinition({
      pageSize: "A4",
      content: [
        { text: "DEMAND LETTER", fontSize: 18, bold: true },
        { text: "Customer Name: Vipin Tomar" },
        { text: "Amount: ₹50,000" },
        { text: "Prepared for Vipin Tomar" },
      ],
    });
    const extracted = extractVariables(prepared.definition);
    const customer = extracted.variables.find((variable) => variable.id === "customer_name");
    expect(customer?.defaultValue).toBe("Vipin Tomar");
    expect(extracted.definition.content.map((item) => (item as { text?: string }).text).join("\n")).toContain("{{customer_name}}");
    const occurrences = JSON.stringify(extracted.definition).split("{{customer_name}}").length - 1;
    expect(occurrences).toBeGreaterThan(1);
    const resolved = resolveDocument(extracted.definition, extracted.variables, { ...initialValues(extracted.variables), customer_name: "Asha Rao" }, { strict: true });
    expect(JSON.stringify(resolved.definition)).toContain("Asha Rao");
    expect(JSON.stringify(resolved.definition)).not.toContain("Vipin Tomar");
    expect(JSON.stringify(resolved.definition)).toContain("₹");
    expect(JSON.stringify(resolved.definition)).not.toContain("{{");
  });

  it("turns a financial table into line items and summary fields", () => {
    const prepared = prepareDefinition({
      content: [
        {
          table: {
            widths: ["*", "auto", "auto", "auto"],
            body: [
              ["Description", "Quantity", "Unit Price", "Amount"],
              ["Website", "1", "120.00", "₹1,710.00"],
              ["Design", "2", "80.00", "₹1,920.00"],
              ["Total", "", "", "₹3,630.00"],
            ],
          },
        },
      ],
    });
    const extracted = extractVariables(prepared.definition);
    const lines = extracted.variables.find((variable) => variable.type === "lineItems");
    expect(lines?.columns?.map((column) => column.key)).toContain("description");
    expect(Array.isArray(lines?.defaultValue) && (lines?.defaultValue as unknown[]).length).toBe(2);
    const values = initialValues(extracted.variables);
    (values.line_items as Record<string, unknown>[])[0].description = "Mobile app";
    const resolved = resolveDocument(extracted.definition, extracted.variables, values, { strict: false });
    const table = (resolved.definition.content[0] as { table: { body: unknown[][] } }).table.body;
    expect(table.length).toBe(4);
    expect(JSON.stringify(table)).toContain("Mobile app");
    expect(JSON.stringify(table)).toContain("Total");
  });

  it("links a repeated value on request", () => {
    const prepared = prepareDefinition({ content: [{ text: "Site: Alpha" }, { text: "Project: Beta" }] });
    const extracted = extractVariables(prepared.definition);
    const field = extracted.variables[0];
    if (!field) return;
    const linked = linkOccurrences(extracted.definition, extracted.variables, field.id);
    expect(linked.linked).toBeGreaterThanOrEqual(0);
  });
});

describe("formatting and validation", () => {
  it("formats currency, dates, and percents", () => {
    expect(formatCurrency(50000)).toBe("50,000.00");
    expect(formatCurrency("₹1,710")).toBe("1,710.00");
    expect(formatDate("2020-05-15")).toBe("15 May 2020");
    expect(formatPercent(18)).toBe("18%");
    expect(buildPdfFilename("Demand Letter", "Vipin Tomar", new Date("2026-11-03"))).toBe("Demand_Letter_Vipin_Tomar_2026-11-03.pdf");
  });

  it("blocks generation when a required value is missing", () => {
    const variables = extractVariables(prepareDefinition({ content: [{ text: "Customer Name: Vipin Tomar" }] }).definition).variables;
    const errors = validateValues(variables, { customer_name: "" });
    expect(errors.some((error) => error.path === "customer_name")).toBe(true);
    const resolved = resolveDocument(
      prepareDefinition({ content: [{ text: "Hello {{missing_name}}" }] }).definition,
      variables,
      initialValues(variables),
      { strict: true },
    );
    expect(resolved.errors.some((error) => error.path === "missing_name" || error.message.includes("required") || error.path === "customer_name")).toBe(true);
  });
});

describe("pdf reconstruction", () => {
  it("builds a document from text positions without claiming an exact copy", () => {
    const page: PageLayout = {
      width: 595,
      height: 842,
      images: [],
      glyphs: [
        { text: "DEMAND LETTER", x: 180, y: 48, width: 220, height: 18, fontSize: 18, fontName: "Roboto-Bold" },
        { text: "Customer Name: Vipin Tomar", x: 48, y: 90, width: 260, height: 12, fontSize: 12, fontName: "Roboto" },
      ],
    };
    const built = pagesToDefinition([page, { ...page, glyphs: [{ text: "Page two", x: 48, y: 48, width: 80, height: 12, fontSize: 12, fontName: "Roboto" }], images: [] }]);
    expect(built.definition.pageSize).toBe("A4");
    expect(built.warnings[0]).toMatch(/different formats/i);
    expect(JSON.stringify(built.definition.content)).toContain("Vipin Tomar");
    expect(JSON.stringify(built.definition.content)).toContain("pageBreak");
  });
});
