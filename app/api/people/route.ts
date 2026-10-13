import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { addPeople } from "@/lib/pipeline";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const db = readDB();
  return NextResponse.json({
    people: db.people.map(({ sources, ...p }) => ({ ...p, sourceStatus: { linkedin: !!sources.linkedin, instagram: !!sources.instagram } })),
  });
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const results = addPeople([{ linkedinUrl: b.linkedinUrl, instagramUrl: b.instagramUrl, linkedinText: b.linkedinText, instagramText: b.instagramText }], !!b.consent);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
