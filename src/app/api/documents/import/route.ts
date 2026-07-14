import { NextRequest, NextResponse } from "next/server";
import { ensureInitialized } from "@/lib/init";
import { HttpError, requireSessionUser } from "@/lib/session";
import { createDocument } from "@/lib/documents";
import { importFileToDocument } from "@/lib/import";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { handleError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Uploads a .txt / .md / .docx file and creates a new document owned by the
 * current user, seeded with the file's converted HTML.
 */
export async function POST(req: NextRequest) {
  try {
    await ensureInitialized();
    const user = await requireSessionUser();

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Missing 'file' field");
    if (file.size === 0) throw new HttpError(400, "File is empty");
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new HttpError(413, `File too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB)`);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    let converted;
    try {
      converted = await importFileToDocument({
        filename: file.name || "imported",
        mimeType: file.type || "application/octet-stream",
        bytes,
      });
    } catch (err) {
      throw new HttpError(
        400,
        err instanceof Error ? err.message : "Could not read that file"
      );
    }

    const doc = await createDocument({
      ownerId: user.id,
      title: converted.title,
      content: converted.html,
    });
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
