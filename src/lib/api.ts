import type { DocumentDefinition, VariableDefinition } from "@shared/types";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function parse(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.message || "Request failed", data?.error?.details);
  }
  return data;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  return parse(response) as Promise<T>;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor" | "viewer";
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  sourceType: string;
  status: string;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  hasOriginal: boolean;
}

export interface TemplateDetail extends TemplateSummary {
  originalFileName: string | null;
  documentDefinition: DocumentDefinition;
  variables: VariableDefinition[];
  warnings: string[];
  presets: { id: string; name: string; values: Record<string, unknown>; createdAt: string }[];
}

export const client = {
  me: () => api<{ user: SessionUser }>("/api/auth/me"),
  login: (email: string, password: string) =>
    api<{ user: SessionUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => api("/api/auth/logout", { method: "POST" }),
  status: () =>
    api<{ ai: { available: boolean; provider: string | null }; limits: { maxUploadBytes: number; maxPdfPages: number }; categories: string[] }>(
      "/api/document-studio/status",
    ),
  stats: () =>
    api<{ totalTemplates: number; totalGenerated: number; recentlyModified: number; draftTemplates: number; activeTemplates: number }>(
      "/api/document-studio/stats",
    ),
  templates: (params: URLSearchParams) =>
    api<{ items: TemplateSummary[]; total: number; page: number; pageSize: number }>(`/api/document-studio/templates?${params}`),
  template: (id: string) => api<{ template: TemplateDetail }>(`/api/document-studio/templates/${id}`),
  createTemplate: (body: unknown) => api<{ template: TemplateDetail }>("/api/document-studio/templates", { method: "POST", body: JSON.stringify(body) }),
  saveTemplate: (id: string, body: unknown) =>
    api<{ template: TemplateDetail }>(`/api/document-studio/templates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  removeTemplate: (id: string) => api(`/api/document-studio/templates/${id}`, { method: "DELETE" }),
  duplicate: (id: string) => api<{ template: TemplateDetail }>(`/api/document-studio/templates/${id}/duplicate`, { method: "POST" }),
  versions: (id: string) =>
    api<{ versions: { id: string; versionNumber: number; createdAt: string; createdByName: string | null }[] }>(
      `/api/document-studio/templates/${id}/versions`,
    ),
  restore: (id: string, versionNumber: number) =>
    api<{ template: TemplateDetail }>(`/api/document-studio/templates/${id}/restore`, {
      method: "POST",
      body: JSON.stringify({ versionNumber }),
    }),
  generated: (page = 1) =>
    api<{ items: { id: string; templateName: string; documentName: string; fileName: string; generatedAt: string; generatedByName: string | null }[]; total: number }>(
      `/api/document-studio/generated?page=${page}`,
    ),
  savePreset: (id: string, name: string, values: Record<string, unknown>) =>
    api(`/api/document-studio/templates/${id}/presets`, { method: "POST", body: JSON.stringify({ name, values }) }),
  validate: (json: string) =>
    api<{ classification: string; valid: boolean; errors: { message: string; line?: number; column?: number }[]; warnings?: string[] }>(
      "/api/document-studio/validate",
      { method: "POST", body: JSON.stringify({ json }) },
    ),
  extract: (documentDefinition: DocumentDefinition, mode: "heuristic" | "ai") =>
    api<{ definition: DocumentDefinition; variables: VariableDefinition[]; warnings?: string[] }>("/api/document-studio/extract-variables", {
      method: "POST",
      body: JSON.stringify({ documentDefinition, mode }),
    }),
  generate: (body: unknown) =>
    api<{ id: string; fileName: string; warnings: string[] }>("/api/document-studio/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  masters: () =>
    api<{
      items: { id: string; name: string; description: string; category: string; variableCount: number; createdBy: string; createdAt: string }[];
    }>("/api/document-studio/masters"),
  createMaster: (body: { name: string; category: string; description?: string; json: string }) =>
    api<{ master: { id: string; name: string } }>("/api/document-studio/masters", { method: "POST", body: JSON.stringify(body) }),
  useMaster: (id: string) => api<{ template: TemplateDetail }>(`/api/document-studio/masters/${id}/use`, { method: "POST" }),
  removeMaster: (id: string) => api(`/api/document-studio/masters/${id}`, { method: "DELETE" }),
};

export function uploadFile(file: File, onProgress: (value: number) => void): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/document-studio/upload");
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      const data = request.responseText ? JSON.parse(request.responseText) : {};
      if (request.status >= 200 && request.status < 300) resolve(data);
      else reject(new ApiError(request.status, data?.error?.message || "Upload failed", data?.error?.details));
    };
    request.onerror = () => reject(new ApiError(0, "The upload was interrupted. Check your connection and try again."));
    const body = new FormData();
    body.append("file", file);
    request.send(body);
  });
}

export async function previewPdf(body: unknown, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch("/api/document-studio/preview", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.error?.message || "The preview could not be rendered.", data?.error?.details);
  }
  return response.blob();
}
