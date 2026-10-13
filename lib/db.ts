import fs from "node:fs";
import path from "node:path";
import type { DB } from "./types";

const FILE = process.env.DATA_FILE || path.join(process.cwd(), "data", "db.json");

const empty = (): DB => ({
  people: [],
  dates: [],
  job: { status: "idle", phase: "", total: 0, done: 0, log: [] },
});

// Always read from disk: Next dev bundles each route separately, so module-level caches are not shared.
export function readDB(): DB {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
  } catch {
    return empty();
  }
}

function write(db: DB) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}

// Synchronous read-modify-write: no awaits inside, so no races in a single Node process.
export function mutate<T>(fn: (db: DB) => T): T {
  const db = readDB();
  const result = fn(db);
  write(db);
  return result;
}

export function uid(prefix = "p") {
  return prefix + Math.random().toString(16).slice(2, 8);
}

export async function pool<T>(items: T[], n: number, fn: (t: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx], idx);
      }
    })
  );
}
