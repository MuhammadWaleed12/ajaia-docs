import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

// Reads the session cookie + DB, so cannot be pre-rendered at build time.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  redirect(user ? "/documents" : "/login");
}
