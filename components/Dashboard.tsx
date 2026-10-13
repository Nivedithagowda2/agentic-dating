"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Job } from "@/lib/types";

type PersonLite = {
  id: string;
  name: string;
  status: "queued" | "scraping" | "profiling" | "ready" | "error";
  error?: string;
  instagramUser: string;
  profile?: { headline: string; vibe: string };
};

export default function Dashboard() {
  const [people, setPeople] = useState<PersonLite[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [dateCount, setDateCount] = useState(0);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [li, setLi] = useState("");
  const [ig, setIg] = useState("");
  const [liText, setLiText] = useState("");
  const [igText, setIgText] = useState("");
  const [bulk, setBulk] = useState("");
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [k, setK] = useState(6);
  const [turns, setTurns] = useState(8);

  const refresh = useCallback(async () => {
    try {
      const [p, j] = await Promise.all([fetch("/api/people").then((r) => r.json()), fetch("/api/job").then((r) => r.json())]);
      setPeople(p.people || []);
      setJob(j.job);
      setDateCount(j.dateCount);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [refresh]);

  async function submit() {
    setMsg("");
    setBusy(true);
    try {
      let res;
      if (mode === "single") {
        res = await fetch("/api/people", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkedinUrl: li, instagramUrl: ig, linkedinText: liText, instagramText: igText, consent }),
        });
      } else {
        const list = bulk
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const parts = l.split(/[\s,;|\t]+/).filter(Boolean);
            const linkedinUrl = parts.find((p) => /linkedin\.com/i.test(p)) || "";
            const instagramUrl = parts.find((p) => /instagram\.com|^@/i.test(p)) || "";
            return { linkedinUrl, instagramUrl };
          });
        res = await fetch("/api/people/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ people: list, consent }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const errs = (data.results as any[]).filter((r) => r.error);
      const ok = (data.results as any[]).length - errs.length;
      setMsg(`${ok} added, agents are reading them now.` + (errs.length ? ` ${errs.length} skipped: ${errs[0].error}` : ""));
      if (ok) {
        setLi("");
        setIg("");
        setLiText("");
        setIgText("");
        setBulk("");
      }
      refresh();
    } catch (e) {
      setMsg("⚠ " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    setMsg("");
    const res = await fetch("/api/match/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ k, turns }),
    });
    const d = await res.json();
    if (!res.ok) setMsg("⚠ " + d.error);
    refresh();
  }

  const ready = people.filter((p) => p.status === "ready").length;
  const running = job?.status === "running";
  const pct = job && job.total ? Math.round((job.done / job.total) * 100) : 0;

  return (
    <>
      <h1>Let your agent do the dating.</h1>
      <p className="sub">
        Paste a LinkedIn link and a public Instagram link for each person. An agent reads both, writes a profile, then dates every other agent on their behalf. You get a ranking of who fits best.
      </p>

      <div className="two" style={{ marginTop: 22 }}>
        <div className="card">
          <h2>1 · Add people</h2>
          <div className="tabs">
            <button className={mode === "single" ? "on" : ""} onClick={() => setMode("single")}>One person</button>
            <button className={mode === "bulk" ? "on" : ""} onClick={() => setMode("bulk")}>Bulk paste (25+)</button>
          </div>
          {mode === "single" ? (
            <>
              <label>LinkedIn profile URL</label>
              <input type="text" placeholder="https://www.linkedin.com/in/…" value={li} onChange={(e) => setLi(e.target.value)} />
              <label>Public Instagram URL</label>
              <input type="text" placeholder="https://www.instagram.com/…" value={ig} onChange={(e) => setIg(e.target.value)} />
              <details style={{ marginTop: 8 }}>
                <summary className="small">Scraper blocked? Paste the profile text instead (fallback)</summary>
                <label>LinkedIn text (about, experience…)</label>
                <textarea value={liText} onChange={(e) => setLiText(e.target.value)} />
                <label>Instagram bio and captions</label>
                <textarea value={igText} onChange={(e) => setIgText(e.target.value)} />
              </details>
            </>
          ) : (
            <>
              <label>One person per line: LinkedIn URL, then Instagram URL</label>
              <textarea
                style={{ minHeight: 170 }}
                placeholder={"https://linkedin.com/in/jane, https://instagram.com/jane\nhttps://linkedin.com/in/john, https://instagram.com/john"}
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
              />
            </>
          )}
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--text)" }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 4 }} />
            <span className="small">I confirm these people agreed to be included, or are public figures sharing public profiles on purpose.</span>
          </label>
          <div className="row" style={{ marginTop: 12 }}>
            <button disabled={busy || !consent} onClick={submit}>{busy ? "Adding…" : "Read these people"}</button>
            {msg && <span className={msg.startsWith("⚠") ? "err" : "small muted"}>{msg}</span>}
          </div>
        </div>

        <div className="card">
          <h2>2 · Send the agents on dates</h2>
          <p className="small muted">
            A matchmaker shortlists the best candidates for each person, then the two agents meet, talk it out turn by turn, and a judge scores the fit both ways.
          </p>
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>Dates per person (shortlist)</label>
              <input type="number" min={1} max={24} value={k} onChange={(e) => setK(Number(e.target.value))} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Turns per date</label>
              <input type="number" min={4} max={14} value={turns} onChange={(e) => setTurns(Number(e.target.value))} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button disabled={ready < 2 || running} onClick={run}>{running ? "Dating in progress…" : `Start the dates (${ready} ready)`}</button>
            <Link href="/rankings" className="small">Open rankings →</Link>
          </div>
          {job && job.status !== "idle" && (
            <div style={{ marginTop: 14 }}>
              <div className="row sp small">
                <span>{job.phase}{job.total ? ` · ${job.done}/${job.total} dates` : ""}</span>
                <span className="muted">{dateCount} dates total</span>
              </div>
              <div className="bar" style={{ margin: "6px 0 10px" }}><i style={{ width: `${running && !job.total ? 5 : pct}%` }} /></div>
              {job.error && <div className="err">{job.error}</div>}
              <div className="log">{job.log.slice().reverse().map((l, i) => <div key={i}>{l}</div>)}</div>
            </div>
          )}
        </div>
      </div>

      <h2 style={{ marginTop: 30 }}>People ({people.length})</h2>
      {people.length === 0 && <p className="muted">Nobody yet. Add the first person above.</p>}
      <div className="grid">
        {people.map((p) => (
          <Link key={p.id} href={`/people/${p.id}`} className="card link">
            <div className="row sp">
              <h3 style={{ margin: 0 }}>{p.name}</h3>
              <span className={`pill ${p.status}`}>{p.status}</span>
            </div>
            <div className="small muted">@{p.instagramUser}</div>
            <p className="small" style={{ margin: "8px 0 0" }}>
              {p.profile?.vibe || p.profile?.headline || (p.status === "error" ? <span className="err">{p.error?.slice(0, 110)}</span> : "Agent is reading…")}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
