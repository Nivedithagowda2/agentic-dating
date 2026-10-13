import { NextResponse } from "next/server";
import { processPerson } from "@/lib/pipeline";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  void processPerson(params.id);
  return NextResponse.json({ ok: true });
}
