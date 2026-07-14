import { NextRequest, NextResponse } from "next/server";
import { ensureInitialized } from "@/lib/init";
import { HttpError, requireSessionUser } from "@/lib/session";
import { getAttachmentWithPath, getDocumentForUser } from "@/lib/documents";
import { readUpload } from "@/lib/storage";
import { handleError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; attachmentId: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await ensureInitialized();
    const user = await requireSessionUser();
    await getDocumentForUser(params.id, user.id, "view");

    const attachment = await getAttachmentWithPath(params.attachmentId);
    if (!attachment || attachment.documentId !== params.id) {
      throw new HttpError(404, "Attachment not found");
    }

    const buffer = await readUpload(attachment.storagePath);
    // Copy into a fresh ArrayBuffer so we satisfy the DOM BodyInit typing.
    // Node's Buffer is Uint8Array<ArrayBufferLike>, but NextResponse wants
    // ArrayBuffer / Uint8Array<ArrayBuffer>. The copy is a small cost for
    // reviewer-friendly downloads, not a hot path.
    const body = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(body).set(buffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Length": String(buffer.byteLength),
        "Content-Disposition": `attachment; filename="${encodeFilename(attachment.filename)}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

function encodeFilename(name: string): string {
  return name.replace(/[\\"]/g, "");
}
