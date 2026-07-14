import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { handleError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    return NextResponse.json({ user });
  } catch (err) {
    return handleError(err);
  }
}
