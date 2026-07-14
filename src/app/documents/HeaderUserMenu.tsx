"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { User } from "@/lib/types";

export default function HeaderUserMenu({ user }: { user: User }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="hidden sm:block text-right leading-tight">
        <div className="font-medium text-neutral-900">{user.name}</div>
        <div className="text-xs text-neutral-500">{user.email}</div>
      </div>
      <div className="h-9 w-9 grid place-items-center rounded-full bg-brand/10 text-brand font-semibold">
        {initials(user.name)}
      </div>
      <button
        onClick={signOut}
        disabled={busy}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
