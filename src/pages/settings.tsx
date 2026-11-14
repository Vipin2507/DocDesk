import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { client } from "../lib/api";
import { Badge, Button, Card, PageHeader } from "../components/ui";

export function SettingsPage() {
  const status = useQuery({ queryKey: ["status"], queryFn: client.status });
  const me = useQuery({ queryKey: ["me"], queryFn: client.me });
  const [copied, setCopied] = useState(false);
  const env = useMemo(
    () => ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DOCUMENT_AI_PROVIDER", "OPENAI_MODEL", "ANTHROPIC_MODEL", "SESSION_SECRET", "ADMIN_EMAIL"],
    [],
  );
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="page-shell max-w-3xl">
      <PageHeader title="Settings" description="Account details, AI provider status, and server environment names." />

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold tracking-tight">Signed in</h2>
            <p className="mt-1 text-sm text-muted">
              {me.data?.user.name} · {me.data?.user.email}
            </p>
          </div>
          <Badge tone="blue">{me.data?.user.role || "…"}</Badge>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold tracking-tight">AI provider</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {status.data?.ai.available
                ? `Connected through ${status.data.ai.provider}. Keys stay on the server.`
                : "No provider is configured. JSON import, standard extraction, and manual variables still work."}
            </p>
            <p className="mt-3 text-sm text-muted">
              Upload limit {status.data ? Math.round(status.data.limits.maxUploadBytes / 1024 / 1024) : 20} MB · {status.data?.limits.maxPdfPages ?? 50} pages.
            </p>
          </div>
          <Badge tone={status.data?.ai.available ? "green" : "amber"}>{status.data?.ai.available ? "Connected" : "Optional"}</Badge>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-semibold tracking-tight">Environment variables</h2>
        <ul className="mt-3 space-y-2">
          {env.map((name) => (
            <li key={name} className="rounded-xl border border-line bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
              {name}
            </li>
          ))}
        </ul>
        <Button
          tone="ghost"
          className="mt-4"
          onClick={() => {
            void navigator.clipboard.writeText(env.join("\n"));
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy names"}
        </Button>
      </Card>
    </div>
  );
}
