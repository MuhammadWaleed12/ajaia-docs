import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookie } from "@/lib/session";
import { upsertUser } from "@/lib/users";
import { ensureInitialized } from "@/lib/init";
import { handleError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80).optional(),
});

export async function POST(req: NextRequest) {
  try {
    await ensureInitialized();
    const { email, name } = Body.parse(await req.json());
    const user = await upsertUser({ email, name: name || defaultNameFromEmail(email) });
    await setSessionCookie(user.id);
    return NextResponse.json({ user });
  } catch (err) {
    return handleError(err);
  }
}

function defaultNameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "User";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || "User";
}
