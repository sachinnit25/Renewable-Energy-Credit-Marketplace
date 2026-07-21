# Renewable Energy Credit Marketplace

A Level 1 Stellar Testnet project for a renewable energy credit marketplace.

## Features

- Freighter wallet setup guidance in the UI
- Wallet connect and disconnect
- Stellar Testnet XLM balance fetching
- Testnet XLM payment flow for REC purchases
- Success and failure transaction feedback with transaction hash links
- Client-side error handling for wallet, balance, and transaction states

## Level 1 Requirement Map

### 1. Wallet Setup

- Uses Freighter wallet through `@stellar/freighter-api`
- Uses Stellar Testnet Horizon: `https://horizon-testnet.stellar.org`
- Uses Stellar Testnet network passphrase: `Test SDF Network ; September 2015`
- Shows setup links for Freighter install and testnet funding

### 2. Wallet Connection

- `connectWallet()` requests wallet access
- `setConnected()` updates the UI after a successful connection
- `setDisconnected()` handles wallet disconnect and resets UI state

### 3. Balance Handling

- `fetchBalance()` loads the connected account from Stellar Horizon
- Native XLM balance is extracted from account balances
- Balance is displayed in the wallet panel as XLM

### 4. Transaction Flow

- `sendPayment()` builds a Stellar Testnet XLM payment transaction
- Freighter signs the transaction with `signTransaction()`
- Signed transaction is submitted to Stellar Testnet Horizon
- Success feedback displays a confirmation message and transaction hash link
- Failure feedback displays an error state and reason

### 5. Development Standards

- UI setup: `index.html` and `styles.css`
- Wallet integration: Freighter connection helpers in `main.js`
- Balance fetch: `fetchBalance()` in `main.js`
- Transaction logic: `sendPayment()` in `main.js`
- Error handling: wallet, balance, validation, signing, and submission errors are shown in the UI

## Run

Open `index.html` in a browser with the Freighter extension installed, or run a local static server:

```bash
node server.mjs
```

Then visit `http://localhost:5173`.

Use Freighter on Stellar Testnet and fund the account from the Stellar Laboratory friendbot before sending a transaction.
