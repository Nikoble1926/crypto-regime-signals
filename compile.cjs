const fs = require("fs");
const path = require("path");
const solc = require("solc");

const src = fs.readFileSync(path.join("contracts", "RegimeOracle.sol"), "utf8");
const input = {
  language: "Solidity",
  sources: { "RegimeOracle.sol": { content: src } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
let hadError = false;
for (const e of out.errors || []) {
  if (e.severity === "error") { hadError = true; console.error(e.formattedMessage); }
}
if (hadError) process.exit(1);
const c = out.contracts["RegimeOracle.sol"]["RegimeOracle"];
fs.writeFileSync("oracle.abi.json", JSON.stringify(c.abi, null, 2));
fs.writeFileSync("oracle.bytecode.txt", "0x" + c.evm.bytecode.object);
console.log("compiled OK | bytecode bytes:", c.evm.bytecode.object.length / 2, "| abi entries:", c.abi.length);
