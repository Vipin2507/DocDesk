import { useEffect, useRef, useState } from "react";

export function PdfPreview({
  blob,
  page,
  scale,
  onPages,
}: {
  blob: Blob | null;
  page: number;
  scale: number;
  onPages?: (count: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    setError("");
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (cancelled) return;
        onPages?.(pdf.numPages);
        const current = await pdf.getPage(Math.min(Math.max(page, 1), pdf.numPages));
        const viewport = current.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await current.render({ canvasContext: context, viewport }).promise;
      } catch {
        if (!cancelled) setError("The preview could not be drawn. You can still download the PDF.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob, page, scale, onPages]);

  if (!blob) return <div className="grid h-full place-items-center text-sm text-muted">Edit a field to refresh the preview.</div>;
  if (error) return <div className="grid h-full place-items-center px-6 text-center text-sm text-rose-600">{error}</div>;
  return (
    <div className="h-full overflow-auto bg-[#eef3f8] p-6">
      <canvas ref={canvasRef} className="mx-auto bg-white shadow-md" />
    </div>
  );
}
