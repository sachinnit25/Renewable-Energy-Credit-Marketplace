import * as StellarSdk from "@stellar/stellar-sdk";
import fs from "fs";
import path from "path";

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const server = new StellarSdk.rpc.Server(RPC_URL);

async function deploy() {
  console.log("=== Deploying Soroban REC Contract to Stellar Testnet ===");

  // 1. Generate keypair for deployer
  const keypair = StellarSdk.Keypair.random();
  const publicKey = keypair.publicKey();
  const secretKey = keypair.secret();
  console.log("Deployer Public Key:", publicKey);

  // 2. Fund via Friendbot
  console.log("Funding deployer account via Friendbot...");
  const friendbotRes = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
  if (!friendbotRes.ok) {
    throw new Error(`Friendbot funding failed: ${await friendbotRes.text()}`);
  }
  console.log("Account funded successfully.");

  // 3. Load account
  let account = await server.getAccount(publicKey);

  // 4. Read WASM file
  const wasmPath = path.resolve(
    "contracts/soroban_rec/target/wasm32-unknown-unknown/release/soroban_rec_contract.wasm"
  );
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM file not found at ${wasmPath}. Run 'cargo build --target wasm32-unknown-unknown --release' first.`);
  }

  const wasmBytes = fs.readFileSync(wasmPath);
  console.log(`WASM loaded (${wasmBytes.length} bytes). Uploading code...`);

  // 5. Upload WASM code
  const uploadOp = StellarSdk.Operation.uploadContractWasm({ wasm: wasmBytes });
  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(uploadOp)
    .setTimeout(300)
    .build();

  let preparedTx = await server.prepareTransaction(tx);
  preparedTx.sign(keypair);

  let sendResult = await server.sendTransaction(preparedTx);
  if (sendResult.status === "ERROR") {
    throw new Error(`Tx submission error: ${JSON.stringify(sendResult)}`);
  }

  console.log("Upload tx submitted. Hash:", sendResult.hash);
  console.log("Waiting for confirmation...");
  
  let statusResult;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    statusResult = await server.getTransaction(sendResult.hash);
    if (statusResult.status !== "NOT_FOUND") break;
  }

  if (statusResult.status !== "SUCCESS") {
    throw new Error(`Upload transaction failed: ${JSON.stringify(statusResult)}`);
  }

  const wasmHash = statusResult.returnValue.toXDR("hex");
  console.log("WASM Hash:", wasmHash);

  // 6. Create Contract Instance
  account = await server.getAccount(publicKey);
  const createOp = StellarSdk.Operation.createContract({
    address: publicKey,
    wasmHash: Buffer.from(wasmHash, "hex"),
  });

  tx = new StellarSdk.TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(createOp)
    .setTimeout(300)
    .build();

  preparedTx = await server.prepareTransaction(tx);
  preparedTx.sign(keypair);

  sendResult = await server.sendTransaction(preparedTx);
  console.log("Create contract tx submitted. Hash:", sendResult.hash);

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    statusResult = await server.getTransaction(sendResult.hash);
    if (statusResult.status !== "NOT_FOUND") break;
  }

  if (statusResult.status !== "SUCCESS") {
    throw new Error(`Create contract failed: ${JSON.stringify(statusResult)}`);
  }

  const contractId = statusResult.createdContractId;
  console.log("\n✅ SOROBAN CONTRACT DEPLOYED SUCCESSFULLY!");
  console.log("Contract ID:", contractId);

  const contractInfo = {
    network: "testnet",
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    contractId: contractId,
    wasmHash: wasmHash,
    deployer: publicKey,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync("contract-info.json", JSON.stringify(contractInfo, null, 2));
  console.log("Saved contract metadata to contract-info.json");
}

deploy().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
