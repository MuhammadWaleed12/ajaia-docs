import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto p-10 text-center">
      <h1 className="text-lg font-semibold">Document not found</h1>
      <p className="text-sm text-neutral-500 mt-2">
        It may have been deleted, or you don&apos;t have access.
      </p>
      <Link href="/documents" className="text-brand text-sm mt-4 inline-block">
        Back to documents
      </Link>
    </div>
  );
}
