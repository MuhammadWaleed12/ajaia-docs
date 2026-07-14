import { NextRequest, NextResponse } from "next/server";
import { ensureInitialized } from "@/lib/init";
import { HttpError, requireSessionUser } from "@/lib/session";
import { getDocumentForUser, removeShare } from "@/lib/documents";
import { handleError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; userId: string } };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    await ensureInitialized();
    const user = await requireSessionUser();
    const access = await getDocumentForUser(params.id, user.id, "view");
    // The owner can remove anyone; a collaborator can only remove themselves.
    if (access.role !== "owner" && user.id !== params.userId) {
      throw new HttpError(403, "Not allowed");
    }
    await removeShare(params.id, params.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
