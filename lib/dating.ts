import { chat, jsonCall, MODELS } from "./llm";
import { JudgeSchema } from "./schemas";
import type { DateRecord, Person, Turn } from "./types";

const VENUES: [string[], string][] = [
  [["music", "concert", "guitar", "dj", "festival"], "a small live-music bar"],
  [["cooking", "food", "baking", "coffee", "restaurant", "wine"], "a casual street-food market"],
  [["running", "hiking", "climbing", "cycling", "fitness", "outdoors", "yoga", "travel"], "a riverside walk with iced coffee"],
  [["books", "reading", "art", "design", "photography", "film", "writing"], "a bookstore café"],
  [["startup", "ai", "engineering", "product", "software", "data", "founder"], "a rooftop café"],
];

export function pickVenue(a: Person, b: Person) {
  const tags = new Set((a.profile?.tags || []).map((t) => t.toLowerCase()));
  const shared = (b.profile?.tags || []).map((t) => t.toLowerCase()).filter((t) => tags.has(t)).join(" ");
  const all = [...tags, ...(b.profile?.tags || []).map((t) => t.toLowerCase())].join(" ");
  for (const [keys, venue] of VENUES) if (keys.some((k) => shared.includes(k))) return venue;
  for (const [keys, venue] of VENUES) if (keys.some((k) => all.includes(k))) return venue;
  return "a quiet neighbourhood coffee shop";
}

function agentSystem(me: Person, other: Person, venue: string) {
  return `You are the DATING AGENT representing ${me.name}. You speak AS ${me.name}, in first person, on a first date at ${venue} with ${other.name}. Your job is to find out, honestly, whether this person is a good match for the human you represent.

WHO YOU REPRESENT (private brief, built from their LinkedIn + Instagram):
${JSON.stringify(me.profile)}

HOW TO BEHAVE
- Talk like a real person on a first date: 1-3 sentences per turn, natural, warm but not sycophantic. No stage directions, no emojis spam.
- Stay true to the brief: share real interests and opinions from it, ask about the things that matter to ${me.name} (their needs, values, conversation hooks).
- Do NOT invent biography beyond the brief. If asked something you don't know, answer vaguely or deflect with humour.
- You know ${other.name} ONLY from what they say in this conversation. React honestly: enthusiasm where there's overlap, polite friction or disagreement where values or lifestyles differ. Real chemistry only; don't pretend.
- Never reveal that you are an AI agent or mention "brief", "profile" or "scraped data".
- Never speculate about the other person's health, religion, politics, orientation, or ethnicity.`;
}

export async function runDate(a: Person, b: Person, turnCount = 8): Promise<DateRecord> {
  const venue = pickVenue(a, b);
  const sysA = agentSystem(a, b, venue);
  const sysB = agentSystem(b, a, venue);
  const turns: Turn[] = [];
  const model = MODELS.date();

  for (let i = 0; i < turnCount; i++) {
    const speaker: "a" | "b" = i % 2 === 0 ? "a" : "b";
    const mine = speaker;
    // Own lines become "assistant", partner's lines "user". Agent A opens, so it gets a kickoff user message.
    const messages: { role: "user" | "assistant"; content: string }[] = [];
    if (speaker === "a") messages.push({ role: "user", content: "(You've just sat down at the table. Open the conversation naturally.)" });
    for (const t of turns) messages.push({ role: t.speaker === mine ? "assistant" : "user", content: t.text });
    const closing = i === turnCount - 1 ? "\n\n(This is the last exchange of the date: wrap up honestly, including whether you'd want a second date.)" : "";
    const text = await chat({
      model,
      system: (speaker === "a" ? sysA : sysB) + closing,
      messages,
      maxTokens: 220,
    });
    turns.push({ speaker, text: text.replace(/^["']|["']$/g, "") });
  }

  const transcript = turns.map((t) => `${t.speaker === "a" ? a.name : b.name}: ${t.text}`).join("\n");
  const judge = await jsonCall({
    model: MODELS.judge(),
    schema: JudgeSchema,
    maxTokens: 1500,
    system: `You are an impartial MATCHMAKER JUDGE. Two dating agents just had a first date on behalf of two real people. You see both private briefs and the transcript. Score how well the two people fit.

SCORING (0-100, integers). Be discriminating: a typical date is 45-65; 80+ is rare and needs concrete evidence of shared values AND chemistry; below 35 means clear incompatibility. Do not reward politeness or generic agreement. Base scores on the briefs' needs, values, deal-breakers and the actual conversation.
- chemistry: flow, curiosity, humour, mutual engagement in the transcript
- valuesFit: alignment of values and life direction
- interestOverlap: shared hobbies/interests, plus complementary ones
- lifestyleFit: rhythm, ambitions, location/role compatibility
- scoreForA: how good is B FOR A specifically (A's needs and deal-breakers)
- scoreForB: how good is A FOR B specifically (the two can differ)
- verdict: one sentence. reasonA / reasonB: 1-2 sentences addressed about that person's fit, citing specifics. bestMoment: the best exchange, paraphrased. friction: the main point of mismatch (or "none visible").
Never mention sensitive traits (health, religion, politics, orientation, ethnicity).

JSON: {"chemistry":0,"valuesFit":0,"interestOverlap":0,"lifestyleFit":0,"scoreForA":0,"scoreForB":0,"verdict":"","reasonA":"","reasonB":"","bestMoment":"","friction":""}`,
    user: `PERSON A: ${a.name}\nBRIEF A: ${JSON.stringify(a.profile)}\n\nPERSON B: ${b.name}\nBRIEF B: ${JSON.stringify(b.profile)}\n\nVENUE: ${venue}\n\nTRANSCRIPT:\n${transcript}`,
  });

  const [aId, bId] = [a.id, b.id];
  return { id: `${aId}_${bId}`, aId, bId, venue, turns, judge, createdAt: Date.now() };
}
