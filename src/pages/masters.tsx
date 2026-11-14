import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileStack, Library } from "lucide-react";
import { CATEGORIES } from "@shared/types";
import { ApiError, client } from "../lib/api";
import { Badge, Button, Card, EmptyState, Field, PageHeader, controlClass } from "../components/ui";

export function MastersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: client.me });
  const list = useQuery({ queryKey: ["masters"], queryFn: client.masters });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[7]);
  const [json, setJson] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const role = me.data?.user.role;
  const canEdit = role === "admin" || role === "editor";
  const canDelete = role === "admin";

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await client.createMaster({ name: name.trim() || "Untitled master", category, json });
      setName("");
      setJson("");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["masters"] });
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "The master could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function useMaster(id: string) {
    setMessage("");
    try {
      const created = await client.useMaster(id);
      navigate(`/document-studio/templates/${created.template.id}`);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "A document could not be created from this master.");
    }
  }

  async function remove(id: string) {
    try {
      await client.removeMaster(id);
      setConfirmId(null);
      await queryClient.invalidateQueries({ queryKey: ["masters"] });
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "The master could not be deleted.");
    }
  }

  const items = list.data?.items ?? [];
  const demandCount = items.filter((item) => item.category === "Demand Letters").length;
  const receiptCount = items.filter((item) => item.category === "Receipts").length;

  return (
    <div className="page-shell max-w-5xl">
      <PageHeader
        title="Masters"
        description="Exact source formats for demand letters and receipts. Creating a document copies the master and leaves the original unchanged."
        actions={canEdit ? <Button onClick={() => setOpen((value) => !value)}>{open ? "Close" : "Add master"}</Button> : undefined}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">All masters</div>
          <div className="mt-2 text-2xl font-semibold">{items.length}</div>
        </Card>
        <Card className="px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Demand letters</div>
          <div className="mt-2 text-2xl font-semibold">{demandCount}</div>
        </Card>
        <Card className="px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Receipts</div>
          <div className="mt-2 text-2xl font-semibold">{receiptCount}</div>
        </Card>
      </div>

      {open ? (
        <Card className="mb-5 p-5">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Demand letter" />
              </Field>
              <Field label="Category">
                <select className={controlClass} value={category} onChange={(event) => setCategory(event.target.value)}>
                  {CATEGORIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="JSON definition">
              <textarea
                aria-label="Master JSON"
                className="min-h-56 w-full rounded-xl border border-line bg-white p-3 font-mono text-xs outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                value={json}
                onChange={(event) => setJson(event.target.value)}
                placeholder='{"pageSize":"A4","content":[{"text":"Customer Name: Vipin Tomar"}]}'
                spellCheck={false}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={busy || !json.trim()}>
                {busy ? "Saving…" : "Save master"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {message ? <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p> : null}
      {list.isLoading ? <p className="text-sm text-muted">Loading masters…</p> : null}

      {!list.isLoading && items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Library className="h-7 w-7" />}
            title="No master formats yet"
            description="Add a PDFMake JSON definition or rebuild the sample demand and receipt set. Each master stays as the source format."
          />
        </Card>
      ) : null}

      {items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:border-brand/25">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <FileStack className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold tracking-tight">{item.name}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Badge tone="blue">{item.category}</Badge>
                    <span>{item.variableCount} fields</span>
                    <span>Added by {item.createdBy}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {canEdit ? <Button onClick={() => useMaster(item.id)}>Create document</Button> : null}
                {canDelete ? (
                  <Button tone="ghost" onClick={() => setConfirmId(item.id)}>
                    Delete
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {confirmId ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/35 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="delete-master-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[var(--shadow-panel)]">
            <h2 id="delete-master-title" className="text-lg font-semibold">
              Delete this master?
            </h2>
            <p className="mt-2 text-sm text-muted">Documents already created from it stay in Studio. Only this source format is removed.</p>
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
