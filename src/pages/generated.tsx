import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { client } from "../lib/api";

export function GeneratedPage() {
  const [page, setPage] = useState(1);
  const list = useQuery({ queryKey: ["generated", page], queryFn: () => client.generated(page) });
  const items = list.data?.items ?? [];
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <h1 className="text-2xl font-semibold">Generated documents</h1>
      <p className="mt-1 text-sm text-muted">Each download is stored separately from the template that produced it.</p>
      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-white">
        {list.isLoading ? <p className="p-6 text-sm text-muted">Loading…</p> : null}
        {!list.isLoading && items.length === 0 ? <p className="p-8 text-sm text-muted">No PDFs have been generated yet.</p> : null}
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
            <div>
              <div className="font-medium">{item.documentName}</div>
              <div className="text-xs text-muted">
                {item.templateName} · {item.generatedByName || "Unknown"} · {format(new Date(item.generatedAt), "dd MMM yyyy, HH:mm")}
              </div>
            </div>
            <a className="text-sm font-medium text-brand" href={`/api/document-studio/generated/${item.id}/file`}>
              Download
            </a>
          </div>
        ))}
      </div>
      {list.data && list.data.total > 10 ? (
        <div className="mt-3 flex gap-2">
          <button className="text-sm text-brand" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
          <button className="text-sm text-brand" onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>
      ) : null}
      <Link to="/document-studio" className="mt-6 inline-block text-sm text-brand">Back to studio</Link>
    </div>
  );
}
