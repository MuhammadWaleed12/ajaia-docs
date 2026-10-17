import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureInitialized } from "@/lib/init";
import { HttpError, requireSessionUser } from "@/lib/session";
import { getDocumentForUser, listSharesForDocument, upsertShare } from "@/lib/documents";
import { findUserByEmail, upsertUser } from "@/lib/users";
import { handleError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ShareBody = z
  .object({
    email: z.string().email(),
    permission: z.enum(["view", "edit"]).default("view"),
    /** If true, the user will be created (with a placeholder name) if missing. */
    createIfMissing: z.boolean().default(true),
  })
  .strict();

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await ensureInitialized();
    const user = await requireSessionUser();
    const access = await getDocumentForUser(id, user.id, "view");
    if (access.role !== "owner") {
      throw new HttpError(403, "Only the owner can view share settings");
    }
    const shares = await listSharesForDocument(id);
    return NextResponse.json({ shares });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await ensureInitialized();
    const user = await requireSessionUser();
    const body = ShareBody.parse(await req.json());
    const access = await getDocumentForUser(id, user.id, "view");
    if (access.role !== "owner") {
      throw new HttpError(403, "Only the owner can share this document");
    }

    let target = await findUserByEmail(body.email);
    if (!target) {
      if (!body.createIfMissing) throw new HttpError(404, "No user with that email");
      // Create a lightweight placeholder account. In a real app this would
      // trigger an invitation email flow; here we just materialize the user
      // so the sharing relationship is valid.
      target = await upsertUser({ email: body.email, name: body.email.split("@")[0] });
    }

    if (target.id === user.id) throw new HttpError(400, "You already own this document");

    await upsertShare({
      documentId: id,
      userId: target.id,
      permission: body.permission,
    });

    const shares = await listSharesForDocument(id);
    return NextResponse.json({ shares }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
