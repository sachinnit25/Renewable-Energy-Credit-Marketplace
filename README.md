# Renewable Energy Credit Marketplace (Stellar & Soroban)

An end-to-end decentralized Renewable Energy Credit (REC) marketplace built on **Stellar Testnet** and **Soroban Smart Contracts**.

---

## 🚀 Live Demo & Explorer Verifications

- 🌐 **Live Demo URL**: [https://frontend-eta-seven-24.vercel.app](https://frontend-eta-seven-24.vercel.app)
- 📜 **Deployed Soroban Contract Address**: [`CDQSQVHPSTEB6T7WW5BJ4HQP76BFCYTTKDPBK22HXWS6JOMNAHO3RMEZ`](https://stellar.expert/explorer/testnet/contract/CDQSQVHPSTEB6T7WW5BJ4HQP76BFCYTTKDPBK22HXWS6JOMNAHO3RMEZ)
- 🔗 **Verifiable On-Chain Tx Hash**: [`0210a89e51fec9233645ab5cbe9dac5ddcbeb3f38d99dad520bdddaea387ef81`](https://stellar.expert/explorer/testnet/tx/0210a89e51fec9233645ab5cbe9dac5ddcbeb3f38d99dad520bdddaea387ef81)
- 📦 **WASM Code Hash**: `c05244703689bbbe34ca994fbc30b39837e76a665405e440d0d61b903ad3870c`

---

## 📑 Submission Checklist & Requirements Compliance

### Level 1 & Level 2 Checklist

- [x] **Public GitHub Repository**: Clean codebase without EVM/Solidity artifacts.
- [x] **README with Setup Instructions**: Complete setup and execution steps below.
- [x] **Minimum 2+ Meaningful Commits**: 3 clean commits in project history (`ab7f19a`, `d8cac21`, `bbc52a9`).
- [x] **Live Demo Link**: Hosted on Vercel at [frontend-eta-seven-24.vercel.app](https://frontend-eta-seven-24.vercel.app).
- [x] **Wallet Options Available**:
  1. **Freighter Extension**: Primary browser extension wallet on Stellar Testnet.
  2. **Stellar Web Wallet**: Secret Key / Keypair fallback with instant Friendbot funding.
- [x] **Deployed Contract Address**: `CDQSQVHPSTEB6T7WW5BJ4HQP76BFCYTTKDPBK22HXWS6JOMNAHO3RMEZ` on Stellar Testnet.
- [x] **Verifiable Transaction Hash**: `0210a89e51fec9233645ab5cbe9dac5ddcbeb3f38d99dad520bdddaea387ef81` on Stellar Explorer.
- [x] **3 Error Types Handled**: Categorized handling for Wallet Provider errors, Network/RPC errors, and Contract Execution errors.
- [x] **Contract Called from Frontend**: Interactive UI for calling `buy_rec`, `create_rec`, and `get_rec` methods.
- [x] **Real-Time On-Chain Telemetry**: Live Soroban RPC event stream log.

---

## 🛠️ Local Development & Setup Instructions

### Prerequisites
- Node.js (v18+)
- [Freighter Wallet Extension](https://www.freighter.app/) (Set network to **Stellar Testnet**)
- Rust & `wasm32-unknown-unknown` target (Optional, for smart contract development)

### 1. Installation

```bash
git clone https://github.com/sachinnit25/Renewable-Energy-Credit-Marketplace.git
cd Renewable-Energy-Credit-Marketplace
npm install
```

### 2. Run Local Web Server

```bash
npm start
```

Open `http://localhost:5173` (or `http://localhost:3000`) in your browser.

---

## ⚙️ Smart Contract Architecture (Soroban Rust)

The Soroban smart contract is located in `contracts/soroban_rec/src/lib.rs`.

### Contract Methods

1. **`initialize(admin: Address)`**: Initializes contract ownership and counters.
2. **`create_rec(creator, id, amount_mwh, price_stroops, source)`**: Mints/lists a new REC on-chain. Emits `rec:created` event.
3. **`buy_rec(buyer, id)`**: Purchases a REC lot with XLM. Emits `rec:purchased` event.
4. **`get_rec(id) -> RecItem`**: Queries on-chain REC metadata and ownership state.
5. **`get_rec_count() -> u64`**: Returns total RECs registered.

### Build Contract WASM

```bash
cd contracts/soroban_rec
cargo build --target wasm32-unknown-unknown --release
```

---

## 👛 Wallet Integration & Error Handling

### Wallet Providers Supported
1. **Freighter Wallet Extension**: Native extension detection, network validation (`Test SDF Network ; September 2015`), and XDR transaction signing.
2. **Stellar Web Wallet**: Testnet Keypair fallback with one-click secret key generation and Friendbot testnet funding (10,000 XLM).

### Categorized Error System
- **Wallet Provider Error**: Handled when Freighter is not installed, locked, or signature is rejected by the user.
- **Network & Environment Error**: Handled when wallet is set to Stellar Mainnet instead of Testnet or when RPC connection drops.
- **Account & Contract Execution Error**: Handled when account has insufficient XLM balance or contract execution panics.
