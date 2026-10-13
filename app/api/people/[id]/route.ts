import { NextResponse } from "next/server";
import { mutate, readDB } from "@/lib/db";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const p = readDB().people.find((x) => x.id === params.id);
  return p ? NextResponse.json(p) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  mutate((db) => {
    db.people = db.people.filter((p) => p.id !== params.id);
    db.dates = db.dates.filter((d) => d.aId !== params.id && d.bId !== params.id);
  });
  return NextResponse.json({ ok: true });
}
