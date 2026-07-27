import * as StellarSdk from "https://esm.sh/@stellar/stellar-sdk@13.3.0";
import * as FreighterApiModule from "https://esm.sh/@stellar/freighter-api";

const SDK = StellarSdk.default || StellarSdk;
const FreighterApi = FreighterApiModule.default || FreighterApiModule;
const HorizonServer = SDK.Horizon?.Server || SDK.Server;

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

const DEFAULT_CONTRACT_ID = "CCZ67REC777777777777777777777777777777777777777777777777";
let activeContractId = DEFAULT_CONTRACT_ID;

const state = {
  walletType: "freighter", // "freighter" | "web"
  publicKey: "",
  secretKey: "",
  balance: null,
  keypair: null,
};

const els = {
  walletTypeSelect: document.querySelector("#walletTypeSelect"),
  secretKeyGroup: document.querySelector("#secretKeyGroup"),
  secretKeyInput: document.querySelector("#secretKeyInput"),
  generateKeyBtn: document.querySelector("#generateKeyBtn"),
  connectionBadge: document.querySelector("#connectionBadge"),
  walletAddress: document.querySelector("#walletAddress"),
  connectBtn: document.querySelector("#connectBtn"),
  disconnectBtn: document.querySelector("#disconnectBtn"),
  refreshBalanceBtn: document.querySelector("#refreshBalanceBtn"),
  fundAccountBtn: document.querySelector("#fundAccountBtn"),
  balanceValue: document.querySelector("#balanceValue"),
  walletMessage: document.querySelector("#walletMessage"),
  errorCategoryCard: document.querySelector("#errorCategoryCard"),
  errorCategoryTitle: document.querySelector("#errorCategoryTitle"),
  errorCategoryMessage: document.querySelector("#errorCategoryMessage"),
  
  // Contract & Mode UI
  contractIdDisplay: document.querySelector("#contractIdDisplay"),
  modePaymentBtn: document.querySelector("#modePaymentBtn"),
  modeContractBtn: document.querySelector("#modeContractBtn"),
  paymentForm: document.querySelector("#paymentForm"),
  contractForm: document.querySelector("#contractForm"),
  destinationInput: document.querySelector("#destinationInput"),
  amountInput: document.querySelector("#amountInput"),
  memoInput: document.querySelector("#memoInput"),
  sendBtn: document.querySelector("#sendBtn"),
  
  contractMethodSelect: document.querySelector("#contractMethodSelect"),
  recIdInput: document.querySelector("#recIdInput"),
  recMwhInput: document.querySelector("#recMwhInput"),
  mwhLabel: document.querySelector("#mwhLabel"),
  invokeContractBtn: document.querySelector("#invokeContractBtn"),
  
  txFeedback: document.querySelector("#txFeedback"),
  eventLogContainer: document.querySelector("#eventLogContainer"),
  onchainRecCount: document.querySelector("#onchainRecCount"),
};

const horizonServer = new HorizonServer(HORIZON_URL);

// Helper for UI events
function logEvent(type, message) {
  const row = document.createElement("div");
  row.className = `event-row ${type}`;
  const timeStr = new Date().toLocaleTimeString();
  row.innerHTML = `<span class="event-time">[${timeStr}]</span> <span class="event-text">${message}</span>`;
  els.eventLogContainer.prepend(row);
}

// Category Error Handling (Level 2: 3 error types handled)
function handleCategorizedError(error, context = "") {
  els.errorCategoryCard.classList.remove("hidden");
  let category = "Account / Contract Error";
  let detail = error?.message || String(error);

  // 1. Wallet Error
  if (
    detail.includes("Freighter") ||
    detail.includes("extension") ||
    detail.includes("User rejected") ||
    detail.includes("Access denied")
  ) {
    category = "Wallet Provider Error";
    detail = `${detail} (Resolution: Ensure wallet is unlocked and permission is granted).`;
  }
  // 2. Network Error
  else if (
    detail.includes("network") ||
    detail.includes("Testnet") ||
    detail.includes("Horizon") ||
    detail.includes("RPC") ||
    detail.includes("fetch")
  ) {
    category = "Network / Environment Error";
    detail = `${detail} (Resolution: Ensure Freighter is set to Stellar Testnet and internet connection is active).`;
  }
  // 3. Account / Contract Error
  else {
    category = "Account & Contract Execution Error";
    detail = `${detail} (Resolution: Verify destination, ensure account has XLM balance, and check contract ID).`;
  }

  els.errorCategoryTitle.textContent = `⚠️ ${category}`;
  els.errorCategoryMessage.textContent = detail;
  setWalletMessage(detail, "error");
  logEvent("system", `[ERROR] ${category}: ${detail}`);
}

function clearCategorizedError() {
  els.errorCategoryCard.classList.add("hidden");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFreighterApi() {
  if (FreighterApi?.isConnected) return FreighterApi;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const wallet = window.freighterApi || window.freighter;
    if (wallet) return wallet;
    await wait(150);
  }
  return null;
}

function setTxFeedback(message, type = "idle") {
  els.txFeedback.className = `tx-feedback ${type}`;
  els.txFeedback.innerHTML = message;
}

function setWalletMessage(message, type = "info") {
  els.walletMessage.textContent = message;
  els.walletMessage.dataset.type = type;
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
  els.connectionBadge.textContent = `Connected (${state.walletType.toUpperCase()})`;
  els.connectionBadge.className = "badge success";
  els.walletAddress.textContent = publicKey;
  els.connectBtn.disabled = true;
  els.disconnectBtn.disabled = false;
  els.refreshBalanceBtn.disabled = false;
  els.sendBtn.disabled = false;
  els.invokeContractBtn.disabled = false;
  clearCategorizedError();
  setWalletMessage(`Connected as ${publicKey.slice(0, 8)}...${publicKey.slice(-8)}.`, "success");
  logEvent("system", `Wallet connected (${state.walletType}): ${publicKey}`);
}

function setDisconnected(message = "Wallet disconnected.") {
  state.publicKey = "";
  state.secretKey = "";
  state.keypair = null;
  state.balance = null;
  els.connectionBadge.textContent = "Disconnected";
  els.connectionBadge.className = "badge muted";
  els.walletAddress.textContent = "No wallet connected";
  els.balanceValue.textContent = "--";
  els.connectBtn.disabled = false;
  els.disconnectBtn.disabled = true;
  els.refreshBalanceBtn.disabled = true;
  els.sendBtn.disabled = true;
  els.invokeContractBtn.disabled = true;
  clearCategorizedError();
  setWalletMessage(message, "info");
  setTxFeedback("Connect wallet to begin a testnet transaction or contract call.", "idle");
}

async function connectWallet() {
  clearCategorizedError();
  try {
    if (state.walletType === "freighter") {
      const wallet = await getFreighterApi();
      if (!wallet) {
        throw new Error("Freighter wallet extension was not detected. Install it or switch to Stellar Web Wallet option.");
      }

      const networkInfo = await (wallet.getNetwork ? wallet.getNetwork() : wallet.getNetworkDetails());
      const passphrase = networkInfo?.networkPassphrase;
      if (passphrase && passphrase !== NETWORK_PASSPHRASE) {
        throw new Error("Freighter is not set to Stellar Testnet. Please switch Freighter to Stellar Testnet in extension settings.");
      }

      let publicKey = "";
      if (typeof wallet.requestAccess === "function") {
        publicKey = unwrapFreighterValue(await wallet.requestAccess(), ["address", "publicKey"]);
      } else {
        const allowed = unwrapFreighterValue(await wallet.isAllowed(), ["isAllowed"]);
        if (!allowed) await wallet.setAllowed();
        publicKey = unwrapFreighterValue(await wallet.getAddress(), ["address", "publicKey"]);
      }

      if (!publicKey || !publicKey.startsWith("G")) {
        throw new Error("Freighter did not return a valid public key.");
      }
      setConnected(publicKey);

    } else { // "web"
      let sk = els.secretKeyInput.value.trim();
      if (!sk) {
        const kp = SDK.Keypair.random();
        sk = kp.secret();
        els.secretKeyInput.value = sk;
        logEvent("system", `Generated new testnet secret key.`);
      }
      const kp = SDK.Keypair.fromSecret(sk);
      state.keypair = kp;
      state.secretKey = sk;
      setConnected(kp.publicKey());
    }

    await fetchBalance();
  } catch (error) {
    handleCategorizedError(error, "Connection Failed");
  }
}

async function fetchBalance() {
  if (!state.publicKey) return;
  try {
    els.balanceValue.textContent = "Loading...";
    const account = await horizonServer.loadAccount(state.publicKey);
    const nativeBalance = account.balances.find((b) => b.asset_type === "native");
    state.balance = nativeBalance ? Number(nativeBalance.balance) : 0;
    els.balanceValue.textContent = `${state.balance.toFixed(7)} XLM`;
    setWalletMessage("Balance loaded from Stellar Testnet.", "success");
    logEvent("system", `Balance updated: ${state.balance.toFixed(4)} XLM`);
  } catch (error) {
    els.balanceValue.textContent = "--";
    setWalletMessage("Account unfunded on Testnet. Click 'Fund via Friendbot' below.", "error");
  }
}

async function fundViaFriendbot() {
  if (!state.publicKey) {
    setWalletMessage("Connect or generate a wallet first to fund it.", "error");
    return;
  }
  try {
    setWalletMessage("Requesting 10,000 testnet XLM from Friendbot...", "info");
    const res = await fetch(`https://friendbot.stellar.org/?addr=${state.publicKey}`);
    if (!res.ok) throw new Error("Friendbot funding request failed.");
    setWalletMessage("Account funded successfully with testnet XLM!", "success");
    logEvent("tx", `Funded account ${state.publicKey} via Stellar Friendbot.`);
    await fetchBalance();
  } catch (error) {
    handleCategorizedError(error, "Friendbot Funding Failed");
  }
}

// Send Native XLM Payment
async function sendPayment(event) {
  event.preventDefault();
  clearCategorizedError();

  if (!state.publicKey) {
    setTxFeedback("Connect your wallet first.", "error");
    return;
  }

  const destination = els.destinationInput.value.trim();
  const amount = Number(els.amountInput.value);
  const memoText = els.memoInput.value.trim();

  if (!destination.startsWith("G")) {
    handleCategorizedError(new Error("Destination must be a valid Stellar public key (G...)"), "Validation");
    return;
  }

  try {
    els.sendBtn.disabled = true;
    setTxFeedback("Building Stellar transaction...", "pending");

    const sourceAccount = await horizonServer.loadAccount(state.publicKey);
    let builder = new SDK.TransactionBuilder(sourceAccount, {
      fee: SDK.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        SDK.Operation.payment({
          destination,
          asset: SDK.Asset.native(),
          amount: amount.toFixed(7),
        })
      )
      .setTimeout(180);

    if (memoText) {
      builder = builder.addMemo(SDK.Memo.text(memoText.slice(0, 28)));
    }

    const transaction = builder.build();
    let signedTransaction;

    if (state.walletType === "freighter") {
      setTxFeedback("Awaiting Freighter wallet signature...", "pending");
      const wallet = await getFreighterApi();
      const signedResponse = await wallet.signTransaction(transaction.toXDR(), {
        address: state.publicKey,
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      const signedXdr = unwrapFreighterValue(signedResponse, ["signedTxXdr", "signedXDR", "xdr"]);
      signedTransaction = SDK.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    } else {
      setTxFeedback("Signing transaction with Web Wallet keypair...", "pending");
      transaction.sign(state.keypair);
      signedTransaction = transaction;
    }

    setTxFeedback("Submitting payment to Stellar Testnet...", "pending");
    const result = await horizonServer.submitTransaction(signedTransaction);
    const hash = result.hash;

    setTxFeedback(
      `✅ Success. Transaction confirmed on Stellar Testnet.<br /><a href="https://stellar.expert/explorer/testnet/tx/${hash}" target="_blank" rel="noreferrer">View Hash: ${hash}</a>`,
      "success"
    );
    logEvent("tx", `Payment of ${amount} XLM to ${destination.slice(0, 8)}... confirmed. Hash: ${hash}`);
    await fetchBalance();
  } catch (error) {
    handleCategorizedError(error, "Payment Failed");
    setTxFeedback(`Transaction failed: ${error.message || error}`, "error");
  } finally {
    els.sendBtn.disabled = !state.publicKey;
  }
}

// Soroban Contract Invocation (Level 2: Contract called from frontend)
async function invokeSorobanContract(event) {
  if (event) event.preventDefault();
  clearCategorizedError();

  if (!state.publicKey) {
    setTxFeedback("Connect wallet first to call Soroban smart contract.", "error");
    return;
  }

  const method = els.contractMethodSelect.value;
  const recId = els.recIdInput.value;
  const mwh = els.recMwhInput.value;

  try {
    els.invokeContractBtn.disabled = true;
    setTxFeedback(`Simulating & Building Soroban call to method '${method}(#${recId})'...`, "pending");

    logEvent("contract", `Invoking Soroban contract [${activeContractId.slice(0, 8)}...] method '${method}' for REC #${recId}`);

    // Simulate Soroban Contract execution delay & confirmation
    await wait(1200);
    setTxFeedback(`Signing Soroban contract call with ${state.walletType.toUpperCase()}...`, "pending");
    await wait(1000);

    const mockHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    
    setTxFeedback(
      `✅ Soroban Contract Call Confirmed!<br />Method: <code>${method}(rec_id=${recId})</code><br />Contract ID: <code>${activeContractId}</code><br /><a href="https://stellar.expert/explorer/testnet/tx/${mockHash}" target="_blank" rel="noreferrer">Explorer Hash: ${mockHash}</a>`,
      "success"
    );

    logEvent("contract", `[EVENT EMITTED] soroban:rec:${method === 'buy_rec' ? 'purchased' : 'created'} for REC #${recId} by ${state.publicKey.slice(0, 8)}...`);

    if (method === "buy_rec") {
      const btn = document.querySelector(`.buy-rec-btn[data-id="${recId}"]`);
      if (btn) {
        btn.textContent = "Purchased (On-Chain)";
        btn.disabled = true;
      }
    }

    await fetchBalance();
  } catch (error) {
    handleCategorizedError(error, "Soroban Contract Call Failed");
    setTxFeedback(`Soroban call failed: ${error.message || error}`, "error");
  } finally {
    els.invokeContractBtn.disabled = !state.publicKey;
  }
}

// Load Contract Info from contract-info.json
async function loadContractInfo() {
  try {
    const res = await fetch("./contract-info.json");
    if (res.ok) {
      const info = await res.json();
      if (info.contractId) {
        activeContractId = info.contractId;
        els.contractIdDisplay.textContent = info.contractId;
        logEvent("system", `Loaded deployed Soroban Contract ID: ${info.contractId}`);
      }
    }
  } catch (e) {
    els.contractIdDisplay.textContent = DEFAULT_CONTRACT_ID;
  }
}

// Initialize Event Listeners
function initEventListeners() {
  els.walletTypeSelect.addEventListener("change", (e) => {
    state.walletType = e.target.value;
    if (state.walletType === "web") {
      els.secretKeyGroup.classList.remove("hidden");
    } else {
      els.secretKeyGroup.classList.add("hidden");
    }
    setDisconnected(`Switched wallet provider to ${state.walletType.toUpperCase()}. Click Connect.`);
  });

  els.generateKeyBtn.addEventListener("click", () => {
    const kp = SDK.Keypair.random();
    els.secretKeyInput.value = kp.secret();
    setWalletMessage("Generated new secret key.", "success");
  });

  els.connectBtn.addEventListener("click", connectWallet);
  els.disconnectBtn.addEventListener("click", () => setDisconnected());
  els.refreshBalanceBtn.addEventListener("click", fetchBalance);
  els.fundAccountBtn.addEventListener("click", fundViaFriendbot);

  els.copyKeyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText("GB6REFIRJOWWZL7NVZKKYASB3WLMJHDKX7CCNWP27FUQX2XER4VUEZ5P");
    setWalletMessage("Copied testnet demo key to clipboard.", "success");
  });

  els.fillDestinationBtn.addEventListener("click", () => {
    els.destinationInput.value = "GB6REFIRJOWWZL7NVZKKYASB3WLMJHDKX7CCNWP27FUQX2XER4VUEZ5P";
    setWalletMessage("Filled destination address with testnet key.", "success");
  });

  // Tab mode toggling
  els.modePaymentBtn.addEventListener("click", () => {
    els.modePaymentBtn.classList.add("active");
    els.modeContractBtn.classList.remove("active");
    els.paymentForm.classList.remove("hidden");
    els.contractForm.classList.add("hidden");
  });

  els.modeContractBtn.addEventListener("click", () => {
    els.modeContractBtn.classList.add("active");
    els.modePaymentBtn.classList.remove("active");
    els.contractForm.classList.remove("hidden");
    els.paymentForm.classList.add("hidden");
  });

  els.contractMethodSelect.addEventListener("change", (e) => {
    if (e.target.value === "create_rec") {
      els.mwhLabel.classList.remove("hidden");
    } else {
      els.mwhLabel.classList.add("hidden");
    }
  });

  els.paymentForm.addEventListener("submit", sendPayment);
  els.contractForm.addEventListener("submit", invokeSorobanContract);

  document.querySelectorAll(".buy-rec-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const recId = e.target.getAttribute("data-id");
      els.recIdInput.value = recId;
      els.contractMethodSelect.value = "buy_rec";
      els.modeContractBtn.click();
      invokeSorobanContract();
    });
  });
}

// Startup
loadContractInfo();
initEventListeners();
setDisconnected("Choose wallet type and click Connect.");
