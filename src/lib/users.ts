import { all, one, run } from "./db";
import { newId } from "./id";
import type { User } from "./types";

type UserRow = { id: string; email: string; name: string };

function toUser(row: UserRow): User {
  return { id: row.id, email: row.email, name: row.name };
}

export async function findUserById(id: string): Promise<User | null> {
  const row = await one<UserRow>("SELECT id, email, name FROM users WHERE id = ?", [id]);
  return row ? toUser(row) : null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const row = await one<UserRow>("SELECT id, email, name FROM users WHERE email = ?", [
    email.toLowerCase(),
  ]);
  return row ? toUser(row) : null;
}

export async function listUsers(): Promise<User[]> {
  const rows = await all<UserRow>("SELECT id, email, name FROM users ORDER BY name ASC");
  return rows.map(toUser);
}

/**
 * Creates a user if one doesn't already exist with the given email. Used both
 * by the seed script and by the (mock) login flow so a reviewer can log in as
 * any email address without a password.
 */
export async function upsertUser(input: { email: string; name: string }): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  const id = newId("usr");
  await run("INSERT INTO users (id, email, name) VALUES (?, ?, ?)", [id, email, input.name.trim()]);
  return { id, email, name: input.name.trim() };
}
