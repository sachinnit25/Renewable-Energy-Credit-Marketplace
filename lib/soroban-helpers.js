/**
 * Pure helpers for Soroban contract argument encoding and UI utilities.
 * Imported by main.js (browser) and frontend tests (Node).
 */

export function formatXlmBalance(balance) {
  if (balance === null || balance === undefined || Number.isNaN(balance)) return "--";
  return `${Number(balance).toFixed(7)} XLM`;
}

export function categorizeError(errorMessage) {
  if (!errorMessage) return "Unknown Error";
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("Testnet") ||
    errorMessage.includes("RPC") ||
    errorMessage.includes("Horizon") ||
    errorMessage.includes("fetch")
  ) {
    return "Network / Environment Error";
  }
  if (
    errorMessage.includes("Freighter") ||
    errorMessage.includes("extension") ||
    errorMessage.includes("rejected") ||
    errorMessage.includes("User declined")
  ) {
    return "Wallet Provider Error";
  }
  return "Account & Contract Execution Error";
}

export function validatePaymentInput(destination, amount) {
  if (
    !destination ||
    typeof destination !== "string" ||
    !destination.startsWith("G") ||
    destination.length !== 56
  ) {
    return { valid: false, reason: "Invalid destination address" };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, reason: "Amount must be greater than zero" };
  }
  return { valid: true };
}

/** Map REC lot id to Soroban Symbol source tag. */
export function recSourceForId(recId) {
  const sources = {
    101: "solar",
    102: "wind",
    103: "hydro",
    104: "biomass",
  };
  return sources[Number(recId)] || "solar";
}

/** Default price in stroops (1 XLM = 10_000_000 stroops). */
export function defaultPriceStroops(recId) {
  const prices = { 101: 10_000_000, 102: 14_000_000, 103: 8_000_000, 104: 12_000_000 };
  return prices[Number(recId)] || 10_000_000;
}

export function formatContractEvent(event) {
  const topics = (event.topics || [])
    .map((t) => {
      if (typeof t === "string") return t;
      if (t?.symbol) return t.symbol;
      return JSON.stringify(t);
    })
    .join(":");
  const ledger = event.ledger != null ? `ledger ${event.ledger}` : "";
  const tx = event.txHash ? `tx ${event.txHash.slice(0, 12)}…` : "";
  return `[${topics || "event"}] ${ledger} ${tx}`.trim();
}
