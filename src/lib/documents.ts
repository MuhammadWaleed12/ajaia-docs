import { all, one, run } from "./db";
import { newId } from "./id";
import { HttpError } from "./session";
import type {
  Attachment,
  Document,
  DocumentAccess,
  DocumentListItem,
  Permission,
  ShareEntry,
} from "./types";

// -- Row shapes coming back from libSQL (snake_case) --------------------------

type DocRow = {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

type DocListRow = DocRow & {
  owner_name: string;
  owner_email: string;
  shared_permission: Permission | null;
};

type ShareRow = {
  user_id: string;
  email: string;
  name: string;
  permission: Permission;
  created_at: string;
};

type AttachmentRow = {
  id: string;
  document_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

function toDocument(row: DocRow): Document {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toListItem(row: DocListRow): DocumentListItem {
  return {
    ...toDocument(row),
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    sharedPermission: row.shared_permission ?? undefined,
  };
}

// -- Documents ---------------------------------------------------------------

export const DEFAULT_TITLE = "Untitled document";

export async function createDocument(input: {
  ownerId: string;
  title?: string;
  content?: string;
}): Promise<Document> {
  const id = newId("doc");
  await run(
    `INSERT INTO documents (id, title, content, owner_id) VALUES (?, ?, ?, ?)`,
    [id, (input.title ?? DEFAULT_TITLE).trim() || DEFAULT_TITLE, input.content ?? "", input.ownerId]
  );
  const doc = await getDocumentById(id);
  if (!doc) throw new Error("Document just created was not found");
  return doc;
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const row = await one<DocRow>(
    `SELECT id, title, content, owner_id, created_at, updated_at
       FROM documents WHERE id = ?`,
    [id]
  );
  return row ? toDocument(row) : null;
}

/**
 * Loads a document, verifying that the given user has at least the requested
 * permission on it. Throws HttpError(404) if the document does not exist and
 * HttpError(403) if the user has no access.
 */
export async function getDocumentForUser(
  documentId: string,
  userId: string,
  required: "view" | "edit" = "view"
): Promise<DocumentAccess> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw new HttpError(404, "Document not found");

  if (doc.ownerId === userId) return { document: doc, role: "owner" };

  const share = await one<{ permission: Permission }>(
    `SELECT permission FROM shares WHERE document_id = ? AND user_id = ?`,
    [documentId, userId]
  );
  if (!share) throw new HttpError(404, "Document not found"); // hide existence

  if (required === "edit" && share.permission !== "edit") {
    throw new HttpError(403, "You have view-only access to this document");
  }
  return { document: doc, role: share.permission };
}

export async function updateDocument(
  id: string,
  patch: { title?: string; content?: string }
): Promise<Document> {
  const fields: string[] = [];
  const args: (string | number)[] = [];
  if (typeof patch.title === "string") {
    const t = patch.title.trim();
    fields.push("title = ?");
    args.push(t || DEFAULT_TITLE);
  }
  if (typeof patch.content === "string") {
    fields.push("content = ?");
    args.push(patch.content);
  }
  if (fields.length === 0) {
    const existing = await getDocumentById(id);
    if (!existing) throw new HttpError(404, "Document not found");
    return existing;
  }
  fields.push("updated_at = datetime('now')");
  args.push(id);
  await run(`UPDATE documents SET ${fields.join(", ")} WHERE id = ?`, args);
  const doc = await getDocumentById(id);
  if (!doc) throw new HttpError(404, "Document not found");
  return doc;
}

export async function deleteDocument(id: string): Promise<void> {
  await run(`DELETE FROM documents WHERE id = ?`, [id]);
}

/**
 * Documents visible to a user: everything they own PLUS everything shared with
 * them. Ordered by most-recently-updated first.
 */
export async function listDocumentsForUser(userId: string): Promise<DocumentListItem[]> {
  const rows = await all<DocListRow>(
    `SELECT d.id, d.title, d.content, d.owner_id, d.created_at, d.updated_at,
            u.name  AS owner_name,
            u.email AS owner_email,
            s.permission AS shared_permission
       FROM documents d
       JOIN users u ON u.id = d.owner_id
       LEFT JOIN shares s ON s.document_id = d.id AND s.user_id = ?
      WHERE d.owner_id = ? OR s.user_id = ?
      ORDER BY d.updated_at DESC`,
    [userId, userId, userId]
  );
  return rows.map(toListItem);
}

// -- Sharing -----------------------------------------------------------------

export async function listSharesForDocument(documentId: string): Promise<ShareEntry[]> {
  const rows = await all<ShareRow>(
    `SELECT s.user_id, u.email, u.name, s.permission, s.created_at
       FROM shares s
       JOIN users u ON u.id = s.user_id
      WHERE s.document_id = ?
      ORDER BY s.created_at ASC`,
    [documentId]
  );
  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    name: r.name,
    permission: r.permission,
    createdAt: r.created_at,
  }));
}

export async function upsertShare(input: {
  documentId: string;
  userId: string;
  permission: Permission;
}): Promise<void> {
  await run(
    `INSERT INTO shares (document_id, user_id, permission)
     VALUES (?, ?, ?)
     ON CONFLICT(document_id, user_id) DO UPDATE SET permission = excluded.permission`,
    [input.documentId, input.userId, input.permission]
  );
}

export async function removeShare(documentId: string, userId: string): Promise<void> {
  await run(`DELETE FROM shares WHERE document_id = ? AND user_id = ?`, [
    documentId,
    userId,
  ]);
}

// -- Attachments -------------------------------------------------------------

export async function createAttachment(input: {
  documentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}): Promise<Attachment> {
  const id = newId("att");
  await run(
    `INSERT INTO attachments (id, document_id, filename, mime_type, size_bytes, storage_path)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.documentId, input.filename, input.mimeType, input.sizeBytes, input.storagePath]
  );
  const row = await one<AttachmentRow>(
    `SELECT id, document_id, filename, mime_type, size_bytes, created_at
       FROM attachments WHERE id = ?`,
    [id]
  );
  if (!row) throw new Error("Attachment just created was not found");
  return {
    id: row.id,
    documentId: row.document_id,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

export async function listAttachments(documentId: string): Promise<Attachment[]> {
  const rows = await all<AttachmentRow>(
    `SELECT id, document_id, filename, mime_type, size_bytes, created_at
       FROM attachments WHERE document_id = ? ORDER BY created_at DESC`,
    [documentId]
  );
  return rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
  }));
}

export async function getAttachmentWithPath(
  attachmentId: string
): Promise<(Attachment & { storagePath: string }) | null> {
  const row = await one<AttachmentRow & { storage_path: string }>(
    `SELECT id, document_id, filename, mime_type, size_bytes, storage_path, created_at
       FROM attachments WHERE id = ?`,
    [attachmentId]
  );
  if (!row) return null;
  return {
    id: row.id,
    documentId: row.document_id,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    storagePath: row.storage_path,
  };
}
