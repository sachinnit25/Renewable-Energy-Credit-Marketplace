This folder contains the smart contracts, tests, and deployment scripts for the Rec Marketplace.

Tech stack:
- Solidity ^0.8.19
- Hardhat for dev, testing and deployment
- OpenZeppelin for ERC20
- Ethers.js (via Hardhat toolbox)

Files added:
- `contracts/Reward.sol` - ERC20 reward token with `mint` restricted to owner.
- `contracts/Marketplace.sol` - Listing marketplace that calls `Reward.mint` to reward participants.
- `scripts/deploy.js` - Deploys Reward then Marketplace and transfers ownership of Reward to Marketplace.
- `test/marketplace.test.js` - Integration test for listing + purchase + reward minting.
- `.github/workflows/ci.yml` - CI to run tests.

Next steps:
- Add frontend listeners for `ListingCreated` / `Purchased` events (WebSocket provider or The Graph).
- Add The Graph subgraph manifest to index events for real-time streaming.
- Implement production deployment and secrets handling for networks (Alchemy/Infura keys).
