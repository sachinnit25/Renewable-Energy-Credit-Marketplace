import * as StellarSdk from "https://esm.sh/@stellar/stellar-sdk@13.3.0";
import * as FreighterApiModule from "https://esm.sh/@stellar/freighter-api";

const SDK = StellarSdk.default || StellarSdk;
const FreighterApi = FreighterApiModule.default || FreighterApiModule;
const HorizonServer = SDK.Horizon?.Server || SDK.Server;
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

const state = {
  publicKey: "",
  balance: null,
};

const els = {
  connectionBadge: document.querySelector("#connectionBadge"),
  walletAddress: document.querySelector("#walletAddress"),
  connectBtn: document.querySelector("#connectBtn"),
  disconnectBtn: document.querySelector("#disconnectBtn"),
  refreshBalanceBtn: document.querySelector("#refreshBalanceBtn"),
  balanceValue: document.querySelector("#balanceValue"),
  walletMessage: document.querySelector("#walletMessage"),
  paymentForm: document.querySelector("#paymentForm"),
  destinationInput: document.querySelector("#destinationInput"),
  amountInput: document.querySelector("#amountInput"),
  memoInput: document.querySelector("#memoInput"),
  sendBtn: document.querySelector("#sendBtn"),
  txFeedback: document.querySelector("#txFeedback"),
};

const server = new HorizonServer(HORIZON_URL);

function freighter() {
  return window.freighterApi;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function getFreighterApi() {
  if (FreighterApi?.isConnected) return FreighterApi;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (freighter()) return freighter();
    await wait(150);
  }

  return null;
}

function setWalletMessage(message, type = "info") {
  els.walletMessage.textContent = message;
  els.walletMessage.dataset.type = type;
}

function setTxFeedback(message, type = "idle") {
  els.txFeedback.className = `tx-feedback ${type}`;
  els.txFeedback.innerHTML = message;
}

function shortAddress(address) {
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

function unwrapFreighterValue(result, keys) {
  if (typeof result === "string" || typeof result === "boolean") return result;
  if (!result || typeof result !== "object") return result;
  if (result.error) throw new Error(result.error);

  for (const key of keys) {
    if (result[key] !== undefined) return result[key];
  }

  return result;
}

function setConnected(publicKey) {
  state.publicKey = publicKey;
  els.connectionBadge.textContent = "Connected";
  els.connectionBadge.className = "badge success";
  els.walletAddress.textContent = publicKey;
  els.connectBtn.disabled = true;
  els.disconnectBtn.disabled = false;
  els.refreshBalanceBtn.disabled = false;
  els.sendBtn.disabled = false;
  setWalletMessage(`Connected as ${shortAddress(publicKey)}.`, "success");
}

function setDisconnected(message = "Wallet disconnected.") {
  state.publicKey = "";
  state.balance = null;
  els.connectionBadge.textContent = "Disconnected";
  els.connectionBadge.className = "badge muted";
  els.walletAddress.textContent = "No wallet connected";
  els.balanceValue.textContent = "--";
  els.connectBtn.disabled = false;
  els.disconnectBtn.disabled = true;
  els.refreshBalanceBtn.disabled = true;
  els.sendBtn.disabled = true;
  setWalletMessage(message, "info");
  setTxFeedback("Connect Freighter to begin a testnet transaction.", "idle");
}

async function connectWallet() {
  try {
    const wallet = await getFreighterApi();

    if (!wallet) {
      throw new Error(
        "Freighter was not detected in this browser. Install it, enable it for this site, then reload the page.",
      );
    }

    const connected = unwrapFreighterValue(await wallet.isConnected(), [
      "isConnected",
    ]);
    if (!connected) {
      throw new Error("Freighter is installed but not available.");
    }

    let publicKey = "";
    if (typeof wallet.requestAccess === "function") {
      publicKey = unwrapFreighterValue(await wallet.requestAccess(), [
        "address",
        "publicKey",
      ]);
    } else {
      const allowed = unwrapFreighterValue(await wallet.isAllowed(), [
        "isAllowed",
      ]);
      if (!allowed) await wallet.setAllowed();
      publicKey = unwrapFreighterValue(await wallet.getAddress(), [
        "address",
        "publicKey",
      ]);
    }

    if (!publicKey || !publicKey.startsWith("G")) {
      throw new Error("Freighter did not return a valid Stellar public key.");
    }

    setConnected(publicKey);
    await fetchBalance();
  } catch (error) {
    setWalletMessage(error.message, "error");
  }
}

async function fetchBalance() {
  if (!state.publicKey) return;

  try {
    els.balanceValue.textContent = "Loading...";
    const account = await server.loadAccount(state.publicKey);
    const nativeBalance = account.balances.find(
      (balance) => balance.asset_type === "native",
    );

    state.balance = nativeBalance ? Number(nativeBalance.balance) : 0;
    els.balanceValue.textContent = `${state.balance.toFixed(7)} XLM`;
    setWalletMessage("Balance loaded from Stellar Testnet.", "success");
  } catch (error) {
    els.balanceValue.textContent = "--";
    setWalletMessage(
      "Could not fetch balance. Fund the account on Stellar Testnet first.",
      "error",
    );
    console.error(error);
  }
}

async function sendPayment(event) {
  event.preventDefault();

  if (!state.publicKey) {
    setTxFeedback("Connect your Freighter wallet first.", "error");
    return;
  }

  const destination = els.destinationInput.value.trim();
  const amount = Number(els.amountInput.value);
  const memoText = els.memoInput.value.trim();

  if (!destination.startsWith("G")) {
    setTxFeedback("Enter a valid Stellar testnet destination address.", "error");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    setTxFeedback("Enter an XLM amount greater than zero.", "error");
    return;
  }

  try {
    els.sendBtn.disabled = true;
    setTxFeedback("Building transaction for Freighter signature...", "pending");

    const sourceAccount = await server.loadAccount(state.publicKey);
    let builder = new SDK.TransactionBuilder(sourceAccount, {
      fee: SDK.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        SDK.Operation.payment({
          destination,
          asset: SDK.Asset.native(),
          amount: amount.toFixed(7),
        }),
      )
      .setTimeout(180);

    if (memoText) {
      builder = builder.addMemo(SDK.Memo.text(memoText.slice(0, 28)));
    }

    const transaction = builder.build();
    const wallet = await getFreighterApi();
    if (!wallet) {
      throw new Error("Freighter was not detected. Reload this app in the browser profile that has Freighter installed.");
    }

    const signedResponse = await wallet.signTransaction(transaction.toXDR(), {
      address: state.publicKey,
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    const signedXdr = unwrapFreighterValue(signedResponse, [
      "signedTxXdr",
      "signedXDR",
      "xdr",
    ]);
    const signedTransaction = SDK.TransactionBuilder.fromXDR(
      signedXdr,
      NETWORK_PASSPHRASE,
    );

    setTxFeedback("Submitting signed transaction to Stellar Testnet...", "pending");
    const result = await server.submitTransaction(signedTransaction);
    const hash = result.hash;

    setTxFeedback(
      `Success. Transaction confirmed.<br /><a href="https://stellar.expert/explorer/testnet/tx/${hash}" target="_blank" rel="noreferrer">${hash}</a>`,
      "success",
    );
    await fetchBalance();
  } catch (error) {
    const detail =
      error?.response?.data?.extras?.result_codes?.transaction ||
      error?.message ||
      "Transaction failed.";
    setTxFeedback(`Transaction failed: ${detail}`, "error");
    console.error(error);
  } finally {
    els.sendBtn.disabled = !state.publicKey;
  }
}

els.connectBtn.addEventListener("click", connectWallet);
els.disconnectBtn.addEventListener("click", () => setDisconnected());
els.refreshBalanceBtn.addEventListener("click", fetchBalance);
els.paymentForm.addEventListener("submit", sendPayment);

setDisconnected("Install Freighter, open this app in that browser, and switch to Testnet.");
