import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileJson, FileText, ShieldCheck, Sparkles, Upload, Zap } from "lucide-react";
import { ApiError, uploadFile } from "../lib/api";
import { Button, Card, PageHeader } from "../components/ui";

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
  const [dragging, setDragging] = useState(false);

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
    <div className="page-shell max-w-5xl">
      <PageHeader
        title="Upload documents"
        description="Drop a PDF to keep its exact layout, or import a PDFMake JSON file to edit it directly."
      />

      <label
        className={`flex cursor-pointer flex-col items-center rounded-[1.5rem] border-2 border-dashed px-6 py-16 text-center transition ${
          dragging ? "border-brand bg-brand-soft/80" : "border-brand/35 bg-gradient-to-b from-sky-50/90 to-white"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void receive(file);
        }}
      >
        <span className="grid h-16 w-16 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/30">
          <Upload className="h-7 w-7" />
        </span>
        <span className="mt-5 text-xl font-semibold tracking-tight">Drop files here</span>
        <span className="mt-2 max-w-md text-sm leading-relaxed text-muted">
          Get summaries, extracted fields, and exact citations against the original layout. PDF or PDFMake JSON, up to 20 MB and 50 pages.
        </span>
        <span className="mt-3 text-sm font-medium text-brand">Or click to select</span>
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
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      {error ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {uploaded ? (
        <Card className="mt-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold tracking-tight">{uploaded.filename}</div>
              <div className="mt-1 text-sm text-muted">
                {(uploaded.size / 1024).toFixed(0)} KB
                {uploaded.pageCount ? ` · ${uploaded.pageCount} page${uploaded.pageCount === 1 ? "" : "s"}` : ""}
                {uploaded.classification ? ` · ${uploaded.classification}` : ""}
              </div>
            </div>
          </div>
          {uploaded.kind === "pdf" ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <article className="rounded-2xl border border-brand/30 bg-brand-soft/50 p-4">
                <h2 className="font-semibold">Exact PDF layout</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">Keep the original page look and overlay editable fields on $merge tokens.</p>
                <Button className="mt-4" disabled={busy} onClick={() => convert("exact")}>
                  <ShieldCheck className="h-4 w-4" />
                  Use exact layout
                </Button>
              </article>
              <article className="rounded-2xl border border-line p-4">
                <h2 className="font-semibold">Standard extraction</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">Read text, positions, and page size. Layout is approximate.</p>
                <Button className="mt-4" tone="ghost" disabled={busy} onClick={() => convert("standard")}>
                  Extract layout
                </Button>
              </article>
              <article className="rounded-2xl border border-line p-4">
                <h2 className="font-semibold">AI reconstruction</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">Ask the configured model to rebuild a PDFMake definition.</p>
                <Button tone="soft" className="mt-4" disabled={busy} onClick={() => convert("ai")}>
                  Reconstruct with AI
                </Button>
              </article>
            </div>
          ) : null}
          {uploaded.classification === "pdfmake" || uploaded.classification === "bundle" ? (
            <div className="mt-4">
              <p className="text-sm text-muted">This file is a PDFMake definition. It will be loaded without rewriting the layout.</p>
              <Button className="mt-3" disabled={busy} onClick={() => convert("json")}>
                Open in editor
              </Button>
            </div>
          ) : null}
          {uploaded.classification === "generic" ? (
            <div className="mt-4">
              <p className="text-sm text-muted">This JSON is valid, but it is not a PDFMake definition. You can import it as a readable field table.</p>
              <Button className="mt-3" disabled={busy} onClick={() => convert("generic")}>
                Import as a field table
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {[
          [Sparkles, "AI Processing", "Automatic extraction of text, entities, and metadata"],
          [Zap, "Fast & efficient", "Parallel processing for instant results"],
          [ShieldCheck, "Maximum security", "Private storage behind signed-in access"],
        ].map(([Icon, title, copy]) => (
          <Card key={String(title)} className="p-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="mt-3 font-semibold tracking-tight">{String(title)}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{String(copy)}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="font-medium text-ink">Supported formats:</span>
        {["PDF", "JSON", "DOCX-ready JSON"].map((format) => (
          <span key={format} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">
            {format}
          </span>
        ))}
        <FileText className="ml-1 h-4 w-4" />
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
