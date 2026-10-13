import { NextResponse } from "next/server";
import { runMatching } from "@/lib/pipeline";
import { readDB } from "@/lib/db";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const ready = readDB().people.filter((p) => p.status === "ready").length;
  if (ready < 2) return NextResponse.json({ error: "Need at least 2 profiled people first" }, { status: 400 });
  void runMatching({ k: Number(b.k) || 6, turns: Number(b.turns) || 8 });
  return NextResponse.json({ ok: true });
}
