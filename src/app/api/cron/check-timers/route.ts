import { checkTimers } from "@/server/cron";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const result = await checkTimers();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Cron error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
