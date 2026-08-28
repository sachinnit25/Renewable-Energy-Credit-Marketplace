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
    if (tx.status === "FAILED") throw new Error(`Transaction ${hash} failed.`);
    await sleep(1500);
  }
  throw new Error("Transaction confirmation timed out.");
}

async function main() {
  const info = JSON.parse(fs.readFileSync("contract-info.json", "utf8"));
  const contractId = info.contractId;
  console.log("Seeding REC Lots on Contract:", contractId);

  const keypair = StellarSdk.Keypair.random();
  console.log("Seeder Wallet:", keypair.publicKey());

  console.log("Funding seeder via Friendbot...");
  const friendbotRes = await fetch(`https://friendbot.stellar.org/?addr=${keypair.publicKey()}`);
  if (!friendbotRes.ok) throw new Error("Friendbot funding failed.");
  await sleep(2500);

  const contract = new StellarSdk.Contract(contractId);

  const lotsToSeed = [
    { id: 101, mwh: 50, price: 10_000_000, source: "solar" },
    { id: 102, mwh: 80, price: 14_000_000, source: "wind" },
    { id: 103, mwh: 35, price: 8_000_000, source: "hydro" },
    { id: 104, mwh: 60, price: 12_000_000, source: "biomass" },
  ];

  for (const lot of lotsToSeed) {
    try {
      console.log(`Minting REC #${lot.id} (${lot.source.toUpperCase()}, ${lot.mwh} MWh)...`);
      const account = await rpcServer.getAccount(keypair.publicKey());
      let tx = new StellarSdk.TransactionBuilder(account, {
        fee: "1000000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            "create_rec",
            new StellarSdk.Address(keypair.publicKey()).toScVal(),
            StellarSdk.nativeToScVal(BigInt(lot.id), { type: "u64" }),
            StellarSdk.nativeToScVal(lot.mwh, { type: "u32" }),
            StellarSdk.nativeToScVal(lot.price, { type: "i64" }),
            StellarSdk.nativeToScVal(lot.source, { type: "symbol" })
          )
        )
        .setTimeout(300)
        .build();

      tx = await rpcServer.prepareTransaction(tx);
      tx.sign(keypair);
      const send = await rpcServer.sendTransaction(tx);
      console.log(`REC #${lot.id} Tx Sent Hash: ${send.hash}`);
      await waitForTx(send.hash);
      console.log(`✅ REC #${lot.id} successfully minted on-chain!`);
    } catch (err) {
      console.log(`Notice for REC #${lot.id}: ${err.message || err}`);
    }
  }

  console.log("🎉 All Marketplace REC Lots seeded on-chain!");
}

main().catch((err) => {
  console.error("Seeding error:", err.message || err);
  process.exit(1);
});
