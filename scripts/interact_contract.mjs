import * as StellarSdk from "@stellar/stellar-sdk";
import fs from "fs";

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const rpcServer = new StellarSdk.rpc.Server(RPC_URL);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForTx(hash) {
  for (let i = 0; i < 40; i += 1) {
    const tx = await rpcServer.getTransaction(hash);
    if (tx.status === "SUCCESS") return tx;
    if (tx.status === "FAILED") throw new Error("Transaction failed.");
    await sleep(1500);
  }
  throw new Error("Transaction confirmation timed out.");
}

async function main() {
  const info = JSON.parse(fs.readFileSync("contract-info.json", "utf8"));
  const contractId = info.contractId;
  const keypair = StellarSdk.Keypair.random();
  console.log("Interactor:", keypair.publicKey());

  await fetch(`https://friendbot.stellar.org/?addr=${keypair.publicKey()}`);
  await sleep(2000);

  const contract = new StellarSdk.Contract(contractId);
  const recId = BigInt(Date.now() % 1_000_000);
  const account = await rpcServer.getAccount(keypair.publicKey());

  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "create_rec",
        new StellarSdk.Address(keypair.publicKey()).toScVal(),
        StellarSdk.nativeToScVal(recId, { type: "u64" }),
        StellarSdk.nativeToScVal(25, { type: "u32" }),
        StellarSdk.nativeToScVal(10_000_000, { type: "i64" }),
        StellarSdk.nativeToScVal("solar", { type: "symbol" }),
      ),
    )
    .setTimeout(300)
    .build();

  tx = await rpcServer.prepareTransaction(tx);
  tx.sign(keypair);
  const send = await rpcServer.sendTransaction(tx);
  console.log("create_rec tx hash:", send.hash);
  await waitForTx(send.hash);

  info.interactionTxHash = send.hash;
  info.lastInteractionAt = new Date().toISOString();
  fs.writeFileSync("contract-info.json", JSON.stringify(info, null, 2));
  console.log("Updated contract-info.json with interactionTxHash.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
