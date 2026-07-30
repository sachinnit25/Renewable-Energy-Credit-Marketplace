import * as StellarSdk from "@stellar/stellar-sdk";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const rpcServer = new StellarSdk.rpc.Server(RPC_URL);

const WASM_PATH = path.resolve(
  "contracts/soroban_rec/target/wasm32-unknown-unknown/release/soroban_rec_contract.wasm",
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForTx(hash, label) {
  let status = "PENDING";
  for (let i = 0; i < 40; i += 1) {
    const tx = await rpcServer.getTransaction(hash);
    status = tx.status;
    if (status === "SUCCESS") return tx;
    if (status === "FAILED") throw new Error(`${label} failed on-chain.`);
    await sleep(1500);
  }
  throw new Error(`${label} timed out (status: ${status}).`);
}

async function fundAccount(publicKey) {
  const res = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
  if (!res.ok) throw new Error(`Friendbot failed: ${await res.text()}`);
}

async function uploadWasm(keypair, wasmBytes) {
  const account = await rpcServer.getAccount(keypair.publicKey());
  const wasmHash = StellarSdk.hash(wasmBytes);

  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(StellarSdk.Operation.uploadContractWasm({ wasm: wasmBytes }))
    .setTimeout(300)
    .build();

  tx = await rpcServer.prepareTransaction(tx);
  tx.sign(keypair);
  const send = await rpcServer.sendTransaction(tx);
  console.log("WASM upload tx:", send.hash);
  await waitForTx(send.hash, "WASM upload");
  return wasmHash;
}

async function createContractInstance(keypair, wasmHash, saltLabel) {
  const salt = crypto.createHash("sha256").update(saltLabel).digest();
  const account = await rpcServer.getAccount(keypair.publicKey());

  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.createContract({
        address: keypair.publicKey(),
        wasmHash,
        salt,
      }),
    )
    .setTimeout(300)
    .build();

  tx = await rpcServer.prepareTransaction(tx);
  tx.sign(keypair);

  const send = await rpcServer.sendTransaction(tx);
  console.log(`Create contract (${saltLabel}) tx:`, send.hash);
  await waitForTx(send.hash, `Create contract ${saltLabel}`);

  const contractId = StellarSdk.StrKey.encodeContract(
    StellarSdk.hash(Buffer.concat([Buffer.from(keypair.publicKey()), salt])),
  );
  return { contractId, txHash: send.hash };
}

async function invokeInitialize(keypair, marketplaceId, rewardId) {
  const contract = new StellarSdk.Contract(marketplaceId);
  const account = await rpcServer.getAccount(keypair.publicKey());

  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "initialize",
        new StellarSdk.Address(keypair.publicKey()).toScVal(),
        new StellarSdk.Address(rewardId).toScVal(),
      ),
    )
    .setTimeout(300)
    .build();

  tx = await rpcServer.prepareTransaction(tx);
  tx.sign(keypair);
  const send = await rpcServer.sendTransaction(tx);
  console.log("Initialize marketplace tx:", send.hash);
  await waitForTx(send.hash, "initialize");
  return send.hash;
}

async function deploy() {
  console.log("=== Deploying Soroban REC Marketplace (dual-contract) ===\n");

  if (!fs.existsSync(WASM_PATH)) {
    throw new Error(`WASM not found at ${WASM_PATH}. Run: cd contracts/soroban_rec && cargo build --target wasm32-unknown-unknown --release`);
  }

  const wasmBytes = fs.readFileSync(WASM_PATH);
  const keypair = StellarSdk.Keypair.random();
  console.log("Deployer:", keypair.publicKey());

  await fundAccount(keypair.publicKey());
  const wasmHash = await uploadWasm(keypair, wasmBytes);
  const wasmHashHex = wasmHash.toString("hex");
  console.log("WASM hash:", wasmHashHex);

  const reward = await createContractInstance(keypair, wasmHash, "reward-token-v1");
  console.log("Reward Token Contract:", reward.contractId);

  const marketplace = await createContractInstance(keypair, wasmHash, "rec-marketplace-v1");
  console.log("Marketplace Contract:", marketplace.contractId);

  const initTxHash = await invokeInitialize(keypair, marketplace.contractId, reward.contractId);

  const contractInfo = {
    network: "testnet",
    rpcUrl: RPC_URL,
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: NETWORK_PASSPHRASE,
    contractId: marketplace.contractId,
    rewardTokenContractId: reward.contractId,
    wasmHash: wasmHashHex,
    deployer: keypair.publicKey(),
    uploadTxHash: reward.txHash,
    initializeTxHash: initTxHash,
    interactionTxHash: initTxHash,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync("contract-info.json", JSON.stringify(contractInfo, null, 2));
  console.log("\n✅ Deployment complete. contract-info.json updated.");
  console.log("Marketplace:", marketplace.contractId);
  console.log("Reward Token:", reward.contractId);
  console.log("Init tx:", initTxHash);
}

deploy().catch((err) => {
  console.error("Deployment failed:", err.message || err);
  process.exit(1);
});
