/**
 * Batch runner: npm run batch -- people.json [--k 6] [--turns 8]
 * Adds every person in the file, profiles them, then runs all the dates.
 */
import fs from "node:fs";
import { addPeople, runMatching } from "../lib/pipeline";
import { readDB } from "../lib/db";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const file = args.find((a) => a.endsWith(".json")) || "people.json";
const num = (flag: string, d: number) => {
  const i = args.indexOf(flag);
  return i >= 0 ? Number(args[i + 1]) : d;
};

async function main() {
  const list = JSON.parse(fs.readFileSync(file, "utf8"));
  const results = addPeople(list, true);
  results.filter((r) => r.error).forEach((r) => console.log("skip:", r.input.linkedinUrl, "-", r.error));
  console.log(`Processing ${results.filter((r) => !r.error).length} new people…`);
  // processMany runs in the background inside addPeople; wait until nobody is queued/working.
  for (;;) {
    await sleep(3000);
    const ps = readDB().people;
    const pending = ps.filter((p) => ["queued", "scraping", "profiling"].includes(p.status)).length;
    console.log(`  ready ${ps.filter((p) => p.status === "ready").length} · error ${ps.filter((p) => p.status === "error").length} · pending ${pending}`);
    if (!pending) break;
  }
  ps_errors();
  await runMatching({ k: num("--k", 6), turns: num("--turns", 8) });
  const db = readDB();
  console.log(`Job: ${db.job.status} · ${db.dates.length} dates stored`);
}

function ps_errors() {
  readDB().people.filter((p) => p.status === "error").forEach((p) => console.log("ERROR", p.name, p.error));
}

main();
