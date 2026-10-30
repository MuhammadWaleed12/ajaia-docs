import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteUpload, readUpload, writeUpload } from "../src/lib/storage";

let previousUploadDir: string | undefined;
let uploadDir: string;

beforeEach(async () => {
  previousUploadDir = process.env.UPLOAD_DIR;
  uploadDir = await mkdtemp(join(tmpdir(), "ajaia-storage-"));
  process.env.UPLOAD_DIR = uploadDir;
});

afterEach(() => {
  if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = previousUploadDir;
});

describe("upload storage", () => {
  it("deletes a stored upload and treats repeated cleanup as idempotent", async () => {
    const storedPath = await writeUpload(new TextEncoder().encode("report"));

    await expect(readUpload(storedPath)).resolves.toEqual(Buffer.from("report"));
    await expect(deleteUpload(storedPath)).resolves.toBeUndefined();
    await expect(deleteUpload(storedPath)).resolves.toBeUndefined();
    await expect(readUpload(storedPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects traversal without deleting a file outside the upload root", async () => {
    const outsidePath = join(uploadDir, "..", "outside-upload.txt");
    await writeFile(outsidePath, "keep me");

    await expect(deleteUpload("../outside-upload.txt")).rejects.toThrow(
      "Invalid storage path"
    );
    await expect(readFile(outsidePath, "utf8")).resolves.toBe("keep me");
  });
});
