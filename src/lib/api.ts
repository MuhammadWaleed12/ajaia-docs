import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./session";

export function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof HttpError) return jsonError(err.status, err.message);
  if (err instanceof ZodError) return jsonError(400, "Invalid request body", err.flatten());
  console.error(err);
  return jsonError(500, "Internal server error");
}

export const runtime = "nodejs"; // libSQL + mammoth need node runtime
