// deploy_oracle.mjs - deploy RegimeOracle to Pharos Atlantic and attest a live signal.
import fs from "fs";
import { createWalletClient, http, publicActions, defineChain, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { computeRegime } from "./regime.js";

const pharos = defineChain({
  id: 688689,
  name: "Pharos Atlantic",
  nativeCurrency: { name: "PHRS", symbol: "PHRS", decimals: 18 },
  rpcUrls: { default: { http: ["https://atlantic.dplabs-internal.com/"] } },
  testnet: true,
});

const pk = fs.readFileSync(".private_key", "utf8").trim();
const account = privateKeyToAccount(pk);
const client = createWalletClient({ account, chain: pharos, transport: http(undefined, { timeout: 60000 }) }).extend(publicActions);

const abi = JSON.parse(fs.readFileSync("oracle.abi.json", "utf8"));
const bytecode = fs.readFileSync("oracle.bytecode.txt", "utf8").trim();

const bal = await client.getBalance({ address: account.address });
console.log("deployer:", account.address);
console.log("PHRS balance:", (Number(bal) / 1e18).toFixed(6));
if (bal === 0n) { console.error("No PHRS gas. Fund this address first."); process.exit(1); }

console.log("Deploying RegimeOracle...");
const deployHash = await client.deployContract({ abi, bytecode, args: [] });
console.log("deploy tx:", deployHash);
const rcpt = await client.waitForTransactionReceipt({ hash: deployHash });
const addr = rcpt.contractAddress;
console.log("RegimeOracle deployed at:", addr);

// Attest a live regime signal on-chain
const sig = await computeRegime("XBTUSD");
const dataHash = keccak256(toHex(JSON.stringify(sig)));
console.log("Attesting:", sig.pair, sig.regime, "score=" + sig.quick_score);
const attestHash = await client.writeContract({
  address: addr, abi, functionName: "attest",
  args: [sig.pair, sig.regime, sig.quick_score, dataHash],
});
console.log("attest tx:", attestHash);
await client.waitForTransactionReceipt({ hash: attestHash });

const result = { contract: addr, deployTx: deployHash, attestTx: attestHash, pair: sig.pair, regime: sig.regime, quick_score: sig.quick_score, dataHash };
fs.writeFileSync("onchain_result.json", JSON.stringify(result, null, 2));
console.log("RESULT", JSON.stringify(result));
