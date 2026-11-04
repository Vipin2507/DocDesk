import { describe, expect, it } from "vitest";
import { prepareDefinition } from "../shared/document";
import { renderPdf } from "../server/services/pdfmake";
import { extractPdf } from "../server/services/pdf-extract";
import { mapPdfError } from "../server/services/errors";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("pdf generation", () => {
  it("renders tables, columns, and an embedded image to a real PDF", async () => {
    const prepared = prepareDefinition({
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      images: { logo: PNG },
      content: [
        { image: "logo", width: 16 },
        { text: "Customer Name: Vipin Tomar", fontSize: 14, bold: true },
        { columns: [{ text: "Left column" }, { text: "Right column", alignment: "right" }] },
        {
          table: {
            widths: ["*", "auto"],
            body: [
              [{ text: "Description", bold: true }, { text: "Amount", bold: true }],
              ["Consulting", "₹50,000"],
            ],
          },
        },
      ],
    });
    const buffer = await renderPdf(prepared.definition);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    const extracted = await extractPdf(buffer);
    const text = extracted.pages.flatMap((page) => page.glyphs.map((glyph) => glyph.text)).join(" ");
    expect(text).toContain("Vipin");
    expect(extracted.pageCount).toBe(1);
  });

  it("describes password and corrupt PDF failures without a stack trace", () => {
    expect(mapPdfError({ name: "PasswordException", message: "password required" }).message).toMatch(/password/i);
    expect(mapPdfError(new Error("Invalid PDF structure")).code).toBe("PDF_INVALID");
  });
});
