"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import type {
  Attachment,
  Document,
  Permission,
  ShareEntry,
} from "@/lib/types";
import TiptapEditor from "./Editor";
import ShareDialog from "./ShareDialog";
import AttachmentsPanel from "./AttachmentsPanel";

type Role = "owner" | Permission;

const SAVE_DEBOUNCE_MS = 800;

export default function DocumentEditor({
  currentUserId,
  document: initialDocument,
  role,
  initialShares,
  initialAttachments,
}: {
  currentUserId: string;
  document: Document;
  role: Role;
  initialShares: ShareEntry[];
  initialAttachments: Attachment[];
}) {
  const router = useRouter();
  const [doc, setDoc] = useState(initialDocument);
  const [title, setTitle] = useState(initialDocument.title);
  const [content, setContent] = useState(initialDocument.content);
  const [shares, setShares] = useState(initialShares);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [shareOpen, setShareOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const canEdit = role === "owner" || role === "edit";
  const canShare = role === "owner";

  // --- Autosave --------------------------------------------------------------
  const dirtyTitleRef = useRef(false);
  const dirtyContentRef = useRef(false);
  const saveTimer = useRef<number | null>(null);

  const flushSave = useCallback(async () => {
    if (!canEdit) return;
    if (!dirtyTitleRef.current && !dirtyContentRef.current) return;
    const payload: { title?: string; content?: string } = {};
    if (dirtyTitleRef.current) payload.title = title;
    if (dirtyContentRef.current) payload.content = content;
    dirtyTitleRef.current = false;
    dirtyContentRef.current = false;
    setSaveState("saving");
    setSaveError(null);
    try {
      const { document: updated } = await api<{ document: Document }>(
        `/api/documents/${doc.id}`,
        { method: "PATCH", body: JSON.stringify(payload) }
      );
      setDoc(updated);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof ApiError ? err.message : "Failed to save");
      // Mark dirty again so the user's typing doesn't get silently lost.
      if (payload.title !== undefined) dirtyTitleRef.current = true;
      if (payload.content !== undefined) dirtyContentRef.current = true;
    }
  }, [canEdit, content, doc.id, title]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void flushSave();
    }, SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  useEffect(() => {
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    // Flush pending changes before the page is unloaded.
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyTitleRef.current || dirtyContentRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  function onTitleChange(next: string) {
    setTitle(next);
    dirtyTitleRef.current = true;
    setSaveState("saving");
    scheduleSave();
  }

  function onContentChange(next: string) {
    setContent(next);
    dirtyContentRef.current = true;
    setSaveState("saving");
    scheduleSave();
  }

  // --- Sharing ---------------------------------------------------------------
  const refreshShares = useCallback(async () => {
    const { shares } = await api<{ shares: ShareEntry[] }>(`/api/documents/${doc.id}/shares`);
    setShares(shares);
  }, [doc.id]);

  // --- Attachments -----------------------------------------------------------
  const refreshAttachments = useCallback(async () => {
    const { attachments } = await api<{ attachments: Attachment[] }>(
      `/api/documents/${doc.id}/attachments`
    );
    setAttachments(attachments);
  }, [doc.id]);

  const savedLabel = useMemo(() => {
    if (!canEdit) return "View only";
    if (saveState === "saving") return "Saving…";
    if (saveState === "error") return `Save failed — ${saveError ?? ""}`;
    if (saveState === "saved") return `Saved ${formatShortTime(doc.updatedAt)}`;
    return `Last edited ${formatShortTime(doc.updatedAt)}`;
  }, [canEdit, saveState, saveError, doc.updatedAt]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/documents" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Back
        </Link>
        <span
          className={
            "text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded " +
            (role === "owner"
              ? "bg-brand/10 text-brand"
              : role === "edit"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-neutral-100 text-neutral-600")
          }
        >
          {role === "owner" ? "Owner" : role === "edit" ? "Editor" : "Viewer"}
        </span>
        <div
          className={
            "text-xs " +
            (saveState === "error" ? "text-red-600" : "text-neutral-500")
          }
          aria-live="polite"
        >
          {savedLabel}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {canShare ? (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm font-medium hover:bg-brand-dark"
            >
              Share
              {shares.length > 0 ? (
                <span className="ml-1 opacity-80">({shares.length})</span>
              ) : null}
            </button>
          ) : null}
        </div>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        readOnly={!canEdit}
        placeholder="Untitled document"
        className="w-full bg-transparent text-3xl font-semibold tracking-tight border-0 border-b border-transparent focus:border-neutral-200 focus:outline-none px-0 py-2 mb-3"
        aria-label="Document title"
      />

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
        <TiptapEditor
          initialHtml={content}
          editable={canEdit}
          onChange={onContentChange}
        />
      </div>

      <AttachmentsPanel
        documentId={doc.id}
        attachments={attachments}
        canEdit={canEdit}
        onChanged={refreshAttachments}
      />

      {shareOpen && canShare ? (
        <ShareDialog
          documentId={doc.id}
          currentUserId={currentUserId}
          shares={shares}
          onClose={() => setShareOpen(false)}
          onChanged={async () => {
            await refreshShares();
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function formatShortTime(iso: string): string {
  const s = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
