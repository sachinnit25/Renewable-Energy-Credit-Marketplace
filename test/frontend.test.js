import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSellerReputation,
  categorizeError,
  defaultPriceStroops,
  formatContractEvent,
  formatEscrowStatus,
  formatXlmBalance,
  recSourceForId,
  validatePaymentInput,
} from "../lib/soroban-helpers.js";

test("formatXlmBalance formats native XLM correctly", () => {
  assert.equal(formatXlmBalance(10.5), "10.5000000 XLM");
  assert.equal(formatXlmBalance(0), "0.0000000 XLM");
  assert.equal(formatXlmBalance(null), "--");
});

test("categorizeError correctly sorts errors into 3 categories", () => {
  assert.equal(categorizeError("Freighter wallet extension was not detected"), "Wallet Provider Error");
  assert.equal(categorizeError("Connected to wrong network"), "Network / Environment Error");
  assert.equal(categorizeError("REC ID already exists in storage"), "Account & Contract Execution Error");
});

test("validatePaymentInput validates Stellar public keys and amounts", () => {
  const validKey = "GB6REFIRJOWWZL7NVZKKYASB3WLMJHDKX7CCNWP27FUQX2XER4VUEZ5P";
  assert.equal(validatePaymentInput(validKey, 1.5).valid, true);
  assert.equal(validatePaymentInput("INVALID_KEY", 1.5).valid, false);
  assert.equal(validatePaymentInput(validKey, -5).valid, false);
});

test("recSourceForId maps lot ids to Soroban symbol sources", () => {
  assert.equal(recSourceForId(101), "solar");
  assert.equal(recSourceForId(102), "wind");
  assert.equal(recSourceForId(999), "solar");
});

test("defaultPriceStroops returns stroop prices per lot", () => {
  assert.equal(defaultPriceStroops(101), 10_000_000);
  assert.equal(defaultPriceStroops(102), 14_000_000);
});

test("formatContractEvent renders Soroban RPC event payloads", () => {
  const text = formatContractEvent({
    topics: [{ symbol: "rec" }, { symbol: "created" }],
    ledger: 12345,
    txHash: "0210a89e51fec9233645ab5cbe9dac5ddcbeb3f38d99dad520bdddaea387ef81",
  });
  assert.match(text, /rec/);
  assert.match(text, /12345/);
});

test("calculateSellerReputation calculates percentage and star rating", () => {
  const rep = calculateSellerReputation(48, 50);
  assert.equal(rep.percent, 96);
  assert.equal(rep.stars, "4.8");
  assert.equal(rep.level, "Verified Top Seller");
});

test("formatEscrowStatus formats state label and badge", () => {
  const status = formatEscrowStatus("LOCKED");
  assert.equal(status.badge, "warning");
  assert.match(status.label, /Locked/);
});
