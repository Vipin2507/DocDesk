import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Library, Plus, Upload } from "lucide-react";
import { ApiError, client } from "../lib/api";
import { Badge, Button, statusTone } from "../components/ui";
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
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Document Studio</h1>
          <p className="mt-1 text-sm text-muted">Templates, variables, and generated PDFs.</p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([key, label]) => (
          <div key={key} className="rounded-2xl border border-line bg-white px-4 py-3 shadow-sm">
            <div className="text-xs text-muted">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{numbers.data?.[key] ?? "—"}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <input
          aria-label="Filter by name"
          defaultValue={params.get("q") || ""}
          placeholder="Search name, category, or author"
          className="h-10 min-w-56 flex-1 rounded-lg border border-line bg-white px-3 text-sm"
          onKeyDown={(event) => {
            if (event.key === "Enter") setFilter("q", (event.target as HTMLInputElement).value);
          }}
        />
        <select aria-label="Status" className="h-10 rounded-lg border border-line bg-white px-2 text-sm" value={params.get("status") || ""} onChange={(event) => setFilter("status", event.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <select aria-label="Category" className="h-10 rounded-lg border border-line bg-white px-2 text-sm" value={params.get("category") || ""} onChange={(event) => setFilter("category", event.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <select aria-label="Source" className="h-10 rounded-lg border border-line bg-white px-2 text-sm" value={params.get("source") || ""} onChange={(event) => setFilter("source", event.target.value)}>
          <option value="">All sources</option>
          <option value="pdf">PDF</option>
          <option value="json">JSON</option>
          <option value="blank">Blank</option>
        </select>
        <select aria-label="Sort" className="h-10 rounded-lg border border-line bg-white px-2 text-sm" value={`${params.get("sort") || "updated_at"}:${params.get("dir") || "desc"}`} onChange={(event) => {
          const [sort, dir] = event.target.value.split(":");
          const next = new URLSearchParams(params);
          next.set("sort", sort);
          next.set("dir", dir);
          setParams(next);
        }}>
          <option value="updated_at:desc">Last modified</option>
          <option value="name:asc">Name</option>
          <option value="created_at:desc">Newest</option>
          <option value="status:asc">Status</option>
        </select>
      </div>

      {message ? <p className="mt-3 text-sm text-rose-600">{message}</p> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {list.isLoading ? <p className="p-8 text-sm text-muted">Loading templates…</p> : null}
        {!list.isLoading && items.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-sky-50 text-brand">
              <FileText className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">No documents yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted">Upload a PDF or a PDFMake JSON file. Studio will find the fields you can edit and keep the layout as a reusable template.</p>
            <Link to="/document-studio/upload" className="mt-4">
              <Button>Upload a document</Button>
            </Link>
          </div>
        ) : null}
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  {["Document", "Type", "Source", "Last modified", "Created by", "Status", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-medium">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-muted">{item.category}</td>
                    <td className="px-4 py-3 uppercase text-muted">{item.sourceType}</td>
                    <td className="px-4 py-3 text-muted">{format(new Date(item.updatedAt), "dd MMM yyyy")}</td>
                    <td className="px-4 py-3">{item.createdBy}</td>
                    <td className="px-4 py-3"><Badge tone={statusTone(item.status)}>{item.status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button className="text-brand" onClick={() => navigate(`/document-studio/templates/${item.id}`)}>Open</button>
                        <button className="text-brand" onClick={() => navigate(`/document-studio/templates/${item.id}?panel=fields`)}>Edit</button>
                        <button className="text-brand" onClick={() => duplicate(item.id)}>Duplicate</button>
                        <button className="text-brand" onClick={() => navigate(`/document-studio/templates/${item.id}?panel=preview`)}>Preview</button>
                        <button className="text-brand" onClick={() => download(item.id)}>Download</button>
                        <button className="text-rose-600" onClick={() => setConfirmId(item.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {list.data && list.data.total > list.data.pageSize ? (
        <div className="mt-3 flex items-center justify-between text-sm text-muted">
          <span>{list.data.total} templates</span>
          <div className="flex gap-2">
            <Button tone="ghost" disabled={page <= 1} onClick={() => setFilter("page", String(page - 1))}>Previous</Button>
            <span className="grid place-items-center">Page {page} of {pages}</span>
            <Button tone="ghost" disabled={page >= pages} onClick={() => setFilter("page", String(page + 1))}>Next</Button>
          </div>
        </div>
      ) : null}

      {confirmId ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/30 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="delete-title" className="text-lg font-semibold">Delete this template?</h2>
            <p className="mt-1 text-sm text-muted">Generated PDFs stay in history. The template and its versions are removed.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button tone="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
              <Button tone="danger" onClick={() => remove(confirmId)}>Delete</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
