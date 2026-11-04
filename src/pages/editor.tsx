import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CATEGORIES, type DocumentDefinition, type VariableDefinition, type VariableType } from "@shared/types";
import { bundleFrom, nodePlainText, parseUploadedJson, prepareDefinition, walkNodes } from "@shared/document";
import { initialValues, validateValues } from "@shared/binding";
import {
  addVariable,
  deleteVariable,
  linkOccurrences,
  moveVariable,
  normalizeVariableList,
  renameVariable,
  syncBindings,
  updateVariable,
} from "@shared/variables";
import { ApiError, client, previewPdf, type SessionUser, type TemplateDetail } from "../lib/api";
import { Badge, Button, controlClass, statusTone } from "../components/ui";
import { PdfPreview } from "../components/pdf-preview";
import { JsonEditor } from "../components/json-editor";

interface Draft {
  name: string;
  description: string;
  category: string;
  status: string;
  definition: DocumentDefinition;
  variables: VariableDefinition[];
  values: Record<string, unknown>;
  warnings: string[];
}

const TYPES: VariableType[] = ["text", "textarea", "number", "currency", "date", "percent", "email", "phone", "select", "checkbox", "radio", "image"];

function outlineOf(definition: DocumentDefinition) {
  const items: { nodeId: string; text: string }[] = [];
  const visit = (node: unknown) => {
    walkNodes(node, (current) => {
      const text = typeof current.text === "string" ? current.text : nodePlainText(current);
      if (text.trim() && typeof current._nodeId === "string" && typeof current.text === "string") {
        items.push({ nodeId: current._nodeId, text: text.trim() });
      }
    });
  };
  visit(definition.content);
  visit(definition.header);
  visit(definition.footer);
  return items;
}

function fromTemplate(template: TemplateDetail): Draft {
  return {
    name: template.name,
    description: template.description,
    category: template.category,
    status: template.status,
    definition: template.documentDefinition,
    variables: template.variables,
    values: initialValues(template.variables),
    warnings: template.warnings,
  };
}

export function EditorPage() {
  const { id = "" } = useParams();
  const [search] = useSearchParams();
  const { user } = useOutletContext<{ user: SessionUser }>();
  const queryClient = useQueryClient();
  const template = useQuery({ queryKey: ["template", id], queryFn: () => client.template(id) });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"visual" | "json">("visual");
  const [jsonText, setJsonText] = useState("");
  const [jsonErrors, setJsonErrors] = useState<{ message: string; line?: number; column?: number }[]>([]);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [scale, setScale] = useState(1);
  const [compare, setCompare] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<{ id: string; fileName: string } | null>(null);
  const [panel, setPanel] = useState<"fields" | "preview" | "properties">(search.get("panel") === "preview" ? "preview" : "fields");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const versions = useQuery({ queryKey: ["versions", id], queryFn: () => client.versions(id), enabled: versionsOpen });
  const canEdit = user.role !== "viewer";

  const hydrated = useRef("");

  useEffect(() => {
    const current = template.data?.template;
    if (!current || hydrated.current === current.id) return;
    hydrated.current = current.id;
    const next = fromTemplate(current);
    setDraft(next);
    setJsonText(JSON.stringify(bundleFrom(next.definition, next.variables), null, 2));
    setSelected(next.variables[0]?.id ?? null);
  }, [template.data]);

  const signature = useMemo(() => (draft ? JSON.stringify({ definition: draft.definition, variables: draft.variables, values: draft.values }) : ""), [draft]);

  useEffect(() => {
    if (!draft) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoadingPreview(true);
      previewPdf(
        { documentDefinition: draft.definition, variables: draft.variables, values: draft.values },
        controller.signal,
      )
        .then((next) => {
          setBlob(next);
          setPreviewError("");
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setPreviewError(err instanceof Error ? err.message : "Preview failed.");
        })
        .finally(() => setLoadingPreview(false));
    }, 450);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [signature]);

  if (template.isLoading || !draft) return <div className="p-8 text-sm text-muted">Opening template…</div>;
  if (template.isError) return <div className="p-8 text-sm text-rose-600">This template could not be opened.</div>;

  const current = draft.variables.find((variable) => variable.id === selected) ?? null;
  const groups = new Map<string, VariableDefinition[]>();
  for (const variable of draft.variables.filter((variable) => `${variable.label} ${variable.id}`.toLowerCase().includes(query.toLowerCase()))) {
    const list = groups.get(variable.group) ?? [];
    list.push(variable);
    groups.set(variable.group, list);
  }
  const problems = validateValues(draft.variables, draft.values);
  const outline = outlineOf(draft.definition);

  function patchValues(variableId: string, value: unknown) {
    setDraft((currentDraft) => (currentDraft ? { ...currentDraft, values: { ...currentDraft.values, [variableId]: value } } : currentDraft));
    setGenerated(null);
  }

  function applyStructure(next: { definition?: DocumentDefinition; variables?: VariableDefinition[] }) {
    setDraft((currentDraft) => {
      if (!currentDraft) return currentDraft;
      const definition = next.definition ?? currentDraft.definition;
      const variables = syncBindings(definition, next.variables ?? currentDraft.variables);
      const values = { ...initialValues(variables), ...currentDraft.values };
      return { ...currentDraft, definition, variables, values };
    });
  }

  async function save() {
    if (!draft) return;
    const model = draft;
    setError("");
    try {
      const saved = await client.saveTemplate(id, {
        name: model.name,
        description: model.description,
        category: model.category,
        status: model.status,
        documentDefinition: model.definition,
        variables: model.variables,
        warnings: model.warnings,
      });
      setNotice("Template saved.");
      queryClient.setQueryData(["template", id], saved);
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The template could not be saved.");
    }
  }

  async function generate() {
    if (!draft) return;
    const model = draft;
    setError("");
    try {
      const result = await client.generate({
        templateId: id,
        templateName: model.name,
        documentDefinition: model.definition,
        variables: model.variables,
        values: model.values,
        save: true,
      });
      setGenerated(result);
      setNotice(`Generated ${result.fileName}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The PDF could not be generated.");
    }
  }

  function showVisual() {
    const parsed = parseUploadedJson(jsonText);
    if (parsed.classification === "invalid" || parsed.classification === "script" || parsed.classification === "generic" || !parsed.definition) {
      setJsonErrors(parsed.errors.length ? parsed.errors : [{ message: "Switch back after the JSON is a valid PDFMake definition." }]);
      return;
    }
    const prepared = prepareDefinition(parsed.definition);
    if (prepared.errors.length) {
      setJsonErrors(prepared.errors);
      return;
    }
    const normalized = parsed.classification === "bundle" ? normalizeVariableList(parsed.variables) : { variables: draft?.variables ?? [], errors: [] };
    if (normalized.errors.length) {
      setJsonErrors(normalized.errors.map((message) => ({ message })));
      return;
    }
    applyStructure({ definition: prepared.definition, variables: normalized.variables });
    setJsonErrors([]);
    setMode("visual");
  }

  const selectedNode = outline.find((item) => item.nodeId === nodeId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-white px-3 py-2">
        <input aria-label="Template name" className="h-9 min-w-40 flex-1 rounded-lg border border-line px-2 text-sm font-medium" value={draft.name} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        <select aria-label="Category" className="h-9 rounded-lg border border-line bg-white px-2 text-sm" value={draft.category} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
          {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
        </select>
        <select aria-label="Status" className="h-9 rounded-lg border border-line bg-white px-2 text-sm" value={draft.status} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <Badge tone={statusTone(draft.status)}>{draft.status}</Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button tone={mode === "visual" ? "soft" : "ghost"} onClick={() => (mode === "json" ? showVisual() : setMode("visual"))}>Visual</Button>
          <Button tone={mode === "json" ? "soft" : "ghost"} onClick={() => { setJsonText(JSON.stringify(bundleFrom(draft.definition, draft.variables), null, 2)); setMode("json"); }}>JSON</Button>
          {template.data?.template.hasOriginal ? <Button tone="ghost" onClick={() => setCompare((value) => !value)}>{compare ? "Hide original" : "Compare"}</Button> : null}
          <Button tone="ghost" onClick={() => setVersionsOpen(true)}>History</Button>
          {canEdit ? <Button tone="ghost" onClick={save}>Save template</Button> : null}
          <Button onClick={generate}>Generate PDF</Button>
        </div>
      </div>
      {draft.warnings[0] ? <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-800">{draft.warnings[0]}</p> : null}
      {error ? <p className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{notice}</p> : null}
      {generated ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-2 text-sm">
          <span>PDF ready: {generated.fileName}</span>
          <a className="font-medium text-brand" href={`/api/document-studio/generated/${generated.id}/file`}>Download</a>
          <button className="text-brand" onClick={() => blob && window.open(URL.createObjectURL(blob))}>Print</button>
          <button className="text-brand" onClick={() => setGenerated(null)}>Generate another</button>
          <button className="text-brand" onClick={async () => {
            const name = window.prompt("Preset name", "Saved values");
            if (!name) return;
            await client.savePreset(id, name, draft.values);
            setNotice("Preset saved.");
            await queryClient.invalidateQueries({ queryKey: ["template", id] });
          }}>Save values as preset</button>
          <button className="text-brand" onClick={() => {
            const file = new Blob([JSON.stringify(bundleFrom(draft.definition, draft.variables), null, 2)], { type: "application/json" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(file);
            link.download = `${draft.name.replace(/[^\w.-]+/g, "_")}.json`;
            link.click();
          }}>Download JSON</button>
        </div>
      ) : null}

      {mode === "json" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap gap-2 border-b border-line bg-white px-3 py-2 text-sm">
            <Button tone="ghost" onClick={() => {
              try {
                setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2));
                setJsonErrors([]);
              } catch {
                setJsonErrors([{ message: "This JSON cannot be formatted until it parses." }]);
              }
            }}>Format</Button>
            <Button tone="ghost" onClick={() => navigator.clipboard.writeText(jsonText)}>Copy</Button>
            <Button tone="ghost" onClick={() => setJsonText(JSON.stringify(bundleFrom(draft.definition, draft.variables), null, 2))}>Reset to editor</Button>
            <Button tone="ghost" onClick={() => template.data && setJsonText(JSON.stringify(bundleFrom(template.data.template.documentDefinition, template.data.template.variables), null, 2))}>Reset to saved</Button>
          </div>
          {jsonErrors.length ? (
            <ul className="bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {jsonErrors.map((item, index) => (
                <li key={index}>{item.line ? `Line ${item.line}, column ${item.column}: ` : ""}{item.message}</li>
              ))}
            </ul>
          ) : null}
          <div className="min-h-0 flex-1">
            <JsonEditor value={jsonText} onChange={setJsonText} />
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2 border-b border-line bg-white px-3 py-2 lg:hidden">
            {(["fields", "preview", "properties"] as const).map((item) => (
              <button key={item} className={`rounded-full px-3 py-1 text-sm capitalize ${panel === item ? "bg-brand text-white" : "bg-canvas"}`} onClick={() => setPanel(item)}>{item}</button>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
            <aside className={`${panel === "fields" ? "flex" : "hidden"} min-h-0 flex-col border-r border-line bg-white lg:flex`}>
              <div className="border-b border-line p-3">
                <input aria-label="Search variables" className={controlClass} placeholder="Search variables" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Fields</h2>
                {[...groups.entries()].map(([group, variables]) => (
                  <div key={group} className="mt-3">
                    <div className="text-xs font-medium text-muted">{group}</div>
                    {variables.map((variable) => (
                      <button key={variable.id} className={`mt-1 block w-full rounded-lg px-2 py-1.5 text-left text-sm ${selected === variable.id ? "bg-sky-50 text-brand-dark" : "hover:bg-slate-50"}`} onClick={() => { setSelected(variable.id); setPanel("properties"); }}>
                        <div>{variable.label}</div>
                        <div className="truncate text-xs text-muted">{String(draft.values[variable.id] ?? "")}</div>
                      </button>
                    ))}
                  </div>
                ))}
                <h2 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Document outline</h2>
                {outline.map((item) => (
                  <button key={item.nodeId} className={`mt-1 block w-full truncate rounded-lg px-2 py-1 text-left text-xs ${nodeId === item.nodeId ? "bg-slate-100" : ""}`} onClick={() => {
                    setNodeId(item.nodeId);
                    const match = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/.exec(item.text);
                    if (match) setSelected(match[1]);
                    setPanel("properties");
                  }}>{item.text}</button>
                ))}
              </div>
            </aside>
            <section className={`${panel === "preview" ? "flex" : "hidden"} min-h-0 flex-col lg:flex`}>
              <div className="flex items-center gap-2 border-b border-line bg-white px-3 py-2 text-sm">
                <Button tone="ghost" onClick={() => setPage((value) => Math.max(1, value - 1))}>Prev</Button>
                <span>Page {page} / {pages}</span>
                <Button tone="ghost" onClick={() => setPage((value) => Math.min(pages, value + 1))}>Next</Button>
                <Button tone="ghost" onClick={() => setScale((value) => Math.max(0.6, Number((value - 0.1).toFixed(2))))}>−</Button>
                <span>{Math.round(scale * 100)}%</span>
                <Button tone="ghost" onClick={() => setScale((value) => Math.min(1.8, Number((value + 0.1).toFixed(2))))}>+</Button>
                <Button tone="ghost" onClick={() => setScale(1)}>Fit</Button>
                {loadingPreview ? <span className="text-muted">Updating…</span> : null}
                {previewError ? <span className="text-rose-600">{previewError}</span> : null}
              </div>
              <div className={`grid min-h-0 flex-1 ${compare ? "md:grid-cols-2" : ""}`}>
                {compare ? <iframe title="Original PDF" className="h-full w-full border-r border-line bg-white" src={`/api/document-studio/templates/${id}/original`} /> : null}
                <PdfPreview blob={blob} page={page} scale={scale} onPages={setPages} />
              </div>
            </section>
            <aside className={`${panel === "properties" ? "block" : "hidden"} min-h-0 overflow-auto border-l border-line bg-white p-4 lg:block`}>
              {current ? (
                <VariableCard
                  variable={current}
                  value={draft.values[current.id]}
                  presets={template.data?.template.presets ?? []}
                  onPreset={(values) => setDraft({ ...draft, values })}
                  onValue={(value) => patchValues(current.id, value)}
                  onChange={(patch) => canEdit && applyStructure({ variables: updateVariable(draft.variables, current.id, patch) })}
                  onRename={(label) => {
                    const result = renameVariable(draft.definition, draft.variables, current.id, label);
                    if (result.error) setError(result.error);
                    else {
                      applyStructure(result);
                      setSelected(result.variables.find((item) => item.label === label)?.id ?? current.id);
                    }
                  }}
                  onDelete={() => {
                    const result = deleteVariable(draft.definition, draft.variables, current.id);
                    applyStructure(result);
                    setSelected(result.variables[0]?.id ?? null);
                  }}
                  onMove={(direction) => applyStructure({ variables: moveVariable(draft.variables, current.id, direction) })}
                  onLink={() => {
                    const result = linkOccurrences(draft.definition, draft.variables, current.id);
                    applyStructure(result);
                    setNotice(result.linked ? `Linked ${result.linked} more occurrence${result.linked === 1 ? "" : "s"}.` : "No other occurrences were found.");
                  }}
                  canEdit={canEdit}
                />
              ) : <p className="text-sm text-muted">Select a field to edit its value.</p>}
              {problems.length ? <ul className="mt-3 space-y-1 text-xs text-rose-600">{problems.map((problem) => <li key={problem.path}>{problem.message}</li>)}</ul> : null}
              {canEdit && selectedNode ? (
                <form className="mt-5 space-y-2 border-t border-line pt-4" onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const result = addVariable(draft.definition, draft.variables, {
                    nodeId: selectedNode.nodeId,
                    label: String(form.get("label") || "Field"),
                    type: String(form.get("type") || "text") as VariableType,
                    group: String(form.get("group") || "General"),
                    required: form.get("required") === "on",
                    textToReplace: String(form.get("text") || ""),
                  });
                  if (result.error) setError(result.error);
                  else {
                    applyStructure(result);
                    setSelected(result.variables.at(-1)?.id ?? null);
                  }
                }}>
                  <h3 className="text-sm font-medium">Make a variable from this text</h3>
                  <p className="text-xs text-muted">{selectedNode.text}</p>
                  <input name="text" className={controlClass} defaultValue={selectedNode.text.replace(/\{\{[^}]+\}\}/g, "")} />
                  <input name="label" className={controlClass} placeholder="Label" defaultValue="Custom field" />
                  <input name="group" className={controlClass} placeholder="Group" defaultValue="General" />
                  <select name="type" className={controlClass}>{TYPES.map((type) => <option key={type}>{type}</option>)}</select>
                  <label className="flex items-center gap-2 text-sm"><input name="required" type="checkbox" /> Required</label>
                  <Button type="submit">Add variable</Button>
                </form>
              ) : null}
            </aside>
          </div>
        </>
      )}
      {versionsOpen ? (
        <div className="fixed inset-0 z-20 grid justify-end bg-slate-900/20" role="dialog" aria-modal="true">
          <div className="h-full w-full max-w-sm overflow-auto bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Version history</h2>
              <button onClick={() => setVersionsOpen(false)}>Close</button>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {(versions.data?.versions ?? []).map((version) => (
                <li key={version.id} className="rounded-lg border border-line p-3">
                  <div>Version {version.versionNumber}</div>
                  <div className="text-xs text-muted">{version.createdByName} · {new Date(version.createdAt).toLocaleString()}</div>
                  {canEdit ? <button className="mt-2 text-brand" onClick={async () => {
                    const restored = await client.restore(id, version.versionNumber);
                    hydrated.current = "";
                    queryClient.setQueryData(["template", id], restored);
                    setDraft(fromTemplate(restored.template));
                    setVersionsOpen(false);
                    setNotice(`Restored version ${version.versionNumber} as a new version.`);
                  }}>Restore</button> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VariableCard({
  variable,
  value,
  presets,
  onPreset,
  onValue,
  onChange,
  onRename,
  onDelete,
  onMove,
  onLink,
  canEdit,
}: {
  variable: VariableDefinition;
  value: unknown;
  presets: { id: string; name: string; values: Record<string, unknown> }[];
  onPreset: (values: Record<string, unknown>) => void;
  onValue: (value: unknown) => void;
  onChange: (patch: Partial<VariableDefinition>) => void;
  onRename: (label: string) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onLink: () => void;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted">{variable.group}</div>
        <h2 className="text-lg font-semibold">{variable.label}</h2>
      </div>
      {presets.length ? (
        <select aria-label="Data preset" className={controlClass} defaultValue="" onChange={(event) => {
          const preset = presets.find((item) => item.id === event.target.value);
          if (preset) onPreset(preset.values);
        }}>
          <option value="">Load a data preset</option>
          {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
        </select>
      ) : null}
      <ValueControl variable={variable} value={value} onValue={onValue} />
      {canEdit ? (
        <>
          <label className="block text-sm">Label
            <input className={`${controlClass} mt-1`} defaultValue={variable.label} onBlur={(event) => event.target.value !== variable.label && onRename(event.target.value)} />
          </label>
          <label className="block text-sm">Group
            <input className={`${controlClass} mt-1`} value={variable.group} onChange={(event) => onChange({ group: event.target.value })} />
          </label>
          <label className="block text-sm">Type
            <select className={`${controlClass} mt-1`} value={variable.type} onChange={(event) => onChange({ type: event.target.value as VariableType })}>
              {TYPES.map((type) => <option key={type}>{type}</option>)}
              {variable.type === "lineItems" ? <option value="lineItems">lineItems</option> : null}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={variable.required} onChange={(event) => onChange({ required: event.target.checked })} /> Required</label>
          <label className="block text-sm">Default value
            <input className={`${controlClass} mt-1`} value={variable.type === "lineItems" ? "" : String(variable.defaultValue ?? "")} disabled={variable.type === "lineItems"} onChange={(event) => onChange({ defaultValue: event.target.value })} />
          </label>
          <label className="block text-sm">Validation pattern
            <input className={`${controlClass} mt-1`} value={variable.validation?.pattern ?? ""} onChange={(event) => onChange({ validation: { ...variable.validation, pattern: event.target.value } })} />
          </label>
          <div className="flex flex-wrap gap-2 text-sm">
            <button className="text-brand" onClick={() => onMove(-1)}>Move up</button>
            <button className="text-brand" onClick={() => onMove(1)}>Move down</button>
            <button className="text-brand" onClick={onLink}>Link occurrences</button>
            <button className="text-rose-600" onClick={onDelete}>Delete</button>
          </div>
          <p className="text-xs text-muted">{variable.bindings.length} binding{variable.bindings.length === 1 ? "" : "s"} · {variable.id}</p>
        </>
      ) : null}
    </div>
  );
}

function ValueControl({ variable, value, onValue }: { variable: VariableDefinition; value: unknown; onValue: (value: unknown) => void }) {
  if (variable.type === "lineItems" && variable.columns) {
    const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    return (
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="rounded-lg border border-line p-2">
            {variable.columns!.map((column) => (
              <label key={column.key} className="mt-1 block text-xs text-muted">{column.label}
                <input className={`${controlClass} mt-1`} value={row[column.key] == null ? "" : String(row[column.key])} onChange={(event) => {
                  const next = rows.map((item, itemIndex) => itemIndex === index ? { ...item, [column.key]: column.type === "text" ? event.target.value : Number(event.target.value) } : item);
                  onValue(next);
                }} />
              </label>
            ))}
            <button className="mt-2 text-xs text-rose-600" onClick={() => onValue(rows.filter((_, itemIndex) => itemIndex !== index))}>Remove row</button>
          </div>
        ))}
        <Button type="button" tone="ghost" onClick={() => onValue([...rows, Object.fromEntries(variable.columns!.map((column) => [column.key, column.type === "text" ? "" : 0]))])}>Add row</Button>
      </div>
    );
  }
  if (variable.type === "textarea") return <textarea className="min-h-24 w-full rounded-lg border border-line p-2 text-sm" value={String(value ?? "")} onChange={(event) => onValue(event.target.value)} />;
  if (variable.type === "checkbox") return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onValue(event.target.checked)} /> Yes</label>;
  if (variable.type === "select" || variable.type === "radio") {
    const options = variable.options ?? [];
    if (variable.type === "radio") {
      return <div className="space-y-1">{options.map((option) => <label key={option} className="flex gap-2 text-sm"><input type="radio" checked={value === option} onChange={() => onValue(option)} />{option}</label>)}</div>;
    }
    return <select className={controlClass} value={String(value ?? "")} onChange={(event) => onValue(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select>;
  }
  if (variable.type === "image") {
    return <input aria-label={variable.label} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onValue(String(reader.result));
      reader.readAsDataURL(file);
    }} />;
  }
  const inputType = variable.type === "date" ? "date" : variable.type === "number" || variable.type === "currency" || variable.type === "percent" ? "number" : variable.type === "email" ? "email" : "text";
  return <input aria-label={variable.label} className={controlClass} type={inputType} step={inputType === "number" ? "0.01" : undefined} value={value == null ? "" : String(value)} onChange={(event) => onValue(inputType === "number" ? (event.target.value === "" ? "" : Number(event.target.value)) : event.target.value)} />;
}
