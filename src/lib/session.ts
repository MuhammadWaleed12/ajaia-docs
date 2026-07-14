import { cookies } from "next/headers";
import { ensureInitialized } from "./init";
import { findUserById } from "./users";
import type { User } from "./types";

const COOKIE_NAME = "ajaia_uid";

export const SESSION_COOKIE = COOKIE_NAME;

/**
 * Returns the currently signed-in user, or null. Uses a simple cookie storing
 * the user id. This is *mocked auth*: we don't verify a password. The task
 * scope permits this; see README "Security notes".
 */
export async function getSessionUser(): Promise<User | null> {
  await ensureInitialized();
  const jar = cookies();
  const uid = jar.get(COOKIE_NAME)?.value;
  if (!uid) return null;
  return findUserById(uid);
}

export async function requireSessionUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Not authenticated");
  return user;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function setSessionCookie(userId: string) {
  cookies().set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}
