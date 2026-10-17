import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureInitialized } from "@/lib/init";
import { requireSessionUser } from "@/lib/session";
import {
  deleteDocument,
  getDocumentForUser,
  listAttachments,
  listSharesForDocument,
  updateDocument,
} from "@/lib/documents";
import { handleError } from "@/lib/api";
import { HttpError } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchBody = z
  .object({
    title: z.string().max(200).optional(),
    content: z.string().max(500_000).optional(),
  })
  .strict();

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await ensureInitialized();
    const user = await requireSessionUser();
    const access = await getDocumentForUser(id, user.id, "view");
    // Only the owner sees the share list; collaborators see their own role only.
    const [shares, attachments] = await Promise.all([
      access.role === "owner" ? listSharesForDocument(id) : Promise.resolve([]),
      listAttachments(id),
    ]);
    return NextResponse.json({
      document: access.document,
      role: access.role,
      shares,
      attachments,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await ensureInitialized();
    const user = await requireSessionUser();
    const body = PatchBody.parse(await req.json());
    // Editing requires either ownership or 'edit' share permission.
    await getDocumentForUser(id, user.id, "edit");
    const doc = await updateDocument(id, body);
    return NextResponse.json({ document: doc });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await ensureInitialized();
    const user = await requireSessionUser();
    const access = await getDocumentForUser(id, user.id, "view");
    if (access.role !== "owner") {
      throw new HttpError(403, "Only the owner can delete this document");
    }
    await deleteDocument(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
