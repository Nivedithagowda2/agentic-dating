import Link from "next/link";
import { notFound } from "next/navigation";
import { readDB } from "@/lib/db";
import { rankingFor } from "@/lib/rank";
import AutoRefresh from "@/components/AutoRefresh";
import DeleteButton from "@/components/DeleteButton";
import RetryButton from "@/components/RetryButton";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

function Section({ title, items }: { title: string; items: Profile["needs"] }) {
  if (!items?.length) return null;
  return (
    <div className="card">
      <h3>{title}</h3>
      {items.map((it, i) => (
        <div className="item" key={i}>
          <div>{it.label} <span className="pill">{it.source}</span></div>
          {it.evidence && <div className="ev">↳ {it.evidence}</div>}
        </div>
      ))}
    </div>
  );
}

export default function PersonPage({ params }: { params: { id: string } }) {
  const db = readDB();
  const p = db.people.find((x) => x.id === params.id);
  if (!p) notFound();
  const pr = p.profile;
  const ranking = rankingFor(db, p.id);
  const working = ["queued", "scraping", "profiling"].includes(p.status) || db.job.status === "running";

  return (
    <>
      <AutoRefresh active={working} />
      <div className="row sp">
        <div>
          <h1 style={{ marginBottom: 2 }}>{p.name}</h1>
          <div className="row small">
            <span className={`pill ${p.status}`}>{p.status}</span>
            <a href={p.linkedinUrl} target="_blank">LinkedIn ↗</a>
            <a href={p.instagramUrl} target="_blank">Instagram ↗</a>
          </div>
        </div>
        <div className="row"><RetryButton id={p.id} /><DeleteButton id={p.id} /></div>
      </div>

      {p.status === "error" && <p className="err">{p.error}</p>}
      {!pr && p.status !== "error" && <p className="muted">The agent is reading both sources… this page updates by itself.</p>}

      {pr && (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="muted small" style={{ textTransform: "uppercase", letterSpacing: ".08em" }}>{pr.vibe}</div>
            <h2 style={{ marginTop: 4 }}>{pr.headline}</h2>
            <p style={{ margin: "0 0 10px" }}>{pr.summary}</p>
            <div className="small muted">
              {[pr.role, pr.location].filter(Boolean).join(" · ")}
            </div>
            <div style={{ marginTop: 10 }}>{pr.tags.map((t) => <span key={t} className="chip">{t}</span>)}</div>
            <div className="small" style={{ marginTop: 6 }}>
              <span className="pill">confidence: {pr.confidence}</span> <span className="muted">{pr.confidenceNote}</span>
            </div>
          </div>

          <div className="two" style={{ marginTop: 16 }}>
            <Section title="Needs" items={pr.needs} />
            <Section title="Hobbies" items={pr.hobbies} />
            <Section title="Interests" items={pr.interests} />
            <Section title="Values" items={pr.values} />
            <Section title="Personality" items={pr.personality} />
            <div className="card">
              <h3>Looking for</h3>
              <p className="small" style={{ marginTop: 0 }}>{pr.lookingFor}</p>
              <h3>Communication style</h3>
              <p className="small" style={{ marginTop: 0 }}>{pr.communicationStyle}</p>
              {pr.dealBreakers.length > 0 && (<><h3>Deal-breakers</h3><ul className="small">{pr.dealBreakers.map((d, i) => <li key={i}>{d}</li>)}</ul></>)}
              {pr.conversationHooks.length > 0 && (<><h3>Conversation hooks</h3><ul className="small">{pr.conversationHooks.map((d, i) => <li key={i}>{d}</li>)}</ul></>)}
            </div>
          </div>
        </>
      )}

      <h2 style={{ marginTop: 30 }}>Best fits for {p.name.split(" ")[0]}</h2>
      {ranking.length === 0 && <p className="muted">No dates yet. Start the dates from the home page.</p>}
      <div className="card">
        {ranking.map((r) => (
          <div className="rank" key={r.dateId}>
            <div className="n">{r.rank}</div>
            <div>
              <div><Link href={`/people/${r.otherId}`}>{r.otherName}</Link> <span className="muted small">· they rate you {r.theirScore}</span></div>
              <div className="small muted">{r.reason}</div>
              <Link href={`/dates/${r.dateId}`} className="small">Watch the date →</Link>
            </div>
            <div className="score">{r.score}<small>fit for you</small></div>
          </div>
        ))}
      </div>

      <details style={{ marginTop: 24 }}>
        <summary>What the agent actually read (the two sources)</summary>
        <h3 style={{ marginTop: 12 }}>LinkedIn</h3>
        <pre>{p.sources.linkedin || p.sources.manualLinkedin || `unavailable: ${p.sources.linkedinError}`}</pre>
        <h3>Instagram</h3>
        <pre>{p.sources.instagram || p.sources.manualInstagram || `unavailable: ${p.sources.instagramError}`}</pre>
      </details>
    </>
  );
}
