import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import HeaderUserMenu from "./HeaderUserMenu";

export const dynamic = "force-dynamic";

export default async function DocumentsLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/documents" className="text-lg font-semibold tracking-tight text-neutral-900">
            Ajaia Docs
          </Link>
          <HeaderUserMenu user={user} />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
