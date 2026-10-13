import { NextResponse } from "next/server";
import { addPeople } from "@/lib/pipeline";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const results = addPeople(b.people || [], !!b.consent);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
