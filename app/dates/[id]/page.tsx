import Link from "next/link";
import { notFound } from "next/navigation";
import { readDB } from "@/lib/db";

export const dynamic = "force-dynamic";

function Metric({ label, v }: { label: string; v: number }) {
  return (
    <div className="metric"><span className="muted">{label}</span><div className="bar"><i style={{ width: `${v}%` }} /></div><b>{v}</b></div>
  );
}

export default function DatePage({ params }: { params: { id: string } }) {
  const db = readDB();
  const d = db.dates.find((x) => x.id === params.id);
  if (!d) notFound();
  const a = db.people.find((p) => p.id === d.aId);
  const b = db.people.find((p) => p.id === d.bId);
  if (!a || !b) notFound();
  const j = d.judge;

  return (
    <>
      <p className="small"><Link href="/">← People</Link></p>
      <h1><Link href={`/people/${a.id}`}>{a.name}</Link> <span className="muted">×</span> <Link href={`/people/${b.id}`}>{b.name}</Link></h1>
      <p className="muted">Two agents, one first date, at {d.venue}.</p>

      <div className="two">
        <div className="card">
          <h2>The date</h2>
          <div className="chat">
            {d.turns.map((t, i) => (
              <div key={i} className={`bubble ${t.speaker}`}>
                <div className="who">{t.speaker === "a" ? a.name : b.name}&apos;s agent</div>
                {t.text}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="card">
            <h2>The judge</h2>
            <p style={{ marginTop: 0 }}>{j.verdict}</p>
            <Metric label="Chemistry" v={j.chemistry} />
            <Metric label="Values fit" v={j.valuesFit} />
            <Metric label="Interest overlap" v={j.interestOverlap} />
            <Metric label="Lifestyle fit" v={j.lifestyleFit} />
          </div>
          <div className="card" style={{ marginTop: 14 }}>
            <h3>{b.name} for {a.name}: <span style={{ color: "var(--accent)" }}>{j.scoreForA}</span></h3>
            <p className="small muted" style={{ marginTop: 0 }}>{j.reasonA}</p>
            <h3>{a.name} for {b.name}: <span style={{ color: "var(--accent)" }}>{j.scoreForB}</span></h3>
            <p className="small muted" style={{ marginTop: 0 }}>{j.reasonB}</p>
            <h3>Best moment</h3>
            <p className="small muted" style={{ marginTop: 0 }}>{j.bestMoment}</p>
            <h3>Friction</h3>
            <p className="small muted" style={{ marginTop: 0 }}>{j.friction}</p>
          </div>
        </div>
      </div>
    </>
  );
}
