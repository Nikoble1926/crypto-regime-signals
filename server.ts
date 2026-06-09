// server.ts - Pharos x402 server that sells live crypto market-regime signals.
// Mirrors the official PharosNetwork x402-pharos pattern (@x402/express) and adds
// real market-state endpoints powered by ./regime.ts (live Kraken OHLC).

import { config } from "dotenv";
config();

import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { computeRegime } from "./regime.js";

// === Environment configuration ===
const payToAddress = process.env.PAY_TO_ADDRESS as `0x${string}`;
if (!payToAddress || !payToAddress.startsWith("0x") || payToAddress.length !== 42) {
  console.error("❌ Set a valid PAY_TO_ADDRESS (0x... 42 chars) in .env");
  process.exit(1);
}
const facilitatorUrl = process.env.FACILITATOR_URL;
const usdcAddress = process.env.USDC_ADDRESS;
const usdcName = process.env.USDC_NAME || "USDC";
const port = parseInt(process.env.PORT || "4021", 10);
if (!facilitatorUrl || !usdcAddress) {
  console.error("❌ Set FACILITATOR_URL and USDC_ADDRESS in .env");
  process.exit(1);
}

// === x402 resource server + Pharos Atlantic (eip155:688689) scheme ===
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitatorClient);

const evmScheme = new ExactEvmScheme();
evmScheme.registerMoneyParser(async (amount: number, network: string) => {
  if (network === "eip155:688689") {
    return {
      amount: Math.round(amount * 1e6).toString(), // USDC, 6 decimals
      asset: usdcAddress,
      extra: { token: usdcName, name: usdcName, version: "2" },
    };
  }
  return null;
});
resourceServer.register("eip155:688689", evmScheme);

const app = express();

// === Paid route: the market-regime signal ($0.01 per call) ===
app.use(
  paymentMiddleware(
    {
      "GET /regime": {
        accepts: {
          scheme: "exact",
          price: "0.01",
          network: "eip155:688689",
          payTo: payToAddress,
        },
        description: "Live crypto market-regime signal (trend, volatility, quick-score)",
        mimeType: "application/json",
      },
    },
    resourceServer
  )
);

// === Business logic for the paid endpoint ===
app.get("/regime", async (req, res) => {
  try {
    const pair = (req.query.pair as string) || "XBTUSD";
    const signal = await computeRegime(pair);
    res.json(signal);
  } catch (e) {
    res.status(502).json({ error: "regime computation failed", detail: (e as Error).message });
  }
});

// === Free routes (no payment) ===
app.get("/regime/methodology", (_req, res) => {
  res.json({
    trend: "EMA(12) vs EMA(26) spread as % of price (>0.15% up, <-0.15% down)",
    volatility: "ATR% bands: <0.8 low, 0.8-3 normal, >3 high",
    quick_score: "0-100 composite: trend strength rewarded, excess volatility penalised",
    regime: ["trending_up", "trending_down", "ranging", "high_volatility"],
    data_source: "Kraken public OHLC (no key)",
    not_financial_advice: true,
  });
});

app.get("/health", (_req, res) => res.json({ status: "ok", network: "pharos-atlantic-688689" }));

app.listen(port, () => {
  console.log(`✅ Regime x402 server on http://localhost:${port}`);
  console.log(`📡 Network: Pharos Atlantic Testnet (eip155:688689)`);
  console.log(`💰 payTo: ${payToAddress}  🪙 ${usdcName}: ${usdcAddress}`);
  console.log(`   Paid:  GET /regime?pair=XBTUSD  ($0.01)`);
  console.log(`   Free:  GET /regime/methodology , GET /health`);
});
