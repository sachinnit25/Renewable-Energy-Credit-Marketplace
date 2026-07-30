# Technical Tutorial: Building a Decentralized Energy Credit Marketplace on Stellar & Soroban

## Introduction
Renewable Energy Credits (RECs) represent proof that 1 MWh of clean electricity was generated. In this tutorial, we demonstrate how to build an end-to-end REC Marketplace on Stellar using **Soroban Rust Smart Contracts**, **Inter-Contract Token Rewards**, and a **React + Vite** frontend.

---

## 1. Smart Contract Architecture (Soroban Rust)

Our marketplace consists of two inter-communicating Soroban contracts:

```rust
pub contract RecMarketplaceContract {
    pub fn buy_rec(env: Env, buyer: Address, rec_id: u64) -> Result<(), Error> {
        buyer.require_auth();
        // 1. Verify REC exists & is active
        let mut rec: Rec = env.storage().instance().get(&DataKey::Rec(rec_id)).unwrap();
        rec.active = false;
        env.storage().instance().set(&DataKey::Rec(rec_id), &rec);

        // 2. Inter-Contract Communication: Mint 10 RECT reward tokens to buyer
        let reward_token_id: Address = env.storage().instance().get(&DataKey::RewardToken).unwrap();
        let client = RewardTokenContractClient::new(&env, &reward_token_id);
        client.mint(&buyer, &10_i128);

        // 3. Emit Contract Event
        env.events().publish((symbol_short!("rec"), symbol_short!("bought")), rec_id);
        Ok(())
    }
}
```

---

## 2. Advanced Feature: Fee Sponsorship (Gasless Transactions)
Using Stellar's **Fee Bump Transactions** (`TransactionBuilder.buildFeeBumpTransaction`), the marketplace server sponsors transaction gas fees for buyers, enabling a seamless UX:

```javascript
import * as StellarSdk from "@stellar/stellar-sdk";

export function createFeeSponsoredTx(innerTx, sponsorKeypair) {
  return StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
    sponsorKeypair.publicKey(),
    StellarSdk.BASE_FEE,
    innerTx,
    StellarSdk.Networks.PUBLIC
  );
}
```

---

## 3. Real-Time Telemetry via Soroban RPC
We stream on-chain events by polling `sorobanRpc.getEvents()`:

```javascript
const response = await sorobanRpc.getEvents({
  startLedger: lastLedger,
  filters: [{ type: "contract", contractIds: [MARKETPLACE_CONTRACT_ID] }],
  limit: 20,
});
```

---

## Conclusion & Ecosystem Impact
By leveraging Stellar's low transaction fees and Soroban's WebAssembly performance, clean energy producers can trade fractionalized micro-RECs globally.

- **Live App**: [https://rec-marketplace-three.vercel.app](https://rec-marketplace-three.vercel.app)
- **GitHub Repository**: [sachinnit25/Renewable-Energy-Credit-Marketplace](https://github.com/sachinnit25/Renewable-Energy-Credit-Marketplace)
