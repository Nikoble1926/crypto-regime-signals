// facilitator.ts - Minimal x402 facilitator for Pharos Atlantic (eip155:688689).
// Verifies and settles payments on Pharos. Based on the official Pharos x402 docs.
// For a live settled payment it needs PHRS gas on the signer; for serving 402
// challenges (verify/settle unused) any valid testnet key works.

import dotenv from "dotenv";
import express from "express";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, publicActions, defineChain } from "viem";
import { x402Facilitator } from "@x402/core/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";

dotenv.config();

if (!process.env.EVM_PRIVATE_KEY) {
  console.error("❌ Set EVM_PRIVATE_KEY (testnet only)");
  process.exit(1);
}

const pharos = defineChain({
  id: 688_689,
  name: "Pharos",
  nativeCurrency: { name: "PHRS", symbol: "PHRS", decimals: 18 },
  rpcUrls: { default: { http: ["https://atlantic.dplabs-internal.com/"] } },
  testnet: true,
});

const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const client = createWalletClient({
  account,
  chain: pharos,
  transport: http(undefined, { timeout: 30_000 }),
}).extend(publicActions);

const signer = toFacilitatorEvmSigner({
  address: account.address,
  getCode: (args) => client.getCode(args),
  readContract: (args) => client.readContract({ ...args, args: args.args || [] }),
  verifyTypedData: (args) => client.verifyTypedData(args as any),
  writeContract: (args) => client.writeContract({ ...args, args: args.args || [] }),
  sendTransaction: (args) => client.sendTransaction(args),
  waitForTransactionReceipt: (args) => client.waitForTransactionReceipt(args),
});

const facilitator = new x402Facilitator();
facilitator.register("eip155:688689", new ExactEvmScheme(signer, { deployERC4337WithEIP6492: true }));

const app = express();
app.use(express.json());

app.post("/verify", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    res.json(await facilitator.verify(paymentPayload, paymentRequirements));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post("/settle", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    res.json(await facilitator.settle(paymentPayload, paymentRequirements));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/supported", (_req, res) => res.json(facilitator.getSupported()));

const PORT = process.env.FAC_PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Facilitator on :${PORT}  signer=${account.address}  chain=eip155:688689`);
});
