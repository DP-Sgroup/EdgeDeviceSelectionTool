// Optional: run the same tests from a terminal with Node 18+:  node tests/run-node.mjs
import { readFileSync } from "node:fs";
import { runAll } from "./scenarios.js";

const load = (n) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), "utf8"));
const data = Object.fromEntries(["connectors", "apps", "devices", "assumptions"].map((n) => [n, load(n)]));
const results = runAll(data);
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
