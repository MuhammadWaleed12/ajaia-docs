import { NextResponse } from "next/server";
import { listUsers } from "@/lib/users";
import { ensureInitialized } from "@/lib/init";
import { handleError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns all users. Used by the login page (to show seeded demo accounts)
 * and by the sharing dialog's typeahead. In a real product this would be
 * scoped to a workspace / directory, not global.
 */
export async function GET() {
  try {
    await ensureInitialized();
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (err) {
    return handleError(err);
  }
}
