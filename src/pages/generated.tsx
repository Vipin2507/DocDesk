import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, FileText } from "lucide-react";
import { client } from "../lib/api";
import { Button, Card, EmptyState, PageHeader } from "../components/ui";

export function GeneratedPage() {
  const [page, setPage] = useState(1);
  const list = useQuery({ queryKey: ["generated", page], queryFn: () => client.generated(page) });
  const items = list.data?.items ?? [];
  return (
    <div className="page-shell max-w-5xl">
      <PageHeader
        title="Generated documents"
        description="Each download is stored separately from the template that produced it."
        actions={
          <Link to="/document-studio">
            <Button tone="ghost">Back to studio</Button>
          </Link>
        }
      />

      <Card className="overflow-hidden">
        {list.isLoading ? <p className="p-6 text-sm text-muted">Loading…</p> : null}
        {!list.isLoading && items.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title="No PDFs yet"
            description="Generate a document from a template or master to see it listed here."
            action={
              <Link to="/document-studio">
                <Button>Open studio</Button>
              </Link>
            }
          />
        ) : null}
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 last:border-0 hover:bg-sky-50/30">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold tracking-tight">{item.documentName}</div>
                <div className="mt-1 text-xs text-muted">
                  {item.templateName} · {item.generatedByName || "Unknown"} · {format(new Date(item.generatedAt), "dd MMM yyyy, HH:mm")}
                </div>
              </div>
            </div>
            <a
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm font-medium text-brand transition hover:bg-brand-soft"
              href={`/api/document-studio/generated/${item.id}/file`}
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          </div>
        ))}
      </Card>

      {list.data && list.data.total > 10 ? (
        <div className="mt-4 flex gap-2">
          <Button tone="ghost" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
            Previous
          </Button>
          <Button tone="ghost" onClick={() => setPage((value) => value + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
