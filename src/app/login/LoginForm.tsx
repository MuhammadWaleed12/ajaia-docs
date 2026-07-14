"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import type { User } from "@/lib/types";

export default function LoginForm({ demoUsers }: { demoUsers: User[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(loginEmail: string, loginName?: string) {
    setError(null);
    setLoading(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, name: loginName }),
      });
      router.replace("/documents");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!email) return;
          void submit(email, name || undefined);
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Email
          </span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Display name <span className="text-neutral-400 normal-case">(optional)</span>
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
            placeholder="Your name"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading || !email}
          className="w-full rounded-lg bg-brand text-white text-sm font-medium py-2 hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Continue"}
        </button>
      </form>

      {demoUsers.length > 0 ? (
        <div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-neutral-400">
            <span className="h-px flex-1 bg-neutral-200" />
            or continue as a demo user
            <span className="h-px flex-1 bg-neutral-200" />
          </div>
          <div className="mt-3 grid gap-2">
            {demoUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                disabled={loading}
                onClick={() => void submit(u.email, u.name)}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-left hover:border-brand hover:bg-brand/5 transition disabled:opacity-50"
              >
                <span>
                  <span className="block text-sm font-medium">{u.name}</span>
                  <span className="block text-xs text-neutral-500">{u.email}</span>
                </span>
                <span className="text-xs text-brand">Sign in →</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">
          Tip: run <code className="rounded bg-neutral-100 px-1">npm run db:seed</code> to
          create demo users.
        </p>
      )}
    </div>
  );
}
