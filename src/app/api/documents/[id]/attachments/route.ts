import { NextRequest, NextResponse } from "next/server";
import { ensureInitialized } from "@/lib/init";
import { HttpError, requireSessionUser } from "@/lib/session";
import {
  createAttachment,
  getDocumentForUser,
  listAttachments,
} from "@/lib/documents";
import { MAX_UPLOAD_BYTES, writeUpload } from "@/lib/storage";
import { handleError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await ensureInitialized();
    const user = await requireSessionUser();
    await getDocumentForUser(id, user.id, "view");
    const attachments = await listAttachments(id);
    return NextResponse.json({ attachments });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await ensureInitialized();
    const user = await requireSessionUser();
    // Attaching a file counts as editing the document.
    await getDocumentForUser(id, user.id, "edit");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Missing 'file' field");
    if (file.size === 0) throw new HttpError(400, "File is empty");
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new HttpError(413, `File too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB)`);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const storagePath = await writeUpload(bytes);
    const attachment = await createAttachment({
      documentId: id,
      filename: file.name || "attachment",
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      storagePath,
    });
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
