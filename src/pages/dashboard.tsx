import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Library, MoreHorizontal, Plus, Upload } from "lucide-react";
import { ApiError, client } from "../lib/api";
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, controlClass, statusTone } from "../components/ui";
import { CATEGORIES } from "@shared/types";
import { format } from "date-fns";

const stats = [
  ["totalTemplates", "Total templates"],
  ["totalGenerated", "Generated documents"],
  ["recentlyModified", "Recently modified"],
  ["draftTemplates", "Draft templates"],
  ["activeTemplates", "Active templates"],
] as const;

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const query = params.toString();
  const list = useQuery({ queryKey: ["templates", query], queryFn: () => client.templates(params) });
  const numbers = useQuery({ queryKey: ["stats"], queryFn: client.stats });

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setParams(next);
  }

  async function duplicate(id: string) {
    const result = await client.duplicate(id);
    await queryClient.invalidateQueries({ queryKey: ["templates"] });
    navigate(`/document-studio/templates/${result.template.id}`);
  }

  async function remove(id: string) {
    try {
      await client.removeTemplate(id);
      setConfirmId(null);
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "The template could not be deleted.");
    }
  }

  async function download(id: string) {
    try {
      const { template } = await client.template(id);
      const values = Object.fromEntries(template.variables.map((variable) => [variable.id, variable.defaultValue ?? ""]));
      const generated = await client.generate({
        templateId: template.id,
        templateName: template.name,
        documentDefinition: template.documentDefinition,
        variables: template.variables,
        values,
        save: true,
      });
      window.location.href = `/api/document-studio/generated/${generated.id}/file`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The PDF could not be downloaded.");
    }
  }

  const items = list.data?.items ?? [];
  const page = Number(params.get("page") || 1);
  const pages = Math.max(1, Math.ceil((list.data?.total || 0) / (list.data?.pageSize || 10)));

  return (
    <div className="page-shell">
      <PageHeader
        title="Document Studio"
        description="Manage templates, open masters, and generate finished PDFs from one workspace."
        actions={
          <>
            <Button
              tone="ghost"
              onClick={async () => {
                const created = await client.createTemplate({ name: "Untitled document", category: "Custom Documents" });
                navigate(`/document-studio/templates/${created.template.id}`);
              }}
            >
              <Plus className="h-4 w-4" />
              Blank template
            </Button>
            <Link to="/document-studio/masters">
              <Button tone="ghost">
                <Library className="h-4 w-4" />
                Masters
              </Button>
            </Link>
            <Link to="/document-studio/upload">
              <Button>
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([key, label]) => (
          <StatCard key={key} label={label} value={numbers.data?.[key] ?? "—"} />
        ))}
      </div>

      <Card className="mt-5 p-3">
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="Filter by name"
            defaultValue={params.get("q") || ""}
            placeholder="Search name, category, or author"
            className={`${controlClass} min-w-56 flex-1`}
            onKeyDown={(event) => {
              if (event.key === "Enter") setFilter("q", (event.target as HTMLInputElement).value);
            }}
          />
          <select aria-label="Status" className={controlClass} value={params.get("status") || ""} onChange={(event) => setFilter("status", event.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <select aria-label="Category" className={controlClass} value={params.get("category") || ""} onChange={(event) => setFilter("category", event.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          <select aria-label="Source" className={controlClass} value={params.get("source") || ""} onChange={(event) => setFilter("source", event.target.value)}>
            <option value="">All sources</option>
            <option value="pdf">PDF</option>
            <option value="json">JSON</option>
            <option value="blank">Blank</option>
          </select>
          <select
            aria-label="Sort"
            className={controlClass}
            value={`${params.get("sort") || "updated_at"}:${params.get("dir") || "desc"}`}
            onChange={(event) => {
              const [sort, dir] = event.target.value.split(":");
              const next = new URLSearchParams(params);
              next.set("sort", sort);
              next.set("dir", dir);
              setParams(next);
            }}
          >
            <option value="updated_at:desc">Last modified</option>
            <option value="name:asc">Name</option>
            <option value="created_at:desc">Newest</option>
            <option value="status:asc">Status</option>
          </select>
        </div>
      </Card>

      {message ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p> : null}

      <Card className="mt-4 overflow-hidden">
        {list.isLoading ? <p className="p-8 text-sm text-muted">Loading templates…</p> : null}
        {!list.isLoading && items.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title="No documents yet"
            description="Upload a PDF or open a master format. Studio keeps the layout and turns merge fields into editable values."
            action={
              <Link to="/document-studio/upload">
                <Button>Upload a document</Button>
              </Link>
            }
          />
        ) : null}
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-line bg-slate-50/80 text-[11px] uppercase tracking-[0.06em] text-muted">
                <tr>
                  {["Document", "Type", "Source", "Last modified", "Created by", "Status", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-3.5 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-line/80 transition hover:bg-sky-50/40 last:border-0">
                    <td className="px-4 py-3.5">
                      <button className="text-left font-medium text-ink hover:text-brand" onClick={() => navigate(`/document-studio/templates/${item.id}`)}>
                        {item.name}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-muted">{item.category}</td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        {item.sourceType}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-muted">{format(new Date(item.updatedAt), "dd MMM yyyy")}</td>
                    <td className="px-4 py-3.5">{item.createdBy}</td>
                    <td className="px-4 py-3.5">
                      <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="relative flex items-center gap-2">
                        <Button tone="soft" className="h-8 px-2.5 text-xs" onClick={() => navigate(`/document-studio/templates/${item.id}`)}>
                          Open
                        </Button>
                        <button
                          className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white text-muted hover:bg-slate-50"
                          aria-label="More actions"
                          onClick={() => setMenuId((current) => (current === item.id ? null : item.id))}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuId === item.id ? (
                          <div className="absolute right-0 top-10 z-10 w-40 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-[var(--shadow-panel)]">
                            {[
                              ["Edit", () => navigate(`/document-studio/templates/${item.id}?panel=fields`)],
                              ["Duplicate", () => duplicate(item.id)],
                              ["Preview", () => navigate(`/document-studio/templates/${item.id}?panel=preview`)],
                              ["Download", () => download(item.id)],
                            ].map(([label, action]) => (
                              <button
                                key={String(label)}
                                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                                onClick={() => {
                                  setMenuId(null);
                                  void (action as () => void)();
                                }}
                              >
                                {String(label)}
                              </button>
                            ))}
                            <button
                              className="block w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                              onClick={() => {
                                setMenuId(null);
                                setConfirmId(item.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {list.data && list.data.total > list.data.pageSize ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>{list.data.total} templates</span>
          <div className="flex gap-2">
            <Button tone="ghost" disabled={page <= 1} onClick={() => setFilter("page", String(page - 1))}>
              Previous
            </Button>
            <span className="grid place-items-center rounded-xl border border-line bg-white px-3">
              Page {page} of {pages}
            </span>
            <Button tone="ghost" disabled={page >= pages} onClick={() => setFilter("page", String(page + 1))}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {confirmId ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/35 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[var(--shadow-panel)]">
            <h2 id="delete-title" className="text-lg font-semibold tracking-tight">
              Delete this template?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">Generated PDFs stay in history. The template and its versions are removed.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button tone="ghost" onClick={() => setConfirmId(null)}>
                Cancel
              </Button>
              <Button tone="danger" onClick={() => remove(confirmId)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
