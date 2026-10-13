/**
 * Scraping via Apify actors (no LinkedIn/Instagram login handled by us).
 * Only public data from the two supplied links is fetched.
 */

const APIFY = "https://api.apify.com/v2";

async function runActor(actor: string, input: unknown): Promise<any[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");
  const url = `${APIFY}/acts/${actor.replace("/", "~")}/run-sync-get-dataset-items?token=${token}&timeout=150`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Apify ${actor} failed (${res.status}): ${(await res.text()).replace(/\s+/g, " ").slice(0, 800)}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// Strip nulls/empties/image URLs and cap sizes, so any actor's output becomes compact text for the agent.
function prune(v: any, depth = 0): any {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return undefined;
    if (
      /^https?:\/\/\S+\.(jpg|jpeg|png|webp|gif)/i.test(s) ||
      /cdninstagram|licdn\.com\/dms|media\.licdn|fbcdn/.test(s)
    )
      return undefined;
    return s.length > 500 ? s.slice(0, 500) + "…" : s;
  }
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) {
    const a = v.slice(0, 15).map((x) => prune(x, depth + 1)).filter((x) => x !== undefined);
    return a.length ? a : undefined;
  }
  if (typeof v === "object") {
    if (depth > 4) return undefined;
    const o: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) {
      const p = prune(val, depth + 1);
      if (p !== undefined) o[k] = p;
    }
    return Object.keys(o).length ? o : undefined;
  }
  return undefined;
}

const condense = (x: unknown, max = 9000) => (JSON.stringify(prune(x)) || "").slice(0, max);
const trunc = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : undefined);

// LinkedIn actors return lots of fields the agent does not need (image links, IDs, and
// "people also viewed" lists of OTHER people). Remove them so only this person's data is read.
const NOISE_KEY = /(Url|Urls|Id|Ids|Logo|Image|Images|Photo|Picture)$|^(url|id|sizes|photo|image|logo|picture|link)$/;
const TOP_DROP = [
  "moreProfiles",
  "composeOptionType",
  "sectionTotals",
  "profileLocales",
  "primaryLocale",
  "multiLocaleHeadline",
  "coverPicture",
  "originalQuery",
  "services",
];

function stripNoise(v: any): any {
  if (Array.isArray(v)) return v.map(stripNoise);
  if (v && typeof v === "object") {
    const o: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) {
      if (!NOISE_KEY.test(k)) o[k] = stripNoise(val);
    }
    return o;
  }
  return v;
}

export async function scrapeLinkedIn(url: string) {
  const actor = process.env.LINKEDIN_ACTOR || "harvestapi/linkedin-profile-scraper";
  const field = process.env.LINKEDIN_URL_FIELD || "urls";
  const items = await runActor(actor, { [field]: [url] });
  const item = items[0];
  if (!item) throw new Error("LinkedIn scraper returned no data (profile may be restricted or the link is wrong)");

  const name: string | undefined =
    item.fullName || item.name || [item.firstName, item.lastName].filter(Boolean).join(" ") || undefined;

  const slim = stripNoise(Object.fromEntries(Object.entries(item).filter(([k]) => !TOP_DROP.includes(k))));
  return { name, text: condense(slim) };
}

export async function scrapeInstagram(username: string) {
  const actor = process.env.INSTAGRAM_ACTOR || "apify/instagram-profile-scraper";
  const items = await runActor(actor, { usernames: [username] });
  const item = items[0];
  if (!item || item.error) throw new Error("Instagram scraper returned no data (check the handle)");
  if (item.private || item.isPrivate) throw new Error("Instagram profile is private");

  const posts = (item.latestPosts || []).slice(0, 20).map((p: any) => ({
    caption: trunc(p.caption, 300),
    hashtags: Array.isArray(p.hashtags) ? p.hashtags.slice(0, 8) : undefined,
    location: p.locationName,
    likes: p.likesCount,
    type: p.type,
    when: trunc(p.timestamp, 10),
    tagged: Array.isArray(p.taggedUsers) ? p.taggedUsers.map((u: any) => u.username).slice(0, 3) : undefined,
  }));

  const slim = {
    username: item.username,
    fullName: item.fullName,
    biography: item.biography,
    followers: item.followersCount,
    following: item.followsCount,
    postsCount: item.postsCount,
    category: item.businessCategoryName,
    externalUrl: item.externalUrl,
    verified: item.verified,
    recentPosts: posts,
  };
  return { name: item.fullName as string | undefined, text: condense(slim) };
}