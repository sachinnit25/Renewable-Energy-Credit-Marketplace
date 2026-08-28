/**
 * Pure helpers for Soroban contract argument encoding, Escrow lifecycle, and UI utilities.
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
  if (
    errorMessage.includes("unfunded") ||
    errorMessage.includes("balance") ||
    errorMessage.includes("transaction")
  ) {
    return "Account & Contract Execution Error";
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

/** Calculate seller reputation score percentage and star rating. */
export function calculateSellerReputation(successfulTrades, totalTrades) {
  if (!totalTrades || totalTrades <= 0) return { percent: 100, stars: 5.0, level: "Verified New Seller" };
  const percent = Math.min(100, Math.round((successfulTrades / totalTrades) * 100));
  const stars = ((percent / 100) * 5).toFixed(1);
  let level = "Verified Top Seller";
  if (percent < 90) level = "Good Seller";
  if (percent < 75) level = "Under Review";
  return { percent, stars, level };
}

/** Format Escrow status labels for visual stepper UI. */
export function formatEscrowStatus(status) {
  const map = {
    LISTED: { label: "1. Listed", badge: "info", icon: "📦" },
    OFFER_MADE: { label: "2. Offer Submitted", badge: "warning", icon: "🤝" },
    ACCEPTED: { label: "3. Seller Accepted", badge: "info", icon: "✓" },
    LOCKED: { label: "4. 💰 Payment Locked in Escrow", badge: "warning", icon: "🔒" },
    DELIVERED: { label: "5. Energy Delivered", badge: "info", icon: "🚚" },
    CONFIRMED: { label: "6. Buyer Confirmed", badge: "success", icon: "✅" },
    RELEASED: { label: "7. 💸 Payment Released to Seller", badge: "success", icon: "🎉" },
  };
  return map[status] || { label: status, badge: "muted", icon: "ℹ️" };
}
