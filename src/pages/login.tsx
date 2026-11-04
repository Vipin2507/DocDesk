import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
    <div className="grid min-h-screen place-items-center bg-canvas px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand font-bold text-white">B</div>
          <div>
            <div className="text-lg font-semibold">Buildesk</div>
            <div className="text-sm text-muted">Document Studio</div>
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Email">
            <input className={controlClass} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Field label="Password">
            <input className={controlClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </Field>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        <Button className="mt-5 w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
