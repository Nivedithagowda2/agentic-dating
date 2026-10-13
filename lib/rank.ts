import type { DB, DateRecord } from "./types";

export type RankRow = {
  rank: number;
  otherId: string;
  otherName: string;
  score: number; // how good the other is FOR this person
  theirScore: number; // how good this person is for the other
  mutual: number;
  reason: string;
  dateId: string;
  verdict: string;
};

export function scoreFor(d: DateRecord, personId: string) {
  return d.aId === personId ? d.judge.scoreForA : d.judge.scoreForB;
}

export function rankingFor(db: DB, personId: string): RankRow[] {
  const rows: Omit<RankRow, "rank">[] = [];
  for (const d of db.dates) {
    if (d.aId !== personId && d.bId !== personId) continue;
    const otherId = d.aId === personId ? d.bId : d.aId;
    const other = db.people.find((p) => p.id === otherId);
    if (!other) continue;
    const score = scoreFor(d, personId);
    const theirScore = scoreFor(d, otherId);
    rows.push({
      otherId,
      otherName: other.name,
      score,
      theirScore,
      mutual: Math.round((score + theirScore) / 2),
      reason: d.aId === personId ? d.judge.reasonA : d.judge.reasonB,
      dateId: d.id,
      verdict: d.judge.verdict,
    });
  }
  rows.sort((x, y) => y.score - x.score || y.mutual - x.mutual);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function bestPairs(db: DB, limit = 10) {
  return [...db.dates]
    .map((d) => ({ d, mutual: Math.round((d.judge.scoreForA + d.judge.scoreForB) / 2) }))
    .sort((x, y) => y.mutual - x.mutual)
    .slice(0, limit);
}
