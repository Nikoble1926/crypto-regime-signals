// read_oracle.mjs - read the latest on-chain regime attestation from RegimeOracle on Pharos Atlantic.
// Public read, NO private key needed. Usage: node read_oracle.mjs [PAIR]   (default XBTUSD)
import fs from "fs";
import { createPublicClient, http, defineChain } from "viem";

const pharos = defineChain({
  id: 688689,
  name: "Pharos Atlantic",
  nativeCurrency: { name: "PHRS", symbol: "PHRS", decimals: 18 },
  rpcUrls: { default: { http: ["https://atlantic.dplabs-internal.com/"] } },
  testnet: true,
});

const ADDRESS = "0xd7ada595fbed3c2fc547c8ec57a5e581cfb3ad3e";
const abi = JSON.parse(fs.readFileSync("oracle.abi.json", "utf8"));
const pair = process.argv[2] || "XBTUSD";
const client = createPublicClient({ chain: pharos, transport: http() });

const [publisher, total, att] = await Promise.all([
  client.readContract({ address: ADDRESS, abi, functionName: "publisher" }),
  client.readContract({ address: ADDRESS, abi, functionName: "total" }),
  client.readContract({ address: ADDRESS, abi, functionName: "latest", args: [pair] }),
]);

const [regime, quickScore, timestamp, dataHash] = att;
console.log(JSON.stringify({
  contract: ADDRESS,
  publisher,
  total_attestations: Number(total),
  pair,
  regime,
  quick_score: Number(quickScore),
  asof_utc: timestamp ? new Date(Number(timestamp) * 1000).toISOString() : null,
  data_hash: dataHash,
}, null, 2));