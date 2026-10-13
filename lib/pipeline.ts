import { mutate, readDB, uid, pool } from "./db";
import { scrapeInstagram, scrapeLinkedIn } from "./scrape";
import { profilePerson } from "./profiler";
import { runDate } from "./dating";
import { jsonCall, MODELS } from "./llm";
import { ShortlistSchema } from "./schemas";
import type { Person, PersonInput, Job } from "./types";

/* ---------- URL parsing ---------- */

export function parseLinkedIn(raw: string): string | null {
  const m = raw?.trim().match(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([^/?#\s,;]+)/i);
  return m ? `https://www.linkedin.com/in/${m[1].toLowerCase()}` : null;
}

export function parseInstagram(raw: string): string | null {
  const s = raw?.trim() || "";
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)/i) || s.match(/^@([A-Za-z0-9._]+)$/);
  if (!m) return null;
  const u = m[1].toLowerCase();
  return ["p", "reel", "reels", "explore", "stories", "accounts"].includes(u) ? null : u;
}

function nameFromSlug(url: string) {
  const slug = url.split("/in/")[1] || "";
  return (
    slug
      .replace(/-[0-9a-f]{6,}$/i, "")
      .split("-")
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ") || "Unknown"
  );
}

const nameTokens = (s?: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 3);

/* ---------- adding + profiling people ---------- */

export function addPeople(inputs: PersonInput[], consent: boolean) {
  if (!consent) throw new Error("You must confirm that these people agreed to be included, or that they are public figures.");
  const results: { input: PersonInput; person?: Person; error?: string }[] = [];
  const newIds: string[] = [];
  mutate((db) => {
    for (const input of inputs) {
      const li = parseLinkedIn(input.linkedinUrl);
      const ig = parseInstagram(input.instagramUrl);
      if (!li || !ig) {
        results.push({ input, error: "Need a valid linkedin.com/in/… link and a public instagram.com/… link" });
        continue;
      }
      const existing = db.people.find((p) => p.linkedinUrl === li);
      if (existing) {
        results.push({ input, person: existing, error: "Already added" });
        continue;
      }
      const person: Person = {
        id: uid("p"),
        name: nameFromSlug(li),
        linkedinUrl: li,
        instagramUrl: `https://www.instagram.com/${ig}`,
        instagramUser: ig,
        status: "queued",
        sources: { manualLinkedin: input.linkedinText?.slice(0, 8000), manualInstagram: input.instagramText?.slice(0, 8000) },
        createdAt: Date.now(),
      };
      db.people.push(person);
      results.push({ input, person });
      newIds.push(person.id);
    }
  });
  void processMany(newIds);
  return results;
}

export async function processMany(ids: string[]) {
  // One person at a time keeps us inside Apify plan limits and Groq rate limits.
  await pool(ids, 1, (id) => processPerson(id));
}

function patch(id: string, fn: (p: Person) => void) {
  mutate((db) => {
    const p = db.people.find((x) => x.id === id);
    if (p) fn(p);
  });
}

export async function processPerson(id: string) {
  const start = readDB().people.find((p) => p.id === id);
  if (!start) return;
  try {
    patch(id, (p) => {
      p.status = "scraping";
      p.error = undefined;
    });

    // Already-scraped sources are reused, so Retry only costs Apify credits for what is missing.
    const cached = new Error("cached");
    const [li, ig] = await Promise.allSettled([
      start.sources.linkedin ? Promise.reject(cached) : scrapeLinkedIn(start.linkedinUrl),
      start.sources.instagram ? Promise.reject(cached) : scrapeInstagram(start.instagramUser),
    ]);

    patch(id, (p) => {
      if (li.status === "fulfilled") {
        p.sources.linkedin = li.value.text;
        p.sources.linkedinError = undefined;
        if (li.value.name) p.name = li.value.name;
      } else if (li.reason !== cached) {
        p.sources.linkedinError = String(li.reason?.message || li.reason);
      }

      if (ig.status === "fulfilled") {
        p.sources.instagram = ig.value.text;
        p.sources.instagramError = undefined;
        const liGaveName = li.status === "fulfilled" && !!li.value.name;
        if (!liGaveName && ig.value.name) p.name = ig.value.name;
      } else if (ig.reason !== cached) {
        p.sources.instagramError = String(ig.reason?.message || ig.reason);
      }
    });

    // Warn (do not block) if the two links look like different people.
    const liName = li.status === "fulfilled" ? li.value.name : undefined;
    const igName = ig.status === "fulfilled" ? ig.value.name : undefined;
    if (liName && igName) {
      const a = nameTokens(liName);
      const b = nameTokens(igName);
      const match = a.some((t) => b.some((u) => u.includes(t) || t.includes(u)));
      patch(id, (p) => {
        p.sources.identityNote = match
          ? undefined
          : `Name mismatch: LinkedIn "${liName}" vs Instagram "${igName}". Check both links belong to the same person.`;
      });
    }

    const person = readDB().people.find((p) => p.id === id)!;
    const hasLi = person.sources.linkedin || person.sources.manualLinkedin;
    const hasIg = person.sources.instagram || person.sources.manualInstagram;
    if (!hasLi && !hasIg) {
      throw new Error(
        `No data from either source. LinkedIn: ${person.sources.linkedinError}. Instagram: ${person.sources.instagramError}`
      );
    }

    patch(id, (p) => {
      p.status = "profiling";
    });
    const profile = await profilePerson(person);
    patch(id, (p) => {
      p.profile = profile;
      p.status = "ready";
    });
  } catch (e) {
    patch(id, (p) => {
      p.status = "error";
      p.error = (e as Error).message;
    });
  }
}

/* ---------- matching job ---------- */

function setJob(fn: (j: Job) => void) {
  mutate((db) => {
    fn(db.job);
    db.job.updatedAt = Date.now();
  });
}

const log = (msg: string) =>
  setJob((j) => {
    j.log = [...j.log.slice(-79), msg];
  });

function overlap(a: string[], b: string[]) {
  const A = new Set(a.map((x) => x.toLowerCase()));
  const B = new Set(b.map((x) => x.toLowerCase()));
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / Math.max(1, A.size + B.size - inter);
}

export async function runMatching(opts: { k?: number; turns?: number } = {}) {
  const k = Math.max(1, Math.min(24, opts.k ?? 6));
  const turns = Math.max(4, Math.min(14, opts.turns ?? 8));
  const started = mutate((db) => {
    const stale = db.job.status === "running" && Date.now() - (db.job.updatedAt || 0) > 10 * 60 * 1000;
    if (db.job.status === "running" && !stale) return false;
    db.job = {
      status: "running",
      phase: "Shortlisting candidates",
      total: 0,
      done: 0,
      log: [],
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    return true;
  });
  if (!started) return;

  try {
    const people = readDB().people.filter((p) => p.status === "ready" && p.profile);
    if (people.length < 2) throw new Error("Need at least 2 profiled people");
    const K = Math.min(k, people.length - 1);
    const pairs = new Map<string, [string, string]>();
    const addPair = (x: string, y: string) => {
      const [a, b] = [x, y].sort();
      pairs.set(`${a}_${b}`, [a, b]);
    };

    // Step 1: each person's matchmaker shortlists K candidates (one call per person, not per pair).
    log(`Matchmaker is shortlisting the best ${K} candidates for each of ${people.length} people`);
    await pool(people, 2, async (me) => {
      const others = people.filter((o) => o.id !== me.id);
      let picks: string[];
      if (others.length <= K) {
        picks = others.map((o) => o.id);
      } else {
        try {
          const card = (p: Person) => ({
            id: p.id,
            name: p.name,
            headline: p.profile!.headline,
            interests: p.profile!.tags,
            values: p.profile!.values.map((v) => v.label),
            needs: p.profile!.needs.map((v) => v.label),
            lookingFor: p.profile!.lookingFor,
          });
          const res = await jsonCall({
            model: MODELS.judge(),
            schema: ShortlistSchema,
            maxTokens: 1500,
            system: `You are a matchmaker. Given one person and a pool of candidates, choose exactly ${K} candidates most likely to be a strong match for the person (shared values, complementary needs, compatible lifestyle). Return {"picks":[{"id":"","why":""}]} ordered best first. Use only ids from the pool.`,
            user: `PERSON: ${JSON.stringify(card(me))}\n\nPOOL: ${JSON.stringify(others.map(card))}`,
          });
          const valid = new Set(others.map((o) => o.id));
          picks = res.picks.map((p) => p.id).filter((pid) => valid.has(pid));
        } catch {
          picks = [];
        }
        if (picks.length < K) {
          const rest = others
            .filter((o) => !picks.includes(o.id))
            .sort((x, y) => overlap(me.profile!.tags, y.profile!.tags) - overlap(me.profile!.tags, x.profile!.tags));
          picks = [...picks, ...rest.map((o) => o.id)].slice(0, K);
        }
      }
      picks.slice(0, K).forEach((pid) => addPair(me.id, pid));
    });

    // Step 2: agents go on the dates (pairs already dated are skipped).
    const done = new Set(readDB().dates.map((d) => d.id));
    const todo = [...pairs.entries()].filter(([pid]) => !done.has(pid)).map(([, v]) => v);
    setJob((j) => {
      j.phase = "Agents are dating";
      j.total = todo.length;
      j.done = 0;
    });
    log(`${todo.length} dates to run (${pairs.size - todo.length} already done)`);

    const conc = Number(process.env.DATE_CONCURRENCY || 2);
    await pool(todo, conc, async ([aId, bId]) => {
      const db = readDB();
      const a = db.people.find((p) => p.id === aId)!;
      const b = db.people.find((p) => p.id === bId)!;
      try {
        const rec = await runDate(a, b, turns);
        mutate((d) => {
          d.dates = d.dates.filter((x) => x.id !== rec.id);
          d.dates.push(rec);
        });
        log(`${a.name} × ${b.name} → ${rec.judge.scoreForA} / ${rec.judge.scoreForB}`);
      } catch (e) {
        log(`⚠ ${a.name} × ${b.name} failed: ${(e as Error).message.slice(0, 120)}`);
      }
      setJob((j) => void (j.done += 1));
    });

    setJob((j) => {
      j.status = "done";
      j.phase = "Done";
    });
    log("All dates finished. Rankings are ready.");
  } catch (e) {
    setJob((j) => {
      j.status = "error";
      j.error = (e as Error).message;
      j.phase = "Error";
    });
  }
}