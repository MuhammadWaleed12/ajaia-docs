import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser, HttpError } from "@/lib/session";
import {
  getDocumentForUser,
  listAttachments,
  listSharesForDocument,
} from "@/lib/documents";
import DocumentEditor from "./DocumentEditor";

export const dynamic = "force-dynamic";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/documents/${id}`);

  try {
    const access = await getDocumentForUser(id, user.id, "view");
    const [shares, attachments] = await Promise.all([
      access.role === "owner" ? listSharesForDocument(id) : Promise.resolve([]),
      listAttachments(id),
    ]);
    return (
      <DocumentEditor
        currentUserId={user.id}
        document={access.document}
        role={access.role}
        initialShares={shares}
        initialAttachments={attachments}
      />
    );
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    if (err instanceof HttpError && err.status === 403) {
      return (
        <div className="max-w-xl mx-auto p-10 text-center">
          <h1 className="text-lg font-semibold">Not allowed</h1>
          <p className="text-sm text-neutral-500 mt-2">{err.message}</p>
          <Link href="/documents" className="text-brand text-sm mt-4 inline-block">
            Back to documents
          </Link>
        </div>
      );
    }
    throw err;
  }
}
