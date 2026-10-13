import Link from "next/link";
import { readDB } from "@/lib/db";
import { bestPairs, rankingFor } from "@/lib/rank";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default function Rankings() {
  const db = readDB();
  const people = db.people.filter((p) => p.status === "ready");
  const pairs = bestPairs(db, 10);
  const running = db.job.status === "running";

  return (
    <>
      <AutoRefresh active={running} />
      <h1>Rankings</h1>
      <p className="sub">
        For every person: who fits them best, according to the dates their agent went on. {db.dates.length} dates so far{running ? " (still running…)" : ""}.
      </p>

      {pairs.length > 0 && (
        <div className="card" style={{ margin: "18px 0 26px" }}>
          <h2>Strongest mutual matches</h2>
          {pairs.map(({ d, mutual }, i) => {
            const a = db.people.find((p) => p.id === d.aId);
            const b = db.people.find((p) => p.id === d.bId);
            return (
              <div className="rank" key={d.id}>
                <div className="n">{i + 1}</div>
                <div>
                  <div>{a?.name} <span className="muted">×</span> {b?.name}</div>
                  <div className="small muted">{d.judge.verdict}</div>
                  <Link href={`/dates/${d.id}`} className="small">Watch the date →</Link>
                </div>
                <div className="score">{mutual}<small>mutual</small></div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {people.map((p) => {
          const top = rankingFor(db, p.id).slice(0, 5);
          return (
            <div className="card" key={p.id}>
              <div className="row sp"><h3 style={{ margin: 0 }}><Link href={`/people/${p.id}`}>{p.name}</Link></h3><span className="small muted">{p.profile?.vibe}</span></div>
              {top.length === 0 && <p className="small muted">No dates yet.</p>}
              {top.map((r) => (
                <div key={r.dateId} className="row sp small" style={{ padding: "6px 0", borderBottom: "1px dashed var(--line)" }}>
                  <span><b style={{ color: "var(--accent)" }}>{r.rank}</b> <Link href={`/dates/${r.dateId}`}>{r.otherName}</Link></span>
                  <b>{r.score}</b>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
