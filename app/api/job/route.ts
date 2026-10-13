import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const db = readDB();
  return NextResponse.json({ job: db.job, dateCount: db.dates.length });
}
