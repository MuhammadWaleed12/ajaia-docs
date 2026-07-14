import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTestDb, resetTestDb } from "./helpers";
import { upsertUser } from "../src/lib/users";
import {
  createDocument,
  getDocumentForUser,
  listDocumentsForUser,
  listSharesForDocument,
  removeShare,
  updateDocument,
  upsertShare,
} from "../src/lib/documents";
import { HttpError } from "../src/lib/session";

beforeEach(async () => {
  await makeTestDb();
});
afterEach(async () => {
  await resetTestDb();
});

describe("document authorization", () => {
  it("owner can view and edit their own document", async () => {
    const alice = await upsertUser({ email: "alice@t.test", name: "Alice" });
    const doc = await createDocument({ ownerId: alice.id, title: "Mine" });

    const view = await getDocumentForUser(doc.id, alice.id, "view");
    expect(view.role).toBe("owner");
    const edit = await getDocumentForUser(doc.id, alice.id, "edit");
    expect(edit.role).toBe("owner");
  });

  it("a user with no share sees the document as if it does not exist (404)", async () => {
    const alice = await upsertUser({ email: "alice@t.test", name: "Alice" });
    const bob   = await upsertUser({ email: "bob@t.test",   name: "Bob" });
    const doc = await createDocument({ ownerId: alice.id, title: "Secret" });

    await expect(getDocumentForUser(doc.id, bob.id, "view")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("a viewer can view but cannot edit (403)", async () => {
    const alice = await upsertUser({ email: "alice@t.test", name: "Alice" });
    const bob   = await upsertUser({ email: "bob@t.test",   name: "Bob" });
    const doc = await createDocument({ ownerId: alice.id, title: "Read only" });
    await upsertShare({ documentId: doc.id, userId: bob.id, permission: "view" });

    const view = await getDocumentForUser(doc.id, bob.id, "view");
    expect(view.role).toBe("view");

    await expect(getDocumentForUser(doc.id, bob.id, "edit")).rejects.toBeInstanceOf(HttpError);
    await expect(getDocumentForUser(doc.id, bob.id, "edit")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("an editor can view and edit but is not the owner", async () => {
    const alice = await upsertUser({ email: "alice@t.test", name: "Alice" });
    const bob   = await upsertUser({ email: "bob@t.test",   name: "Bob" });
    const doc = await createDocument({ ownerId: alice.id, title: "Collab" });
    await upsertShare({ documentId: doc.id, userId: bob.id, permission: "edit" });

    const edit = await getDocumentForUser(doc.id, bob.id, "edit");
    expect(edit.role).toBe("edit");

    // Bob can actually update the document.
    const updated = await updateDocument(doc.id, { content: "<p>hi from bob</p>" });
    expect(updated.content).toBe("<p>hi from bob</p>");
  });

  it("upsertShare is idempotent and updates permission on repeat", async () => {
    const alice = await upsertUser({ email: "alice@t.test", name: "Alice" });
    const bob   = await upsertUser({ email: "bob@t.test",   name: "Bob" });
    const doc = await createDocument({ ownerId: alice.id, title: "X" });

    await upsertShare({ documentId: doc.id, userId: bob.id, permission: "view" });
    await upsertShare({ documentId: doc.id, userId: bob.id, permission: "edit" });

    const shares = await listSharesForDocument(doc.id);
    expect(shares).toHaveLength(1);
    expect(shares[0]).toMatchObject({ userId: bob.id, permission: "edit" });
  });

  it("removeShare revokes access", async () => {
    const alice = await upsertUser({ email: "alice@t.test", name: "Alice" });
    const bob   = await upsertUser({ email: "bob@t.test",   name: "Bob" });
    const doc = await createDocument({ ownerId: alice.id, title: "X" });

    await upsertShare({ documentId: doc.id, userId: bob.id, permission: "edit" });
    await removeShare(doc.id, bob.id);

    await expect(getDocumentForUser(doc.id, bob.id, "view")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("listDocumentsForUser", () => {
  it("returns owned + shared documents, marks role, and hides unrelated docs", async () => {
    const alice = await upsertUser({ email: "alice@t.test", name: "Alice" });
    const bob   = await upsertUser({ email: "bob@t.test",   name: "Bob" });
    const carol = await upsertUser({ email: "carol@t.test", name: "Carol" });

    const mine  = await createDocument({ ownerId: alice.id, title: "Mine" });
    const shared = await createDocument({ ownerId: bob.id,   title: "Bob's shared" });
    await createDocument({ ownerId: carol.id, title: "Carol's private" }); // Alice can't see

    await upsertShare({ documentId: shared.id, userId: alice.id, permission: "view" });

    const list = await listDocumentsForUser(alice.id);
    const byId = Object.fromEntries(list.map((d) => [d.id, d]));

    expect(list).toHaveLength(2);
    expect(byId[mine.id].ownerId).toBe(alice.id);
    expect(byId[mine.id].sharedPermission).toBeUndefined();
    expect(byId[shared.id].ownerId).toBe(bob.id);
    expect(byId[shared.id].sharedPermission).toBe("view");
    expect(byId[shared.id].ownerName).toBe("Bob");
  });
});
