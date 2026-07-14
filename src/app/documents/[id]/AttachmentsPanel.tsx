"use client";

import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/client";
import type { Attachment } from "@/lib/types";

export default function AttachmentsPanel({
  documentId,
  attachments,
  canEdit,
  onChanged,
}: {
  documentId: string;
  attachments: Attachment[];
  canEdit: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api(`/api/documents/${documentId}/attachments`, {
        method: "POST",
        body: form,
      });
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold">Attachments</h2>
          <p className="text-xs text-neutral-500">
            Files attached to this document. Everyone with access can download them.
          </p>
        </div>
        {canEdit ? (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Add file"}
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
          </>
        ) : null}
      </div>

      {error ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {attachments.length === 0 ? (
        <p className="text-xs text-neutral-500">No attachments yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <a
                  href={`/api/documents/${documentId}/attachments/${a.id}`}
                  className="font-medium text-brand hover:underline truncate block"
                  target="_blank"
                  rel="noreferrer"
                >
                  {a.filename}
                </a>
                <div className="text-xs text-neutral-500">
                  {a.mimeType || "unknown"} · {formatBytes(a.sizeBytes)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
