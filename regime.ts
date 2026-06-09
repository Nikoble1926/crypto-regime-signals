// regime.ts - Crypto market-regime classifier from live Kraken public OHLC.
// No API key required. Same methodology as the live engine at signals.nsgoods.org.

export type Trend = "up" | "down" | "flat";
export type Volatility = "low" | "normal" | "high";
export type Regime = "trending_up" | "trending_down" | "ranging" | "high_volatility";

export interface RegimeSignal {
  pair: string;
  asof: string;
  regime: Regime;
  trend: Trend;
  volatility: Volatility;
  quick_score: number;
  ema_fast: number;
  ema_slow: number;
  atr_pct: number;
  last_price: number;
  source: "kraken-public-ohlc";
  methodology: string;
  not_financial_advice: true;
}

function ema(values: number[], period: number): number {
  if (values.length === 0) return NaN;
  const k = 2 / (period + 1);
  let e = values[0];
  for (let i = 1; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

// Average True Range over the last `period` candles.
function atr(highs: number[], lows: number[], closes: number[], period = 14): number {
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  const slice = trs.slice(-period);
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Fetch live OHLC from Kraken and classify the current market regime for a pair.
 * @param pair Kraken pair, e.g. "XBTUSD", "ETHUSD", "SOLUSD".
 * @param interval Candle interval in minutes (default 60).
 */
export async function computeRegime(pair = "XBTUSD", interval = 60): Promise<RegimeSignal> {
  const url = `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(pair)}&interval=${interval}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kraken OHLC HTTP ${res.status}`);
  const json: any = await res.json();
  if (json.error && json.error.length) throw new Error(`Kraken error: ${json.error.join(", ")}`);

  const resultKey = Object.keys(json.result).find((k) => k !== "last");
  if (!resultKey) throw new Error("No OHLC data returned");
  const rows: any[] = json.result[resultKey];
  if (!rows || rows.length < 30) throw new Error("Insufficient OHLC history");

  const highs = rows.map((r) => parseFloat(r[2]));
  const lows = rows.map((r) => parseFloat(r[3]));
  const closes = rows.map((r) => parseFloat(r[4]));

  const lastPrice = closes[closes.length - 1];
  const emaFast = ema(closes, 12);
  const emaSlow = ema(closes, 26);
  const atrVal = atr(highs, lows, closes, 14);
  const atrPct = (atrVal / lastPrice) * 100;

  // Trend: EMA spread as a percentage of price.
  const spreadPct = ((emaFast - emaSlow) / lastPrice) * 100;
  let trend: Trend;
  if (spreadPct > 0.15) trend = "up";
  else if (spreadPct < -0.15) trend = "down";
  else trend = "flat";

  // Volatility bands on ATR%.
  let volatility: Volatility;
  if (atrPct < 0.8) volatility = "low";
  else if (atrPct <= 3.0) volatility = "normal";
  else volatility = "high";

  // Regime label.
  let regime: Regime;
  if (atrPct > 4.0) regime = "high_volatility";
  else if (trend === "up") regime = "trending_up";
  else if (trend === "down") regime = "trending_down";
  else regime = "ranging";

  // quick_score (0-100): trend strength rewarded, excess volatility penalised.
  const trendStrength = clamp(Math.abs(spreadPct) * 18, 0, 70); // up to 70 pts
  const volNormality = clamp(30 - Math.abs(atrPct - 1.5) * 8, 0, 30); // best near ~1.5% ATR
  const quickScore = Math.round(clamp(trendStrength + volNormality, 0, 100));

  return {
    pair,
    asof: new Date().toISOString(),
    regime,
    trend,
    volatility,
    quick_score: quickScore,
    ema_fast: Number(emaFast.toFixed(4)),
    ema_slow: Number(emaSlow.toFixed(4)),
    atr_pct: Number(atrPct.toFixed(2)),
    last_price: Number(lastPrice.toFixed(4)),
    source: "kraken-public-ohlc",
    methodology: "EMA(12/26) trend + ATR% volatility band + composite quick-score",
    not_financial_advice: true,
  };
}
