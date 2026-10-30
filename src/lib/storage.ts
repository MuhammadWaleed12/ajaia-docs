import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { newId } from "./id";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — keep local storage bounded

export const MAX_UPLOAD_BYTES = MAX_FILE_BYTES;

/**
 * Uploads live on the local filesystem under `UPLOAD_DIR/<yyyymm>/<uuid>`.
 * We store the raw bytes and let the DB carry the human filename + mime type.
 * For hosted deployments swap this out with S3/R2/Supabase Storage; the
 * interface (writeUpload / readUpload) is intentionally small.
 */
function uploadRoot(): string {
  return resolve(process.env.UPLOAD_DIR ?? "./uploads");
}

function resolveUploadPath(relPath: string): string {
  const root = uploadRoot();
  const full = resolve(root, relPath);
  const fromRoot = relative(root, full);
  if (
    !fromRoot ||
    fromRoot === ".." ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot)
  ) {
    throw new Error("Invalid storage path");
  }
  return full;
}

export async function writeUpload(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error(`File too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB)`);
  }
  const now = new Date();
  const bucket = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const dir = join(uploadRoot(), bucket);
  await mkdir(dir, { recursive: true });
  const filename = newId();
  const full = join(dir, filename);
  await writeFile(full, bytes);
  // Return the *relative* path we can safely store in the DB.
  return join(bucket, filename);
}

export async function readUpload(relPath: string): Promise<Buffer> {
  return readFile(resolveUploadPath(relPath));
}

export async function deleteUpload(relPath: string): Promise<void> {
  try {
    await unlink(resolveUploadPath(relPath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
