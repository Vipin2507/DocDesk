import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Library, ShieldCheck } from "lucide-react";
import { client } from "../lib/api";
import { Button, Field, controlClass } from "../components/ui";

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await client.login(email, password);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/document-studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-sidebar text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgb(0_155_255_/_28%),transparent_42%),radial-gradient(circle_at_80%_0%,rgb(255_255_255_/_8%),transparent_35%)]" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-lg font-bold shadow-lg shadow-brand/40">B</div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Buildesk</div>
              <div className="text-sm text-sky-100/70">Document Studio</div>
            </div>
          </div>
          <h1 className="mt-16 max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Professional document templates, ready to fill and send.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-sky-100/75">
            Upload demand letters and receipts, keep exact layouts as masters, and generate PDFs with synchronized fields.
          </p>
        </div>
        <div className="relative grid gap-3">
          {[
            [Library, "Reusable masters for every format"],
            [FileText, "Live preview with the same PDF engine"],
            [ShieldCheck, "Private files behind signed-in access"],
          ].map(([Icon, text]) => (
            <div key={String(text)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-sky-50/90">
              <Icon className="h-4 w-4 text-brand" />
              {String(text)}
            </div>
          ))}
        </div>
      </section>

      <section className="grid place-items-center px-4 py-10">
        <form onSubmit={submit} className="w-full max-w-md rounded-[1.5rem] border border-line bg-white p-8 shadow-[var(--shadow-panel)]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand font-bold text-white">B</div>
            <div>
              <div className="text-lg font-semibold">Buildesk</div>
              <div className="text-sm text-muted">Document Studio</div>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1.5 text-sm text-muted">Sign in to open your document workspace.</p>
          </div>
          <div className="mt-7 space-y-4">
            <Field label="Email">
              <input
                className={controlClass}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <Field label="Password">
              <input
                className={controlClass}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>
          </div>
          {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          <Button className="mt-6 w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </section>
    </div>
  );
}
