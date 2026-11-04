import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { client } from "../lib/api";

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
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="mt-5 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-medium">Signed in</h2>
        <p className="mt-1 text-sm text-muted">
          {me.data?.user.name} · {me.data?.user.email} · {me.data?.user.role}
        </p>
      </section>
      <section className="mt-4 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-medium">AI provider</h2>
        <p className="mt-1 text-sm text-muted">
          {status.data?.ai.available
            ? `Connected through ${status.data.ai.provider}. Keys stay on the server.`
            : "No provider is configured. JSON import, standard extraction, and manual variables still work."}
        </p>
        <p className="mt-3 text-sm text-muted">
          Upload limit {status.data ? Math.round(status.data.limits.maxUploadBytes / 1024 / 1024) : 20} MB · {status.data?.limits.maxPdfPages ?? 50} pages.
        </p>
      </section>
      <section className="mt-4 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-medium">Environment variables</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {env.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
        <button
          className="mt-3 text-sm text-brand"
          onClick={() => {
            void navigator.clipboard.writeText(env.join("\n"));
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy names"}
        </button>
      </section>
    </div>
  );
}
