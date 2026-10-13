import type { z } from "zod";
import type { ProfileSchema, JudgeSchema } from "./schemas";

export type Profile = z.infer<typeof ProfileSchema>;
export type Judge = z.infer<typeof JudgeSchema>;

export type Person = {
  id: string;
  name: string;
  linkedinUrl: string;
  instagramUrl: string;
  instagramUser: string;
  status: "queued" | "scraping" | "profiling" | "ready" | "error";
  error?: string;
  sources: {
    linkedin?: string; // condensed JSON the agent actually read
    instagram?: string;
    linkedinError?: string;
    instagramError?: string;
    manualLinkedin?: string;
    manualInstagram?: string;
  };
  profile?: Profile;
  createdAt: number;
};

export type Turn = { speaker: "a" | "b"; text: string };

export type DateRecord = {
  id: string; // `${aId}_${bId}` (sorted)
  aId: string;
  bId: string;
  venue: string;
  turns: Turn[];
  judge: Judge;
  createdAt: number;
};

export type Job = {
  status: "idle" | "running" | "done" | "error";
  phase: string;
  total: number;
  done: number;
  log: string[];
  startedAt?: number;
  updatedAt?: number;
  error?: string;
};

export type DB = { people: Person[]; dates: DateRecord[]; job: Job };

export type PersonInput = {
  linkedinUrl: string;
  instagramUrl: string;
  linkedinText?: string;
  instagramText?: string;
};
