import * as StellarSdk from "https://esm.sh/@stellar/stellar-sdk@13.3.0";
import * as FreighterApiModule from "https://esm.sh/@stellar/freighter-api";
import {
  categorizeError,
  defaultPriceStroops,
  formatContractEvent,
  recSourceForId,
} from "./lib/soroban-helpers.js";
import {
  addressToScVal,
  createSorobanClient,
  fetchContractEvents,
  invokeContractCall,
  simulateContractCall,
  symbolToScVal,
} from "./lib/soroban-client.js";

const SDK = StellarSdk.default || StellarSdk;
const FreighterApi = FreighterApiModule.default || FreighterApiModule;
const HorizonServer = SDK.Horizon?.Server || SDK.Server;

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const EXPLORER_TX = "https://stellar.expert/explorer/testnet/tx/";

const DEFAULT_CONTRACT_ID = "CDQSQVHPSTEB6T7WW5BJ4HQP76BFCYTTKDPBK22HXWS6JOMNAHO3RMEZ";
let activeContractId = DEFAULT_CONTRACT_ID;
let rewardContractId = null;
let eventPollStartLedger = null;
let seenEventIds = new Set();
let eventPollTimer = null;

const state = {
  walletType: "freighter",
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
  contractIdDisplay: document.querySelector("#contractIdDisplay"),
  rewardContractDisplay: document.querySelector("#rewardContractDisplay"),
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
  copyKeyBtn: document.querySelector("#copyKeyBtn"),
  fillDestinationBtn: document.querySelector("#fillDestinationBtn"),
};

const horizonServer = new HorizonServer(HORIZON_URL);
const sorobanRpc = createSorobanClient(SDK, SOROBAN_RPC_URL);

function logEvent(type, message) {
  const row = document.createElement("div");
  row.className = `event-row ${type}`;
  const timeStr = new Date().toLocaleTimeString();
  row.innerHTML = `<span class="event-time">[${timeStr}]</span> <span class="event-text">${message}</span>`;
  els.eventLogContainer.prepend(row);
}

function handleCategorizedError(error, context = "") {
  els.errorCategoryCard.classList.remove("hidden");
  const detail = error?.message || String(error);
  const category = categorizeError(detail);
  let message = detail;

  if (category === "Wallet Provider Error") {
    message = `${detail} (Resolution: Ensure wallet is unlocked and permission is granted).`;
  } else if (category === "Network / Environment Error") {
    message = `${detail} (Resolution: Ensure Freighter is set to Stellar Testnet and internet connection is active).`;
  } else {
    message = `${detail} (Resolution: Verify inputs, fund account via Friendbot, and confirm contract is initialized).`;
  }

  els.errorCategoryTitle.textContent = `⚠️ ${category}`;
  els.errorCategoryMessage.textContent = message;
  setWalletMessage(context ? `${context}: ${message}` : message, "error");
  logEvent("system", `[ERROR] ${category}: ${message}`);
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

async function signPreparedTransaction(tx) {
  if (state.walletType === "freighter") {
    const wallet = await getFreighterApi();
    if (!wallet) throw new Error("Freighter wallet extension was not detected.");
    const signedResponse = await wallet.signTransaction(tx.toXDR(), {
      address: state.publicKey,
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    const signedXdr = unwrapFreighterValue(signedResponse, ["signedTxXdr", "signedXDR", "xdr"]);
    return SDK.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  }
  tx.sign(state.keypair);
  return tx;
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
  refreshOnChainRecCount();
  startEventStream();
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
  stopEventStream();
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
    } else {
      let sk = els.secretKeyInput.value.trim();
      if (!sk) {
        const kp = SDK.Keypair.random();
        sk = kp.secret();
        els.secretKeyInput.value = sk;
        logEvent("system", "Generated new testnet secret key.");
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
  } catch {
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
        }),
      )
      .setTimeout(180);

    if (memoText) {
      builder = builder.addMemo(SDK.Memo.text(memoText.slice(0, 28)));
    }

    const transaction = builder.build();
    const signedTransaction = await signPreparedTransaction(transaction);

    setTxFeedback("Submitting payment to Stellar Testnet...", "pending");
    const result = await horizonServer.submitTransaction(signedTransaction);
    const hash = result.hash;

    setTxFeedback(
      `✅ Success. Transaction confirmed on Stellar Testnet.<br /><a href="${EXPLORER_TX}${hash}" target="_blank" rel="noreferrer">View Hash: ${hash}</a>`,
      "success",
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

async function refreshOnChainRecCount() {
  if (!state.publicKey || !activeContractId) return;
  try {
    const count = await simulateContractCall({
      SDK,
      rpcServer: sorobanRpc,
      contractId: activeContractId,
      method: "get_rec_count",
      scValArgs: [],
      publicKey: state.publicKey,
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    if (typeof count === "number" || typeof count === "bigint") {
      els.onchainRecCount.textContent = String(count);
    }
  } catch {
    // Account may be unfunded; keep default display.
  }
}

function buildMethodArgs(method, recId, mwh) {
  if (method === "get_rec") {
    return [SDK.nativeToScVal(BigInt(recId), { type: "u64" })];
  }
  if (method === "create_rec") {
    return [
      addressToScVal(SDK, state.publicKey),
      SDK.nativeToScVal(BigInt(recId), { type: "u64" }),
      SDK.nativeToScVal(Number(mwh), { type: "u32" }),
      SDK.nativeToScVal(defaultPriceStroops(recId), { type: "i64" }),
      symbolToScVal(SDK, recSourceForId(recId)),
    ];
  }
  if (method === "buy_rec") {
    return [
      addressToScVal(SDK, state.publicKey),
      SDK.nativeToScVal(BigInt(recId), { type: "u64" }),
    ];
  }
  throw new Error(`Unsupported contract method: ${method}`);
}

async function invokeSorobanContract(event) {
  if (event) event.preventDefault();
  clearCategorizedError();

  if (!state.publicKey) {
    setTxFeedback("Connect wallet first to call Soroban smart contract.", "error");
    return;
  }

  const method = els.contractMethodSelect.value;
  const recId = Number(els.recIdInput.value);
  const mwh = Number(els.recMwhInput.value) || 50;

  if (!Number.isFinite(recId) || recId <= 0) {
    handleCategorizedError(new Error("REC Lot ID must be a positive number."), "Validation");
    return;
  }

  try {
    els.invokeContractBtn.disabled = true;
    const scValArgs = buildMethodArgs(method, recId, mwh);

    logEvent("contract", `Invoking ${method} on ${activeContractId.slice(0, 8)}… for REC #${recId}`);

    if (method === "get_rec") {
      setTxFeedback(`Simulating read-only call get_rec(${recId}) via Soroban RPC…`, "pending");
      const rec = await simulateContractCall({
        SDK,
        rpcServer: sorobanRpc,
        contractId: activeContractId,
        method,
        scValArgs,
        publicKey: state.publicKey,
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      setTxFeedback(
        `✅ get_rec(${recId}) result:<br /><pre>${JSON.stringify(rec, null, 2)}</pre>`,
        "success",
      );
      logEvent("contract", `get_rec #${recId}: ${rec ? JSON.stringify(rec) : "null"}`);
      return;
    }

    setTxFeedback(`Simulating & preparing ${method} transaction…`, "pending");
    const { hash } = await invokeContractCall({
      SDK,
      rpcServer: sorobanRpc,
      contractId: activeContractId,
      method,
      scValArgs,
      publicKey: state.publicKey,
      networkPassphrase: NETWORK_PASSPHRASE,
      signTransaction: signPreparedTransaction,
    });

    setTxFeedback(
      `✅ Soroban contract call confirmed!<br />Method: <code>${method}(rec_id=${recId})</code><br />Contract: <code>${activeContractId}</code><br /><a href="${EXPLORER_TX}${hash}" target="_blank" rel="noreferrer">Explorer Hash: ${hash}</a>`,
      "success",
    );
    logEvent("contract", `${method} confirmed for REC #${recId}. Hash: ${hash}`);

    if (method === "buy_rec") {
      const btn = document.querySelector(`.buy-rec-btn[data-id="${recId}"]`);
      if (btn) {
        btn.textContent = "Purchased (On-Chain)";
        btn.disabled = true;
      }
    }

    await refreshOnChainRecCount();
    await pollContractEventsOnce();
    await fetchBalance();
  } catch (error) {
    handleCategorizedError(error, "Soroban Contract Call Failed");
    setTxFeedback(`Soroban call failed: ${error.message || error}`, "error");
  } finally {
    els.invokeContractBtn.disabled = !state.publicKey;
  }
}

async function pollContractEventsOnce() {
  if (!activeContractId) return;
  try {
    const { events, nextStartLedger } = await fetchContractEvents({
      rpcServer: sorobanRpc,
      contractId: activeContractId,
      startLedger: eventPollStartLedger,
      limit: 30,
    });

    for (const evt of events) {
      const id = evt.id || `${evt.txHash}-${evt.ledger}-${evt.eventIndex}`;
      if (seenEventIds.has(id)) continue;
      seenEventIds.add(id);
      logEvent("contract", formatContractEvent(evt));
    }

    eventPollStartLedger = nextStartLedger;
  } catch (error) {
    logEvent("system", `Event poll warning: ${error.message || error}`);
  }
}

function startEventStream() {
  stopEventStream();
  pollContractEventsOnce();
  eventPollTimer = window.setInterval(pollContractEventsOnce, 8000);
  logEvent("system", "Soroban RPC event stream started (polling every 8s).");
}

function stopEventStream() {
  if (eventPollTimer) {
    window.clearInterval(eventPollTimer);
    eventPollTimer = null;
  }
}

async function loadContractInfo() {
  try {
    const res = await fetch("./contract-info.json");
    if (!res.ok) return;
    const info = await res.json();
    if (info.contractId) {
      activeContractId = info.contractId;
      els.contractIdDisplay.textContent = info.contractId;
      logEvent("system", `Loaded marketplace contract: ${info.contractId}`);
    }
    if (info.rewardTokenContractId && els.rewardContractDisplay) {
      rewardContractId = info.rewardTokenContractId;
      els.rewardContractDisplay.textContent = info.rewardTokenContractId;
      logEvent("system", `Loaded reward token contract: ${info.rewardTokenContractId}`);
    }
    if (info.interactionTxHash) {
      logEvent("tx", `Last deployment interaction: ${info.interactionTxHash}`);
    }
  } catch {
    els.contractIdDisplay.textContent = DEFAULT_CONTRACT_ID;
  }
}

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

  els.copyKeyBtn?.addEventListener("click", () => {
    navigator.clipboard.writeText("GB6REFIRJOWWZL7NVZKKYASB3WLMJHDKX7CCNWP27FUQX2XER4VUEZ5P");
    setWalletMessage("Copied testnet demo key to clipboard.", "success");
  });

  els.fillDestinationBtn?.addEventListener("click", () => {
    els.destinationInput.value = "GB6REFIRJOWWZL7NVZKKYASB3WLMJHDKX7CCNWP27FUQX2XER4VUEZ5P";
    setWalletMessage("Filled destination address with testnet key.", "success");
  });

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

loadContractInfo();
initEventListeners();
setDisconnected("Choose wallet type and click Connect.");
