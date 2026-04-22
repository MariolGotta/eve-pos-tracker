import { NextResponse } from "next/server";

/**
 * NextResponse.json() does not support BigInt.
 * This helper serializes BigInt as strings so the JSON doesn't blow up.
 */
function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}

export function jsonBig(
  data: unknown,
  init?: ResponseInit
): NextResponse {
  const body = JSON.stringify(data, bigIntReplacer);
  return new NextResponse(body, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}
