---
name: crypto-regime-signals
description: Pay-per-call crypto market-regime and market-state signals for AI agents over x402 on Pharos. Use when an agent needs decision-grade market context (trend, volatility, regime label, quick-score) before trading, rebalancing, or risk-gating. Triggers on "market regime", "market state", "should I trade now", "crypto signal pharos", "regime signal", "volatility regime", "x402 market data".
license: MIT
metadata:
  author: Nikolaos Dimitriadis (nickbuildsai)
  version: "1.0.0"
  network: pharos-atlantic-testnet
  chainId: 688689
---

# Crypto Regime Signals (x402 · Pharos)

A reusable Skill that lets an AI agent **buy decision-grade market context per call** — a
classified market **regime** (trend + volatility + a 0-100 quick-score) for any major crypto
pair — and pay for it automatically with USDC over the **x402** protocol on **Pharos**.

It is built to be **composed** into higher-level agents: a trading agent, a rebalancer, or a
risk gate calls this Skill first to decide *whether the current market is worth acting in*,
then acts. The signal is computed from **live Kraken market data** using the same regime
methodology as the author's production engine (live x402 service: `signals.nsgoods.org`,
with a public, tamper-evident track record).

## Pharos Network

- **Chain ID**: 688689
- **Network identifier**: `eip155:688689`
- **RPC URL**: https://atlantic.dplabs-internal.com
- **Native gas token**: PHRS (from the Pharos testnet faucet)
- **USDC (test) address**: set via `USDC_ADDRESS` (Pharos Atlantic test USDC)
- **Facilitator URL**: set via `FACILITATOR_URL`

> Testnet only. No mainnet funds are used. Gas (PHRS) and test USDC come from the faucet.

## When to Use

- An agent must decide **if the market regime favours action** before placing a trade.
- A portfolio/rebalancing agent needs a **volatility + trend read** across top pairs.
- A risk-gate wants a **single quick-score (0-100)** to throttle or pause activity.
- Any agent that should **pay-as-you-go** for market context instead of holding an API key.

## What the Skill Returns

A paid `GET /regime?pair=XBTUSD` call returns JSON like:

```json
{
  "pair": "XBTUSD",
  "asof": "2026-06-09T08:00:00Z",
  "regime": "trending_up",
  "trend": "up",
  "volatility": "normal",
  "quick_score": 72,
  "ema_fast": 64210.4,
  "ema_slow": 61875.1,
  "atr_pct": 1.83,
  "source": "kraken-public-ohlc",
  "methodology": "EMA-cross trend + ATR-percent volatility band + composite quick-score",
  "not_financial_advice": true
}
```

`regime` is one of: `trending_up`, `trending_down`, `ranging`, `high_volatility`.
A free `GET /regime/methodology` and `GET /health` are unpaid.

## How an Agent Consumes It (x402 flow)

1. Agent calls `GET /regime?pair=XBTUSD` -> server replies **HTTP 402** with a
   `PAYMENT-REQUIRED` header (scheme `exact`, network `eip155:688689`, price, payTo).
2. The agent's x402 client signs a `PaymentPayload` and re-requests with `PAYMENT-SIGNATURE`.
3. Server verifies via the Facilitator, settles USDC on Pharos, returns **200 OK** with the
   signal and a `PAYMENT-RESPONSE` header (tx hash = proof of payment).

This is the standard x402 handshake; the agent never needs an account, key, or subscription.

## Quick Start - Server (the Skill provider)

```bash
mkdir regime-server && cd regime-server
npm init -y
npm install @x402/core @x402/express @x402/evm express viem dotenv tsx typescript @types/node @types/express
```

Create `.env`:
```bash
PAY_TO_ADDRESS=0xYourReceivingAddress
PORT=4021
FACILITATOR_URL=https://your-facilitator-url
USDC_ADDRESS=0xPharosTestUSDCAddress
USDC_NAME=USDC
```

Run:
```bash
npx tsx server.ts
```

The full `server.ts` is in this repo. It registers the Pharos Atlantic scheme
(`eip155:688689`), prices `GET /regime` at $0.01, computes the regime from live Kraken OHLC,
and returns the signed signal. `GET /health` and `GET /regime/methodology` are free.

## Quick Start - Client (an agent paying for the signal)

```bash
mkdir regime-client && cd regime-client
npm init -y
npm install @x402/core @x402/fetch @x402/evm viem dotenv tsx typescript @types/node
```

Create `.env`:
```bash
EVM_PRIVATE_KEY=0xYourTestnetPrivateKey   # testnet only; never a mainnet key
SERVER_URL=http://localhost:4021
```

Run:
```bash
npx tsx client.ts http://localhost:4021/regime?pair=XBTUSD
```

The client wraps `fetch` with the x402 SDK, auto-pays the 402, prints the signal and the
on-chain tx hash.

## Regime Methodology (brief)

- **Trend**: EMA(12) vs EMA(26) on recent OHLC closes -> `up` / `down` / flat.
- **Volatility**: ATR as a percentage of price, banded into `low` / `normal` / `high`.
- **quick_score (0-100)**: composite of trend strength and volatility normality - higher =
  cleaner, more actionable regime; lower = choppy/avoid.
- **regime label**: derived from the trend + volatility combination
  (`high_volatility` overrides when ATR-percent is extreme).

Data source: Kraken public OHLC (`https://api.kraken.com/0/public/OHLC`), no key required.
Same approach as the author's live, track-recorded engine - see Reusability below.

## Reusability & Composability

- **Stateless, single-purpose**: one call -> one regime read. Easy to cache, easy to compose.
- **Phase-2 ready**: drop this Skill into a Pharos Agent that gates its trades on `quick_score`
  and `regime` (e.g., only act when `regime != ranging` and `quick_score >= 60`).
- **Provider-agnostic client**: any x402-capable agent on Pharos can consume it unchanged.
- **Proven methodology**: the same regime engine runs live on Base with a public,
  tamper-evident track record (`signals.nsgoods.org`).

## Security

- Never hardcode or log private keys. Use `.env` / `.private_key` (both in `.gitignore`).
- Testnet keys only for development. Treat any key the agent holds as disposable.
- The server reads `PAY_TO_ADDRESS` from env; it never holds a private key (settlement is
  delegated to the Facilitator).

## Files in This Skill

- `SKILL.md` - this file (the skill definition).
- `server.ts` - Pharos x402 server that computes and sells the regime signal.
- `client.ts` - example agent that pays for and consumes a signal.
- `regime.ts` - the regime classifier (Kraken OHLC -> trend/volatility/quick-score).
- `.env.example`, `package.json`, `README.md`.

_Educational / data service. Not financial advice._
