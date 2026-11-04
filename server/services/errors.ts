export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function mapPdfError(error: unknown): AppError {
  const name = typeof error === "object" && error && "name" in error ? String(error.name) : "";
  const message = error instanceof Error ? error.message : "";
  if (name === "PasswordException" || /password/i.test(message)) {
    return new AppError(400, "PDF_PASSWORD", "This PDF is password-protected. Remove the password and upload it again.");
  }
  if (name === "InvalidPDFException" || /invalid pdf|xref|format/i.test(message)) {
    return new AppError(400, "PDF_INVALID", "This file is not a readable PDF. It may be corrupted.");
  }
  return new AppError(400, "PDF_INVALID", "This PDF could not be read. Check that the file is a valid PDF and try again.");
}

export function assertPdf(buffer: Buffer): void {
  if (buffer.length < 5 || buffer.subarray(0, 5).toString() !== "%PDF-") {
    throw new AppError(400, "PDF_INVALID", "The file is not a PDF. Upload a .pdf file or a PDFMake .json file.");
  }
}
