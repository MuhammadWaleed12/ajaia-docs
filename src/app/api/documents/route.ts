import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureInitialized } from "@/lib/init";
import { requireSessionUser } from "@/lib/session";
import { createDocument, listDocumentsForUser } from "@/lib/documents";
import { handleError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateBody = z
  .object({
    title: z.string().max(200).optional(),
    content: z.string().max(500_000).optional(),
  })
  .strict();

export async function GET() {
  try {
    await ensureInitialized();
    const user = await requireSessionUser();
    const documents = await listDocumentsForUser(user.id);
    return NextResponse.json({ documents });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureInitialized();
    const user = await requireSessionUser();
    const body = req.headers.get("content-length") === "0" ? {} : CreateBody.parse(await req.json());
    const doc = await createDocument({ ownerId: user.id, ...body });
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
