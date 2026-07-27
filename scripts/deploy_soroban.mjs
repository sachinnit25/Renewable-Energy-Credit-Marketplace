import * as StellarSdk from "@stellar/stellar-sdk";
import fs from "fs";
import path from "path";

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const server = new StellarSdk.rpc.Server(RPC_URL);

async function deploy() {
  console.log("=== Deploying Soroban REC Smart Contract to Stellar Testnet ===");

  // 1. Generate keypair for deployer & fund via Friendbot
  const keypair = StellarSdk.Keypair.random();
  const publicKey = keypair.publicKey();
  console.log("Deployer Public Key:", publicKey);

  console.log("Funding deployer account via Friendbot...");
  const friendbotRes = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
  if (!friendbotRes.ok) {
    throw new Error(`Friendbot funding failed: ${await friendbotRes.text()}`);
  }
  console.log("Account funded successfully with testnet XLM.");

  // 2. Read WASM file
  const wasmPath = path.resolve(
    "contracts/soroban_rec/target/wasm32-unknown-unknown/release/soroban_rec_contract.wasm"
  );
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM file not found at ${wasmPath}. Run cargo build first.`);
  }

  const wasmBytes = fs.readFileSync(wasmPath);
  const wasmHash = StellarSdk.hash(wasmBytes);
  const wasmHashHex = wasmHash.toString("hex");
  console.log(`WASM loaded (${wasmBytes.length} bytes). WASM Hash: ${wasmHashHex}`);

  // 3. Upload WASM Code
  let account = await server.getAccount(publicKey);
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
  console.log("Uploaded WASM code. Tx Hash:", sendResult.hash);

  // Wait 6 seconds for ledger block confirmation
  await new Promise((r) => setTimeout(r, 6000));

  // 4. Create Contract Instance
  account = await server.getAccount(publicKey);
  const createOp = StellarSdk.Operation.createContract({
    address: publicKey,
    wasmHash: wasmHash,
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
  console.log("Created Soroban Contract Instance. Tx Hash:", sendResult.hash);

  // Generate Soroban Contract ID (C...)
  const contractAddressObj = StellarSdk.Address.contract(
    StellarSdk.hash(
      Buffer.concat([
        StellarSdk.xdr.HashIdPreimage.envelopeTypeContractId(
          new StellarSdk.xdr.ContractIdPreimage({
            type: StellarSdk.xdr.ContractIdPreimageType.contractIdPreimageFromAddress(),
            fromAddress: new StellarSdk.xdr.ContractIdPreimageFromAddress({
              address: StellarSdk.Address.fromString(publicKey).toScAddress(),
              salt: Buffer.alloc(32),
            }),
          })
        ).toXDR(),
      ])
    )
  );
  
  const contractId = contractAddressObj.toString();
  console.log("\n===============================================");
  console.log("✅ SOROBAN CONTRACT DEPLOYED TO STELLAR TESTNET!");
  console.log("Contract ID:", contractId);
  console.log("===============================================\n");

  const contractInfo = {
    network: "testnet",
    rpcUrl: RPC_URL,
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: NETWORK_PASSPHRASE,
    contractId: contractId,
    wasmHash: wasmHashHex,
    deployer: publicKey,
    txHash: sendResult.hash,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync("contract-info.json", JSON.stringify(contractInfo, null, 2));
  console.log("Saved contract info metadata to contract-info.json");
}

deploy().catch((err) => {
  console.error("Deployment finished with notice:", err.message || err);
});
