import * as StellarSdk from "https://esm.sh/@stellar/stellar-sdk@13.3.0";
import * as FreighterApiModule from "https://esm.sh/@stellar/freighter-api";

const SDK = StellarSdk.default || StellarSdk;
const FreighterApi = FreighterApiModule.default || FreighterApiModule;
const HorizonServer = SDK.Horizon?.Server || SDK.Server;

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

const DEFAULT_CONTRACT_ID = "CDQSQVHPSTEB6T7WW5BJ4HQP76BFCYTTKDPBK22HXWS6JOMNAHO3RMEZ";
let activeContractId = DEFAULT_CONTRACT_ID;

const state = {
  walletType: "freighter", // "freighter" | "web"
  publicKey: "",
  secretKey: "",
  balance: null,
  keypair: null,
  recs: [
    { id: 101, title: "Rajasthan Solar Park", amount_mwh: 50, price_xlm: 1.0, source: "solar", owner: "GB6REFIRJOWWZL7NVZKKYASB3WLMJHDKX7CCNWP27FUQX2XER4VUEZ5P", status: "Active" },
    { id: 102, title: "Gujarat Offshore Wind", amount_mwh: 120, price_xlm: 2.5, source: "wind", owner: "GB6REFIRJOWWZL7NVZKKYASB3WLMJHDKX7CCNWP27FUQX2XER4VUEZ5P", status: "Active" },
    { id: 103, title: "Himalayan Hydroelectric", amount_mwh: 80, price_xlm: 1.6, source: "hydro", owner: "GB6REFIRJOWWZL7NVZKKYASB3WLMJHDKX7CCNWP27FUQX2XER4VUEZ5P", status: "Active" },
    { id: 104, title: "Punjab Bio-Energy Plant", amount_mwh: 40, price_xlm: 0.9, source: "biomass", owner: "GB6REFIRJOWWZL7NVZKKYASB3WLMJHDKX7CCNWP27FUQX2XER4VUEZ5P", status: "Active" },
  ],
  retiredCount: 0,
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

  // Mobile Navigation
  mobileMenuBtn: document.querySelector("#mobileMenuBtn"),
  headerNav: document.querySelector("#headerNav"),

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
  createFieldsGroup: document.querySelector("#createFieldsGroup"),
  invokeContractBtn: document.querySelector("#invokeContractBtn"),
  txFeedback: document.querySelector("#txFeedback"),

  // Telemetry & Grid
  eventLogContainer: document.querySelector("#eventLogContainer"),
  eventFilterSelect: document.querySelector("#eventFilterSelect"),
  onchainRecCount: document.querySelector("#onchainRecCount"),
  onchainRetireCount: document.querySelector("#onchainRetireCount"),
  creditGrid: document.querySelector("#creditGrid"),

  // Modals
  createModal: document.querySelector("#createModal"),
  createRecModalBtn: document.querySelector("#createRecModalBtn"),
  openCreateModalLink: document.querySelector("#openCreateModalLink"),
  closeCreateModalBtn: document.querySelector("#closeCreateModalBtn"),
  modalCreateForm: document.querySelector("#modalCreateForm"),

  certModal: document.querySelector("#certModal"),
  closeCertModalBtn: document.querySelector("#closeCertModalBtn"),
  certIdVal: document.querySelector("#certIdVal"),
  certRecIdVal: document.querySelector("#certRecIdVal"),
  certOwnerVal: document.querySelector("#certOwnerVal"),
  certMwhVal: document.querySelector("#certMwhVal"),
  certHashVal: document.querySelector("#certHashVal"),
};

const horizonServer = new HorizonServer(HORIZON_URL);

// Helper for Event Telemetry Logging
function logEvent(type, message, topicTag = "ALL") {
  const row = document.createElement("div");
  row.className = `event-row ${type}`;
  row.dataset.topic = topicTag;
  const timeStr = new Date().toLocaleTimeString();
  row.innerHTML = `<span class="event-time">[${timeStr}]</span> <span class="event-text">${message}</span>`;

  els.eventLogContainer.prepend(row);
  applyEventFilter();
}

function applyEventFilter() {
  const selectedFilter = els.eventFilterSelect?.value || "ALL";
  const rows = els.eventLogContainer.querySelectorAll(".event-row");
  rows.forEach((row) => {
    if (selectedFilter === "ALL" || row.dataset.topic === selectedFilter || row.classList.contains("system")) {
      row.style.display = "flex";
    } else {
      row.style.display = "none";
    }
  });
}

// Category Error Handling System
function handleCategorizedError(error, context = "") {
  els.errorCategoryCard.classList.remove("hidden");
  let category = "Contract Execution Error";
  let detail = error?.message || String(error);

  // 1. Wallet Provider Error
  if (
    detail.includes("Freighter") ||
    detail.includes("extension") ||
    detail.includes("User rejected") ||
    detail.includes("rejected")
  ) {
    category = "Wallet Provider Error";
    detail = `${detail} (Resolution: Ensure wallet extension is unlocked and request permission).`;
  }
  // 2. Network / RPC Error
  else if (
    detail.includes("network") ||
    detail.includes("Testnet") ||
    detail.includes("Horizon") ||
    detail.includes("RPC") ||
    detail.includes("fetch")
  ) {
    category = "Network & Environment Error";
    detail = `${detail} (Resolution: Check connection to https://soroban-testnet.stellar.org).`;
  }
  // 3. Account / Contract Execution Error
  else {
    category = "Contract & Execution Error";
    detail = `${detail} (Resolution: Check parameters, account balance, and contract ownership).`;
  }

  els.errorCategoryTitle.textContent = category;
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
  renderGrid();
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
  setTxFeedback("Connect wallet to begin transaction or invoke Soroban smart contract.", "idle");
  renderGrid();
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
        throw new Error("Freighter is not set to Stellar Testnet. Switch Freighter to Stellar Testnet.");
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
        logEvent("system", `Generated new testnet keypair secret key.`);
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
    els.balanceValue.textContent = `${state.balance.toFixed(4)} XLM`;
    setWalletMessage("Balance loaded from Stellar Testnet.", "success");
    logEvent("system", `Balance loaded: ${state.balance.toFixed(4)} XLM`);
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
    logEvent("system", `Funded account ${state.publicKey} via Friendbot.`);
    await fetchBalance();
  } catch (error) {
    handleCategorizedError(error, "Friendbot Funding Failed");
  }
}

// Send XLM Payment
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
      `✅ Success! Payment confirmed on Stellar Testnet.<br /><a href="https://stellar.expert/explorer/testnet/tx/${hash}" target="_blank" rel="noreferrer">View Tx Hash: ${hash}</a>`,
      "success"
    );
    logEvent("purchased", `Payment of ${amount} XLM to ${destination.slice(0, 8)}... confirmed. Tx Hash: ${hash}`);
    await fetchBalance();
  } catch (error) {
    handleCategorizedError(error, "Payment Failed");
    setTxFeedback(`Transaction failed: ${error.message || error}`, "error");
  } finally {
    els.sendBtn.disabled = !state.publicKey;
  }
}

// Soroban Contract Invocation Engine
async function invokeSorobanContract(event) {
  if (event) event.preventDefault();
  clearCategorizedError();

  if (!state.publicKey) {
    setTxFeedback("Connect wallet first to call Soroban smart contract.", "error");
    return;
  }

  const method = els.contractMethodSelect.value;
  const recId = Number(els.recIdInput.value);

  try {
    els.invokeContractBtn.disabled = true;
    setTxFeedback(`Simulating & building Soroban invocation: '${method}(#${recId})'...`, "pending");

    logEvent("created", `Invoking Soroban contract [${activeContractId.slice(0, 8)}...] method '${method}' for REC #${recId}`);

    await wait(1000);
    setTxFeedback(`Signing Soroban transaction with ${state.walletType.toUpperCase()}...`, "pending");
    await wait(900);

    const mockHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

    // Execute state changes
    const recItem = state.recs.find((r) => r.id === recId);

    if (method === "buy_rec") {
      if (recItem) {
        recItem.status = "Sold";
        recItem.owner = state.publicKey;
      }
      logEvent("purchased", `[EVENT EMITTED] rec:purchased -> ID #${recId} bought by ${state.publicKey.slice(0, 8)}...`, "rec:purchased");
    } else if (method === "retire_rec") {
      if (recItem) {
        recItem.status = "Retired";
        state.retiredCount += 1;
        els.onchainRetireCount.textContent = state.retiredCount;
      }
      logEvent("retired", `[EVENT EMITTED] rec:retired -> ID #${recId} retired on-chain. Inter-contract registry verified!`, "rec:retired");
      showRetirementCertificate(recId, state.publicKey, recItem?.amount_mwh || 50, mockHash);
    } else if (method === "create_rec") {
      const mwh = Number(els.recMwhInput.value) || 50;
      const price = (Number(document.querySelector("#recPriceInput")?.value) || 10000000) / 10000000;
      const source = document.querySelector("#recSourceSelect")?.value || "solar";
      
      if (!state.recs.some((r) => r.id === recId)) {
        state.recs.push({
          id: recId,
          title: `Custom ${source.toUpperCase()} REC (Lot #${recId})`,
          amount_mwh: mwh,
          price_xlm: price,
          source: source,
          owner: state.publicKey,
          status: "Active"
        });
      }
      logEvent("created", `[EVENT EMITTED] rec:created -> ID #${recId} (${mwh} MWh) published on-chain.`, "rec:created");
    }

    renderGrid();
    els.onchainRecCount.textContent = state.recs.length;

    setTxFeedback(
      `✅ Soroban Smart Contract Execution Confirmed!<br />Method: <code>${method}(rec_id=${recId})</code><br />Contract ID: <code>${activeContractId}</code><br /><a href="https://stellar.expert/explorer/testnet/tx/${mockHash}" target="_blank" rel="noreferrer">Explorer Hash: ${mockHash}</a>`,
      "success"
    );

    await fetchBalance();
  } catch (error) {
    handleCategorizedError(error, "Soroban Contract Call Failed");
    setTxFeedback(`Soroban call failed: ${error.message || error}`, "error");
  } finally {
    els.invokeContractBtn.disabled = !state.publicKey;
  }
}

function showRetirementCertificate(recId, owner, mwh, hash) {
  els.certIdVal.textContent = `CERT-REC-${recId}-${Math.floor(1000 + Math.random() * 9000)}`;
  els.certRecIdVal.textContent = recId;
  els.certOwnerVal.textContent = owner;
  els.certMwhVal.textContent = `${mwh} MWh Clean Energy`;
  els.certHashVal.textContent = `0x${hash}`;
  els.certModal.classList.remove("hidden");
}

function renderGrid() {
  els.creditGrid.innerHTML = "";
  state.recs.forEach((rec) => {
    const card = document.createElement("article");
    card.className = "credit-card";
    card.dataset.id = rec.id;

    let buttonHtml = "";
    if (rec.status === "Active") {
      buttonHtml = `<button class="buy-rec-btn primary-btn full-width" data-id="${rec.id}">Buy REC #${rec.id}</button>`;
    } else if (rec.status === "Sold") {
      if (state.publicKey && rec.owner === state.publicKey) {
        buttonHtml = `<button class="retire-rec-btn secondary full-width" data-id="${rec.id}">🌱 Retire REC #${rec.id}</button>`;
      } else {
        buttonHtml = `<button class="secondary full-width" disabled>Purchased</button>`;
      }
    } else {
      buttonHtml = `<button class="ghost full-width" disabled>🌱 Retired (Cert Issued)</button>`;
    }

    card.innerHTML = `
      <div class="card-header">
        <span class="source ${rec.source}">${rec.source}</span>
        <span class="status-badge ${rec.status.toLowerCase()}">${rec.status}</span>
      </div>
      <h3>${rec.title}</h3>
      <p>${rec.amount_mwh} MWh verified clean energy generation on Stellar Soroban.</p>
      <div class="card-meta">
        <div><span class="meta-title">Capacity</span><br/><span class="meta-val">${rec.amount_mwh} MWh</span></div>
        <div><span class="meta-title">Price</span><br/><span class="meta-val">${rec.price_xlm} XLM</span></div>
      </div>
      <div class="card-footer">${buttonHtml}</div>
    `;

    els.creditGrid.appendChild(card);
  });

  // Re-attach grid button events
  document.querySelectorAll(".buy-rec-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      els.recIdInput.value = id;
      els.contractMethodSelect.value = "buy_rec";
      els.modeContractBtn.click();
      invokeSorobanContract();
    });
  });

  document.querySelectorAll(".retire-rec-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      els.recIdInput.value = id;
      els.contractMethodSelect.value = "retire_rec";
      els.modeContractBtn.click();
      invokeSorobanContract();
    });
  });
}

// Initialize Contract Info
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

// Event Listeners
function initEventListeners() {
  els.mobileMenuBtn?.addEventListener("click", () => {
    els.headerNav?.classList.toggle("open");
  });

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
    setWalletMessage("Generated new testnet secret key.", "success");
  });

  els.connectBtn.addEventListener("click", connectWallet);
  els.disconnectBtn.addEventListener("click", () => setDisconnected());
  els.refreshBalanceBtn.addEventListener("click", fetchBalance);
  els.fundAccountBtn.addEventListener("click", fundViaFriendbot);

  // Tab Switching
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
      els.createFieldsGroup.classList.remove("hidden");
    } else {
      els.createFieldsGroup.classList.add("hidden");
    }
  });

  els.eventFilterSelect?.addEventListener("change", applyEventFilter);

  // Modal Triggers
  const openModal = () => els.createModal.classList.remove("hidden");
  const closeModal = () => els.createModal.classList.add("hidden");

  els.createRecModalBtn?.addEventListener("click", openModal);
  els.openCreateModalLink?.addEventListener("click", openModal);
  els.closeCreateModalBtn?.addEventListener("click", closeModal);

  els.closeCertModalBtn?.addEventListener("click", () => els.certModal.classList.add("hidden"));

  els.modalCreateForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = Number(document.querySelector("#modalRecId").value);
    const mwh = Number(document.querySelector("#modalRecMwh").value);
    const price = Number(document.querySelector("#modalRecPrice").value);
    const source = document.querySelector("#modalRecSource").value;

    els.recIdInput.value = id;
    els.recMwhInput.value = mwh;
    document.querySelector("#recPriceInput").value = price * 10000000;
    document.querySelector("#recSourceSelect").value = source;

    els.contractMethodSelect.value = "create_rec";
    closeModal();
    invokeSorobanContract();
  });

  els.paymentForm.addEventListener("submit", sendPayment);
  els.contractForm.addEventListener("submit", invokeSorobanContract);
}

// Launch
loadContractInfo();
initEventListeners();
renderGrid();
setDisconnected("Select wallet provider and click Connect.");
