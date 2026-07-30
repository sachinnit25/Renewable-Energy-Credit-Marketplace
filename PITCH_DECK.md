# REC Marketplace — Pitch Deck & Product Presentation

## 1. Problem Statement
The global Renewable Energy Credit (REC) market faces several critical inefficiencies:
- **Lack of Transparency**: Traditional REC registries suffer from opaque issuance, double-counting risk, and slow settlement times (T+3 to T+14 days).
- **High Friction & Costs**: Micro-generators (solar rooftop owners, small hydro plants) are excluded from REC markets due to prohibitive broker fees and minimum batch size requirements.
- **Verification Gaps**: Off-chain certificate verification creates compliance risks for institutional buyers seeking real-time proof of green power consumption.

---

## 2. The Solution
An end-to-end decentralized **Renewable Energy Credit Marketplace** built on **Stellar Testnet** and **Soroban Smart Contracts**:
- **Instant Settlement**: Near-instant settlement in XLM via Stellar Horizon & Soroban RPC.
- **Inter-Contract Token Rewards**: Every REC purchase triggers on-chain inter-contract minting of **RECT reward tokens** directly to buyer wallets.
- **Fractionalized Micro-Lots**: Support for small MWh credit lots, enabling democratic participation for clean energy producers.
- **Real-Time On-Chain Telemetry**: Live event streaming (`getEvents`) provides audit-proof verifiability for every REC created and bought.

---

## 3. Market Opportunity
- **TAM (Total Addressable Market)**: Global Voluntary Carbon & Energy Credit Market projected to reach **$100B+ by 2030**.
- **SAM (Serviceable Addressable Market)**: Decentralized & Micro-grid Energy Credit trading estimated at **$12B**.
- **SOM (Serviceable Obtainable Market)**: Web3-native corporate sustainability buyers and Stellar ecosystem clean-tech integrations ($250M initial target).

---

## 4. Architecture Overview

```mermaid
flowchart TD
  subgraph Frontend Layer
    UI[React + Vite Mobile Responsive App]
    Telemetry[Real-Time Soroban RPC Event Streamer]
    Feedback[User Onboarding & Feedback Collector]
  end

  subgraph Stellar Blockchain Network
    RPC[Soroban RPC Node]
    HZ[Stellar Horizon API]
    Marketplace[RecMarketplaceContract (Soroban Rust)]
    RewardToken[RewardTokenContract (Soroban Rust)]
  end

  UI -->|Simulate & Sign Transactions| RPC
  UI -->|Native XLM Payments| HZ
  Telemetry -->|Poll getEvents (8s)| RPC
  Marketplace -->|Inter-Contract Mint (buy_rec)| RewardToken
```

### Key Technical Innovations
- **Soroban Rust Smart Contract**: Custom storage management (`Env::storage`), authorization checks (`require_auth`), and lifecycle verification.
- **Multi-Wallet Support**: Native Freighter Extension integration with automatic Stellar Web Keypair fallback & Friendbot auto-funding.
- **Categorized Error System**: Runtime categorizer partitioning errors into Wallet Provider, Network/Environment, and Execution domains.

---

## 5. Growth Strategy & User Onboarding
- **Community Onboarding**: 50+ testnet users onboarded with verified wallet transaction activity.
- **Feedback Collection System**: Google Form + integrated product feedback survey collecting rating metrics and qualitative user input.
- **Partner Ecosystem**: Integrating clean energy producers across Asia-Pacific and micro-hydro collectives.

---

## 6. Future Roadmap

### Phase 1: MVP & Verification (Completed — Level 4/5)
- [x] Soroban smart contracts & inter-contract RECT reward minting
- [x] React + Vite frontend with live RPC telemetry
- [x] Production deployment on Vercel
- [x] 50+ user onboarding & feedback data integration

### Phase 2: Mainnet Launch & IoT Sensor Integration (Q3 2026)
- [ ] Direct smart-meter IoT integration for automatic on-chain REC minting based on real solar generation
- [ ] Stellar Mainnet deployment with multi-asset liquidity pools (USDC / XLM)

### Phase 3: Institutional Governance & Carbon Offsets (Q4 2026)
- [ ] DAO-governed REC verifier registry
- [ ] Cross-chain bridge to Ethereum & Polygon carbon protocols
