# REC Marketplace — Submission Ready Scaffold

Overview
- Hybrid demo: a Stellar Testnet static frontend (Freighter wallet) and an Ethereum smart-contract prototype (Hardhat + Solidity) demonstrating inter-contract communication and reward minting.

Project layout
- `contracts/` — Solidity contracts, tests, Hardhat config and deploy scripts.
- `frontend/` — Static Stellar Testnet demo (index.html, main.js, styles.css).
- `scripts/` — Hardhat deployment scripts.
- `.github/workflows/ci.yml` — CI that runs contract tests.

Quick start (developer)
1. Install repo dependencies (contracts):

```bash
cd outputs/rec-marketplace
npm install
```

2. Run Hardhat local node and deploy contracts locally:

```bash
npx hardhat node
# in another terminal
npx hardhat run scripts/deploy.js --network localhost
```

3. Run contract tests:

```bash
npm test
```

4. Serve the static frontend (deployable as-is to Vercel/Netlify):

```bash
# simple static server (install serve globally if needed)
npx serve frontend
# or deploy the `frontend` folder to Vercel/Netlify
```

Contract deployment to a public testnet (Sepolia)
1. Create a `.env` with:

```
SEPOLIA_RPC=https://sepolia.infura.io/v3/<YOUR_KEY>
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
```

2. Deploy:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Copy the deployed contract addresses and transaction hashes into the Submission Checklist section below.

Event streaming & realtime
- The Solidity `Marketplace` emits `ListingCreated` and `Purchased` events. For production realtime indexing use:
  - The Graph (subgraph) to index events and serve a GraphQL API.
  - OR a WebSocket provider (Alchemy/Infura) in the frontend to subscribe to events and update UI.

CI/CD
- `.github/workflows/ci.yml` runs `npm test` to verify contracts on PRs and pushes.
- For automatic frontend deployments, connect the `frontend` folder to Vercel or Netlify and set the build to `npm run build` if using a bundler, or point to `frontend` as a static folder.

Testing
- Contract tests live in `test/marketplace.test.js`. Running `npm test` shows passing tests (we included one integration test). Add frontend tests using Playwright or Cypress for UI flows.

Submission checklist (fill these before publishing)
- [ ] Public GitHub repository URL: ______________________
- [ ] README with complete documentation: this file (update any final deploy addresses below)
- [ ] Minimum 10+ meaningful commits: ensure history has 10 commits
- [ ] Live demo link (Vercel/Netlify): ______________________
- [ ] Contract deployment address(es): ______________________
- [ ] Transaction hash for contract interaction (purchase demo): ______________________
- [ ] Screenshot(s):
  - Mobile responsive UI screenshot: `screens/mobile.png`
  - CI pipeline running screenshot: `screens/ci.png`
  - Test output with 3+ passing tests: `screens/tests.png`
- [ ] Demo video link (1–2 minutes): ______________________

How to capture required artifacts
- Deploy frontend to Vercel: push branch -> connect Vercel -> set output directory to `frontend`.
- Deploy contracts to Sepolia: run the deploy script with `.env` as above. Save addresses and tx hashes.
- Interact with deployed contract (simple flow): use `scripts/interact.js` (you can add one) or use Ethers.js console to call `createListing` and `purchase`, then take screenshots and copy tx hashes.

Notes & next steps
- If you want I can:
  - Scaffold a React + Vite frontend (connect to Ethereum contracts via Ethers.js, display listings, subscribe to events) and add responsive UI and loading/error states.
  - Add a The Graph subgraph manifest and sample mapping to index `ListingCreated` and `Purchased`.
  - Add automated frontend CI that deploys to Vercel on push to `main`.
# Renewable Energy Credit Marketplace

A Level 1 Stellar Testnet project for a renewable energy credit marketplace.

## Features

- Freighter wallet setup guidance in the UI
- Wallet connect and disconnect
- Stellar Testnet XLM balance fetching
- Testnet XLM payment flow for REC purchases
- Success and failure transaction feedback with transaction hash links
- Client-side error handling for wallet, balance, and transaction states

## Run

Open `index.html` in a browser with the Freighter extension installed, or run a local static server:

```bash
node server.mjs
```

Then visit `http://localhost:5173`.

Use Freighter on Stellar Testnet and fund the account from the Stellar Laboratory friendbot before sending a transaction.
\n\n## Live demo\nLive demo URL: https://frontend-eta-seven-24.vercel.app\n
