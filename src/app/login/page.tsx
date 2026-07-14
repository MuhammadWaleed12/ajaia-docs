import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { listUsers } from "@/lib/users";
import { ensureInitialized } from "@/lib/init";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/documents");

  await ensureInitialized();
  const users = await listUsers();

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-sm border border-neutral-200 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Ajaia Docs</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Sign in with any email to start editing documents.
          </p>
        </div>
        <LoginForm demoUsers={users} />
      </div>
    </main>
  );
}
