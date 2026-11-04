import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Library } from "lucide-react";
import { CATEGORIES } from "@shared/types";
import { ApiError, client } from "../lib/api";
import { Badge, Button, Field, controlClass } from "../components/ui";

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Masters</h1>
          <p className="mt-1 text-sm text-muted">Saved JSON formats. Creating a document copies the master and leaves the original unchanged.</p>
        </div>
        {canEdit ? (
          <Button onClick={() => setOpen((value) => !value)}>{open ? "Close" : "Add master"}</Button>
        ) : null}
      </div>

      {open ? (
        <form
          className="mb-5 space-y-3 rounded-2xl border border-line bg-white p-4 shadow-sm"
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
              className="min-h-56 w-full rounded-lg border border-line bg-white p-3 font-mono text-xs outline-none focus:border-brand"
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
      ) : null}

      {message ? <p className="mb-3 text-sm text-rose-600">{message}</p> : null}

      {list.isLoading ? <p className="text-sm text-muted">Loading masters…</p> : null}

      {!list.isLoading && items.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-line bg-white px-6 py-16 text-center shadow-sm">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-sky-50 text-brand">
            <Library className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No master formats yet</h2>
          <p className="mt-1 max-w-md text-sm text-muted">Add a PDFMake JSON definition here. It stays as the source format, and each new document is a separate copy.</p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-sm">
              <div>
                <h2 className="font-medium">{item.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Badge tone="blue">{item.category}</Badge>
                  <span>{item.variableCount} fields</span>
                  <span>Added by {item.createdBy}</span>
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
            </article>
          ))}
        </div>
      ) : null}

      {confirmId ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/30 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-master-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="delete-master-title" className="text-lg font-semibold">Delete this master?</h2>
            <p className="mt-1 text-sm text-muted">Documents already created from it stay in Studio. Only this source format is removed.</p>
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
