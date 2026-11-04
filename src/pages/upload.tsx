import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileJson, FileText, ShieldCheck, Sparkles, Upload, Zap } from "lucide-react";
import { ApiError, uploadFile } from "../lib/api";
import { Button } from "../components/ui";

interface Uploaded {
  uploadId: string;
  kind: string;
  filename: string;
  size: number;
  pageCount?: number;
  classification?: string;
  errors?: { message: string; line?: number; column?: number }[];
}

export function UploadPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);
  const [busy, setBusy] = useState(false);

  async function receive(file: File) {
    setError("");
    setUploaded(null);
    setProgress(0);
    try {
      const result = (await uploadFile(file, setProgress)) as unknown as Uploaded;
      setUploaded(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The file could not be uploaded.");
    } finally {
      setProgress(null);
    }
  }

  async function convert(mode: string) {
    if (!uploaded) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/document-studio/convert", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: uploaded.uploadId, mode }),
      });
      const data = await response.json();
      if (!response.ok) throw new ApiError(response.status, data?.error?.message || "Conversion failed", data?.error?.details);
      if (data.mode === "queued") {
        const templateId = await poll(data.jobId);
        navigate(`/document-studio/templates/${templateId}`);
        return;
      }
      navigate(`/document-studio/templates/${data.template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <h1 className="text-2xl font-semibold">Upload documents</h1>
      <p className="mt-1 text-sm text-muted">Drop a PDF to reconstruct it, or a PDFMake JSON file to edit it directly.</p>

      <label
        className="mt-6 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-brand/40 bg-sky-50/60 px-6 py-14 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file) void receive(file);
        }}
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-brand text-white">
          <Upload className="h-6 w-6" />
        </span>
        <span className="mt-4 text-lg font-semibold">Drop files here</span>
        <span className="mt-1 text-sm text-muted">PDF or PDFMake JSON, up to 20 MB and 50 pages.</span>
        <span className="mt-2 text-sm text-brand">Or click to select</span>
        <input
          className="sr-only"
          type="file"
          accept="application/pdf,application/json,.pdf,.json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void receive(file);
          }}
        />
      </label>
      {progress !== null ? (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-brand" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {uploaded ? (
        <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">{uploaded.filename}</div>
              <div className="text-sm text-muted">
                {(uploaded.size / 1024).toFixed(0)} KB
                {uploaded.pageCount ? ` · ${uploaded.pageCount} page${uploaded.pageCount === 1 ? "" : "s"}` : ""}
                {uploaded.classification ? ` · ${uploaded.classification}` : ""}
              </div>
            </div>
          </div>
          {uploaded.kind === "pdf" ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <article className="rounded-xl border border-line p-4">
                <h2 className="font-medium">Standard extraction</h2>
                <p className="mt-1 text-sm text-muted">Read text, positions, and page size. Layout is approximate and should be compared with the original.</p>
                <Button className="mt-3" disabled={busy} onClick={() => convert("standard")}>Extract layout</Button>
              </article>
              <article className="rounded-xl border border-line p-4">
                <h2 className="font-medium">AI reconstruction</h2>
                <p className="mt-1 text-sm text-muted">Ask the configured model to rebuild a PDFMake definition. If no provider is set, this step stops with a clear message.</p>
                <Button tone="soft" className="mt-3" disabled={busy} onClick={() => convert("ai")}>Reconstruct with AI</Button>
              </article>
            </div>
          ) : null}
          {uploaded.classification === "pdfmake" || uploaded.classification === "bundle" ? (
            <div className="mt-4">
              <p className="text-sm text-muted">This file is a PDFMake definition. It will be loaded without rewriting the layout.</p>
              <Button className="mt-3" disabled={busy} onClick={() => convert("json")}>Open in editor</Button>
            </div>
          ) : null}
          {uploaded.classification === "generic" ? (
            <div className="mt-4">
              <p className="text-sm text-muted">This JSON is valid, but it is not a PDFMake definition. You can import it as a readable field table.</p>
              <Button className="mt-3" disabled={busy} onClick={() => convert("generic")}>Import as a field table</Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {[
          [Sparkles, "Variable detection", "Names, dates, amounts, and line items become form fields."],
          [Zap, "Same engine for preview and download", "PDFMake renders both the live preview and the file you keep."],
          [ShieldCheck, "Private by default", "Files stay behind your sign-in. Uploaded JavaScript is never executed."],
        ].map(([Icon, title, copy]) => (
          <article key={String(title)} className="rounded-2xl border border-line bg-white p-4">
            <Icon className="h-5 w-5 text-brand" />
            <h2 className="mt-2 font-medium">{String(title)}</h2>
            <p className="mt-1 text-sm text-muted">{String(copy)}</p>
          </article>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>Supported</span>
        {["PDF", "JSON"].map((format) => (
          <span key={format} className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-white">{format}</span>
        ))}
        <FileText className="ml-2 h-4 w-4" />
        <FileJson className="h-4 w-4" />
      </div>
    </div>
  );
}

async function poll(jobId: string): Promise<string> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const response = await fetch(`/api/document-studio/jobs/${jobId}`, { credentials: "include" });
    const data = await response.json();
    if (data.status === "completed" && data.templateId) return data.templateId as string;
    if (data.status === "failed") throw new Error(data.error || "Conversion failed.");
  }
  throw new Error("The conversion is still running. Refresh the studio in a moment.");
}
