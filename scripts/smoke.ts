// scripts/smoke.ts - CI smoke test: prove the regime Skill still works on live Kraken data.
import { computeRegime } from "../regime.js";

const REGIMES = ["trending_up", "trending_down", "ranging", "high_volatility"];
const pairs = process.argv.slice(2);
const list = pairs.length ? pairs : ["XBTUSD"];

let failed = 0;
for (const pair of list) {
  try {
    const s = await computeRegime(pair);
    const ok =
      REGIMES.includes(s.regime) &&
      typeof s.quick_score === "number" && s.quick_score >= 0 && s.quick_score <= 100 &&
      typeof s.last_price === "number" && s.last_price > 0 &&
      ["up", "down", "flat"].includes(s.trend) &&
      ["low", "normal", "high"].includes(s.volatility);
    if (!ok) { console.error("FAIL " + pair + ": invalid signal", JSON.stringify(s)); failed++; }
    else { console.log("OK   " + pair + ": " + s.regime + " score=" + s.quick_score + " atr%=" + s.atr_pct); }
  } catch (e) {
    console.error("FAIL " + pair + ": " + (e as Error).message); failed++;
  }
}
if (failed) { console.error(failed + " pair(s) failed"); process.exit(1); }
console.log("All regime signals valid against live Kraken data.");
