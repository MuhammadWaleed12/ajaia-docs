"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import type { DocumentListItem } from "@/lib/types";
import { IMPORT_ACCEPT, IMPORT_ACCEPT_HUMAN } from "@/lib/import";

type Tab = "all" | "owned" | "shared";

export default function DocumentsDashboard({
  currentUserId,
  initialDocuments,
}: {
  currentUserId: string;
  initialDocuments: DocumentListItem[];
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const owned = d.ownerId === currentUserId;
      if (tab === "owned" && !owned) return false;
      if (tab === "shared" && owned) return false;
      if (query.trim() === "") return true;
      return d.title.toLowerCase().includes(query.trim().toLowerCase());
    });
  }, [documents, tab, query, currentUserId]);

  async function createNew() {
    setError(null);
    setCreating(true);
    try {
      const { document: doc } = await api<{ document: DocumentListItem }>("/api/documents", {
        method: "POST",
        body: JSON.stringify({}),
      });
      router.push(`/documents/${doc.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create document");
      setCreating(false);
    }
  }

  async function importFile(file: File) {
    setError(null);
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { document: doc } = await api<{ document: DocumentListItem }>(
        "/api/documents/import",
        { method: "POST", body: form }
      );
      router.push(`/documents/${doc.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not import that file");
      setImporting(false);
    }
  }

  async function refresh() {
    const { documents } = await api<{ documents: DocumentListItem[] }>("/api/documents");
    setDocuments(documents);
  }

  async function deleteDocument(id: string) {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    try {
      await api(`/api/documents/${id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete document");
    }
  }

  const counts = useMemo(() => {
    let owned = 0;
    let shared = 0;
    for (const d of documents) {
      if (d.ownerId === currentUserId) owned++;
      else shared++;
    }
    return { all: documents.length, owned, shared };
  }, [documents, currentUserId]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your documents</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Create a document, or import a {IMPORT_ACCEPT_HUMAN} file.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importing || creating}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import file"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={createNew}
            disabled={creating || importing}
            className="rounded-lg bg-brand text-white px-3 py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
          >
            {creating ? "Creating…" : "New document"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <TabButton active={tab === "all"} onClick={() => setTab("all")}>
          All <span className="text-neutral-400">({counts.all})</span>
        </TabButton>
        <TabButton active={tab === "owned"} onClick={() => setTab("owned")}>
          Owned by me <span className="text-neutral-400">({counts.owned})</span>
        </TabButton>
        <TabButton active={tab === "shared"} onClick={() => setTab("shared")}>
          Shared with me <span className="text-neutral-400">({counts.shared})</span>
        </TabButton>
        <div className="ml-auto">
          <input
            type="search"
            placeholder="Search titles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const owned = d.ownerId === currentUserId;
            return (
              <li
                key={d.id}
                className="group relative rounded-2xl border border-neutral-200 bg-white p-4 hover:border-brand/60 hover:shadow-sm transition"
              >
                <Link href={`/documents/${d.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium leading-snug text-neutral-900 line-clamp-2">
                      {d.title}
                    </h3>
                    <span
                      className={
                        "shrink-0 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded " +
                        (owned
                          ? "bg-brand/10 text-brand"
                          : "bg-emerald-50 text-emerald-700")
                      }
                    >
                      {owned ? "Owner" : d.sharedPermission === "edit" ? "Editor" : "Viewer"}
                    </span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm text-neutral-500">
                    {excerpt(d.content) || <em className="text-neutral-400">Empty document</em>}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
                    <span>
                      {owned ? "You" : d.ownerName}
                    </span>
                    <time dateTime={d.updatedAt}>{formatDate(d.updatedAt)}</time>
                  </div>
                </Link>
                {owned ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      void deleteDocument(d.id);
                    }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[10px] uppercase tracking-wide font-semibold text-red-600 hover:underline"
                    aria-label="Delete document"
                  >
                    Delete
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full px-3 py-1.5 text-sm font-medium transition " +
        (active
          ? "bg-neutral-900 text-white"
          : "bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300")
      }
    >
      {children}
    </button>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const msg =
    tab === "owned"
      ? "You haven't created any documents yet."
      : tab === "shared"
      ? "Nothing has been shared with you yet."
      : "No documents yet. Click 'New document' or import a file to get started.";
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
      {msg}
    </div>
  );
}

function excerpt(html: string): string {
  if (!html) return "";
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 140 ? text.slice(0, 140) + "…" : text;
}

function formatDate(iso: string): string {
  // libSQL returns 'YYYY-MM-DD HH:MM:SS' (UTC); interpret as UTC.
  const s = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
