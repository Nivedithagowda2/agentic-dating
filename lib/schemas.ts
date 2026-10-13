import { z } from "zod";

const num = z.coerce
  .number()
  .transform((n) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0))));

export const ItemSchema = z.object({
  label: z.string(),
  evidence: z.string().default(""),
  source: z.enum(["linkedin", "instagram", "both", "inferred"]).catch("inferred"),
});

export const ProfileSchema = z.object({
  vibe: z.string().default(""),
  headline: z.string(),
  summary: z.string(),
  role: z.string().default(""),
  location: z.string().default(""),
  needs: z.array(ItemSchema).default([]),
  hobbies: z.array(ItemSchema).default([]),
  interests: z.array(ItemSchema).default([]),
  values: z.array(ItemSchema).default([]),
  personality: z.array(ItemSchema).default([]),
  communicationStyle: z.string().default(""),
  lookingFor: z.string().default(""),
  dealBreakers: z.array(z.string()).default([]),
  conversationHooks: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  confidence: z.enum(["low", "medium", "high"]).catch("low"),
  confidenceNote: z.string().default(""),
});

export const JudgeSchema = z.object({
  chemistry: num,
  valuesFit: num,
  interestOverlap: num,
  lifestyleFit: num,
  scoreForA: num,
  scoreForB: num,
  verdict: z.string().default(""),
  reasonA: z.string().default(""),
  reasonB: z.string().default(""),
  bestMoment: z.string().default(""),
  friction: z.string().default(""),
});

export const ShortlistSchema = z.object({
  picks: z.array(z.object({ id: z.string(), why: z.string().default("") })),
});
