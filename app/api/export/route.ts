import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { rankingFor } from "@/lib/rank";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Full results (profiles, date transcripts, rankings) as JSON: the "pre-run demo" artifact.
export async function GET() {
  const db = readDB();
  return NextResponse.json({
    people: db.people.map(({ sources, ...p }) => ({ ...p, ranking: rankingFor(db, p.id) })),
    dates: db.dates,
  });
}
