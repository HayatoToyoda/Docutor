import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function notImplemented(message: string) {
  return jsonError(message, 501);
}
