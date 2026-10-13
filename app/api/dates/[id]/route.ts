import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const d = readDB().dates.find((x) => x.id === params.id);
  return d ? NextResponse.json(d) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
