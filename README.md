# agentic·dating

Every person gets an agent. The agents date each other. You get a ranking.

**200-character summary:** Paste a LinkedIn + public Instagram link per person; a Claude agent profiles them, agents go on simulated dates with each other, and a judge ranks who fits each person best.

## How it works
 
```
LinkedIn + Instagram (public) → Apify scrapers → condensed JSON
  → Profiler agent (Claude)  → profile: needs, hobbies, interests, values, personality, evidence
  → Matchmaker agent         → shortlist of K candidates per person (avoids N² dates)
  → Date simulator           → two agents, each knowing ONLY its own person, talk N turns at a venue
  → Judge agent              → chemistry / values / interests / lifestyle + directional fit for each side
  → Ranking                  → per-person list sorted by "how good is the other FOR me"
```

Design choices worth mentioning in the video:
- Each dating agent gets only its own profile; it learns about the partner only through the conversation.
- Evidence-cited profiles with a confidence note; sensitive traits are never inferred.
- Scores are directional (A→B can differ from B→A); mutual score is the average.
- Matchmaker shortlist keeps 25 people at ~100 dates instead of 300.

## Setup

```bash
npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY and APIFY_TOKEN
npm run dev                    # http://localhost:3000
```

### Run the whole 25-person demo from the CLI
```bash
cp people.example.json people.json   # put your 25+ {linkedinUrl, instagramUrl} pairs in it
npm run batch -- people.json --k 6 --turns 8
npm run dev                          # results are in data/db.json, visible on the site
```
Or use the "Bulk paste" tab on the home page. `GET /api/export` returns everything as JSON (the pre-run demo).

## Scraping (tech section)

- **Instagram:** Apify `apify/instagram-profile-scraper` (public profiles: bio, counts, latest posts + captions).
- **LinkedIn:** Apify `dev_fusion/linkedin-profile-scraper` (public profile fields).
- Called through Apify's `run-sync-get-dataset-items` REST endpoint; output is pruned into compact text so any actor's schema works.
- Actors change often: **check them in the Apify Store and test with 2 people first.** Swap via `LINKEDIN_ACTOR`, `INSTAGRAM_ACTOR`, `LINKEDIN_URL_FIELD` in `.env`.
- If a scraper is blocked, the form has a paste-text fallback so the person can still be profiled.

LLM: Anthropic Claude API (Sonnet for profiling/judging, Haiku for the dating turns; configurable).

## Deploy

The app stores data in a JSON file and runs dates as background jobs, so it needs a **persistent Node server**, not serverless. Use Railway, Render or Fly.io with a volume and set `DATA_FILE` to a path on it:
```
npm run build && npm start
```

## Privacy

Only for people who consented, or public figures with deliberately public profiles. Public data only; no sensitive-trait inference; anyone can be deleted (with their dates) from their profile page.

