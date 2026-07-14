import { getSessionUser } from "@/lib/session";
import { listDocumentsForUser } from "@/lib/documents";
import DocumentsDashboard from "./DocumentsDashboard";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const documents = await listDocumentsForUser(user.id);
  return <DocumentsDashboard currentUserId={user.id} initialDocuments={documents} />;
}
