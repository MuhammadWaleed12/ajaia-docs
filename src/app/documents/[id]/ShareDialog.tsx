"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client";
import type { Permission, ShareEntry, User } from "@/lib/types";

export default function ShareDialog({
  documentId,
  currentUserId,
  shares,
  onClose,
  onChanged,
}: {
  documentId: string;
  currentUserId: string;
  shares: ShareEntry[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<Permission>("edit");
  const [users, setUsers] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ users: User[] }>("/api/users")
      .then((r) => setUsers(r.users))
      .catch(() => {
        /* non-fatal — typeahead just won't have suggestions */
      });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function addShare(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/documents/${documentId}/shares`, {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), permission }),
      });
      setEmail("");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to share");
    } finally {
      setBusy(false);
    }
  }

  async function updateShare(userId: string, next: Permission) {
    setError(null);
    try {
      const target = users.find((u) => u.id === userId);
      await api(`/api/documents/${documentId}/shares`, {
        method: "POST",
        body: JSON.stringify({ email: target?.email ?? emailForUser(userId), permission: next }),
      });
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update");
    }
  }

  async function removeShare(userId: string) {
    setError(null);
    try {
      await api(`/api/documents/${documentId}/shares/${userId}`, { method: "DELETE" });
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove");
    }
  }

  function emailForUser(userId: string): string {
    return shares.find((s) => s.userId === userId)?.email ?? "";
  }

  const suggestions = users
    .filter((u) => u.id !== currentUserId)
    .filter((u) => !shares.some((s) => s.userId === u.id))
    .filter((u) =>
      email.trim() === "" ? true : u.email.toLowerCase().includes(email.trim().toLowerCase())
    )
    .slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="w-full max-w-md rounded-2xl bg-white shadow-lg border border-neutral-200"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h2 id="share-title" className="text-base font-semibold">Share this document</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-neutral-500 hover:text-neutral-800"
          >
            ✕
          </button>
        </div>

        <form onSubmit={addShare} className="px-5 py-4 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                list="ajaia-user-suggestions"
              />
              <datalist id="ajaia-user-suggestions">
                {suggestions.map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.name}
                  </option>
                ))}
              </datalist>
            </div>
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as Permission)}
              className="rounded-lg border border-neutral-300 px-2 py-2 text-sm bg-white"
              aria-label="Permission"
            >
              <option value="view">Viewer</option>
              <option value="edit">Editor</option>
            </select>
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="rounded-lg bg-brand text-white px-3 py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? "…" : "Share"}
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            The recipient will see the document under &ldquo;Shared with me&rdquo;. If the
            email isn&apos;t registered yet, an account is created automatically (mocked-auth demo).
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>

        <div className="px-5 pb-5">
          <div className="text-xs uppercase tracking-wide text-neutral-500 font-medium mb-2">
            People with access
          </div>
          {shares.length === 0 ? (
            <p className="text-sm text-neutral-500">Not shared with anyone yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg">
              {shares.map((s) => (
                <li key={s.userId} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-xs text-neutral-500 truncate">{s.email}</div>
                  </div>
                  <select
                    value={s.permission}
                    onChange={(e) => void updateShare(s.userId, e.target.value as Permission)}
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs bg-white"
                    aria-label={`Permission for ${s.email}`}
                  >
                    <option value="view">Viewer</option>
                    <option value="edit">Editor</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void removeShare(s.userId)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
