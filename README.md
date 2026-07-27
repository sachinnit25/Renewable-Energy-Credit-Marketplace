# Renewable Energy Credit Marketplace

A Level 1 Stellar Testnet project for a renewable energy credit (REC) marketplace.

## Features

- **Freighter Wallet Integration**: Connect and disconnect the Freighter browser extension on Stellar Testnet.
- **Balance Handling**: Fetch and display the connected wallet's live XLM balance from Horizon Testnet.
- **Transaction Flow**: Send testnet XLM payments with custom memos to simulate purchasing renewable energy credit lots.
- **Transaction Feedback**: Clear UI indicators for pending, success (with Stellar Expert transaction hash links), and error states.
- **Development & Design Standards**: Responsive modern web interface, robust error handling, and demo key utilities.

## How to Run

1. Make sure you have the [Freighter Wallet](https://www.freighter.app/) extension installed in your browser.
2. Open Freighter, navigate to **Settings**, and ensure the network is set to **Stellar Testnet**.
3. Serve the static project:

```bash
npm start
```

Or run the node static server directly:

```bash
node server.mjs
```

4. Visit `http://localhost:5173` (or `http://localhost:3000`), connect your wallet, fund your testnet account via Friendbot, and submit a testnet transaction!

## Requirements Fulfillment (Level 1)

1. **Wallet Setup**: Configured for Freighter on Stellar Testnet.
2. **Wallet Connection**: Implement Connect & Disconnect buttons.
3. **Balance Handling**: Fetch and display connected XLM balance in real time.
4. **Transaction Flow**: Build, sign, submit XLM transactions on testnet, and display confirmation hash link.
5. **Development Standards**: Clean architecture, user guidance, error handling, and testnet address utilities.
