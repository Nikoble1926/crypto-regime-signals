// client.ts - Example AI-agent consumer. Pays the 402 automatically and prints the signal.
// Usage: npx tsx client.ts "http://localhost:4021/regime?pair=XBTUSD"

import { config } from "dotenv";
config();

import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";

// === Get a TESTNET private key (env var preferred, fallback to .private_key file) ===
const privateKey =
  process.env.EVM_PRIVATE_KEY ||
  (fs.existsSync(".private_key") ? fs.readFileSync(".private_key", "utf-8").trim() : null);
if (!privateKey) {
  console.error("❌ Set EVM_PRIVATE_KEY (testnet only) or create a .private_key file");
  process.exit(1);
}

const signer = privateKeyToAccount(privateKey as `0x${string}`);
const client = new x402Client();
client.register("eip155:688689", new ExactEvmScheme(signer)); // Pharos Atlantic
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const url =
  process.argv[2] || `${process.env.SERVER_URL || "http://localhost:4021"}/regime?pair=XBTUSD`;
console.log(`📡 Requesting: ${url}`);
console.log(`💳 Agent wallet: ${signer.address}`);

try {
  const response = await fetchWithPayment(url);
  const data = await response.json();
  console.log("✅ Signal received:");
  console.log(JSON.stringify(data, null, 2));

  const payHeader = response.headers.get("PAYMENT-RESPONSE");
  if (payHeader) {
    const pr = decodePaymentResponseHeader(payHeader);
    console.log("💰 Paid on-chain  tx:", pr.transaction);
    console.log("🌐 Network:", pr.network, " 📤 Payer:", pr.payer);
  }

  // Example agent decision gate (Phase-2 composition):
  if (data.regime && typeof data.quick_score === "number") {
    const act = data.regime !== "ranging" && data.regime !== "high_volatility" && data.quick_score >= 60;
    console.log(`🤖 Agent gate -> ${act ? "ACT (regime favourable)" : "WAIT (regime unfavourable)"}`);
  }
} catch (error) {
  console.error("❌ Request failed:", (error as Error).message);
  process.exit(1);
}
