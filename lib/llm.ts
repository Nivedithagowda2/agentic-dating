import type { ZodType } from "zod";

const BASE = "https://api.groq.com/openai/v1";
// Preferred order; the first one your key actually has is used.
const SMART = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b", "llama-3.1-8b-instant"];
const FAST = ["llama-3.1-8b-instant", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "openai/gpt-oss-120b"];

export const MODELS = {
  profile: () => process.env.PROFILE_MODEL || "auto:smart",
  judge: () => process.env.JUDGE_MODEL || "auto:smart", 
  date: () => process.env.DATE_MODEL || "auto:fast",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let available: string[] | null = null;

async function listModels(key: string) {
  if (available) return available;
  const res = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Groq model list failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  available = ((data.data || []) as { id: string }[])
    .map((m) => m.id)
    .filter((id) => !/whisper|tts|guard|embed|orpheus|safeguard/i.test(id));
  return available;
}

async function resolveModel(wanted: string, key: string) {
  const ids = await listModels(key);
  if (ids.includes(wanted)) return wanted;
  const prefs = wanted === "auto:fast" ? FAST : SMART;
  const hit = prefs.find((p) => ids.includes(p));
  if (hit) return hit;
  const any = ids.find((id) => !/compound/.test(id));
  if (any) return any;
  throw new Error("No chat models available on this Groq key");
}

export async function chat(opts: {
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  json?: boolean;
}): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  const model = await resolveModel(opts.model, key);
  const oss = model.startsWith("openai/gpt-oss");

  const body: Record<string, unknown> = {
    model,
    // gpt-oss spends part of the budget on hidden reasoning, so give it extra room
    max_tokens: (opts.maxTokens ?? 1024) + (oss ? 1500 : 0),
    messages: [{ role: "system", content: opts.system }, ...opts.messages],
  };
  if (oss) body.reasoning_effort = "low";
  if (opts.json) body.response_format = { type: "json_object" };

  let lastErr = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      return (data.choices?.[0]?.message?.content ?? "").trim();
    }
    lastErr = `Groq ${res.status} (${model}): ${(await res.text()).slice(0, 300)}`;
    if (res.status === 429 || res.status >= 500) {
      const ra = Number(res.headers.get("retry-after"));
      await sleep((Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1500 * 2 ** attempt) + Math.random() * 400);
      continue;
    }
    break;
  }
  throw new Error(lastErr);
}

export async function jsonCall<T>(opts: {
  model: string;
  system: string;
  user: string;
  schema: ZodType<T>;
  maxTokens?: number;
}): Promise<T> {
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await chat({
      model: opts.model,
      system:
        opts.system +
        "\n\nRespond with ONE valid JSON object only. No markdown fences, no commentary before or after.",
      messages: [
        {
          role: "user",
          content: opts.user + (lastErr ? `\n\n(Previous attempt failed: ${lastErr}. Return valid JSON matching the schema.)` : ""),
        },
      ],
      maxTokens: opts.maxTokens ?? 3500,
      json: true,
    });
    try {
      const s = text.indexOf("{");
      const e = text.lastIndexOf("}");
      return opts.schema.parse(JSON.parse(text.slice(s, e + 1)));
    } catch (err) {
      lastErr = (err as Error).message.slice(0, 200);
    }
  }
  throw new Error("Model returned invalid JSON: " + lastErr);
}
