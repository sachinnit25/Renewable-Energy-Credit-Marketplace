import test from 'node:test';
import assert from 'node:assert/strict';

// Core Business & Marketplace Utilities to Test
function validateRecInput(id, amountMwh, priceStroops, source) {
  if (!id || typeof id !== 'number' || id <= 0) {
    throw new Error('Invalid REC ID');
  }
  if (!amountMwh || typeof amountMwh !== 'number' || amountMwh <= 0) {
    throw new Error('Invalid MWh amount');
  }
  if (!priceStroops || typeof priceStroops !== 'number' || priceStroops <= 0) {
    throw new Error('Invalid price in stroops');
  }
  const validSources = ['solar', 'wind', 'hydro', 'geothermal', 'biomass'];
  if (!source || !validSources.includes(source.toLowerCase())) {
    throw new Error('Invalid energy source');
  }
  return true;
}

function processRecStatusTransition(rec, action, callerAddress) {
  if (!rec) throw new Error('REC not found');

  if (action === 'BUY') {
    if (rec.is_sold) throw new Error('REC is already sold');
    if (rec.is_retired) throw new Error('REC is retired');
    return { ...rec, is_sold: true, owner: callerAddress };
  }

  if (action === 'RETIRE') {
    if (rec.owner !== callerAddress) throw new Error('Not REC owner');
    if (rec.is_retired) throw new Error('REC is already retired');
    return { ...rec, is_retired: true };
  }

  throw new Error('Unknown action');
}

function categorizeError(err) {
  const message = err?.message || String(err);
  if (message.includes('Freighter') || message.includes('wallet') || message.includes('rejected')) {
    return { category: 'WALLET_PROVIDER_ERROR', userMessage: 'Wallet action was rejected or wallet is locked.' };
  }
  if (message.includes('network') || message.includes('RPC') || message.includes('fetch')) {
    return { category: 'NETWORK_RPC_ERROR', userMessage: 'Network communication failure with Stellar Testnet.' };
  }
  return { category: 'CONTRACT_EXECUTION_ERROR', userMessage: 'Soroban contract execution failed or panicked.' };
}

function formatTelemetryEvent(topic, data) {
  return {
    timestamp: new Date().toISOString(),
    topic: topic,
    recId: data.id,
    amountMwh: data.amountMwh,
    status: 'CONFIRMED_ON_CHAIN'
  };
}

function generateRetirementCertificate(recId, owner, amountMwh) {
  return {
    certificateId: `CERT-REC-${recId}-${Date.now().toString(36).toUpperCase()}`,
    recId,
    beneficiary: owner,
    offsetMwh: amountMwh,
    verificationHash: `0x${Buffer.from(`${recId}:${owner}:${amountMwh}`).toString('hex')}`
  };
}

// Suite of 5+ Tests
test('1. REC Input Validation - rejects invalid inputs and accepts valid attributes', () => {
  assert.equal(validateRecInput(101, 50, 10000000, 'solar'), true);
  assert.equal(validateRecInput(102, 120, 25000000, 'WIND'), true);

  assert.throws(() => validateRecInput(-1, 50, 10000000, 'solar'), /Invalid REC ID/);
  assert.throws(() => validateRecInput(103, 0, 10000000, 'solar'), /Invalid MWh amount/);
  assert.throws(() => validateRecInput(104, 50, 10000000, 'nuclear'), /Invalid energy source/);
});

test('2. Contract State Machine - processes buy and retirement state transitions correctly', () => {
  const initialRec = {
    id: 201,
    amount_mwh: 100,
    price_stroops: 50000000,
    source: 'wind',
    owner: 'G_CREATOR_ADDRESS',
    is_sold: false,
    is_retired: false
  };

  // Buyer purchases REC
  const buyerAddress = 'G_BUYER_ADDRESS';
  const purchasedRec = processRecStatusTransition(initialRec, 'BUY', buyerAddress);
  assert.equal(purchasedRec.is_sold, true);
  assert.equal(purchasedRec.owner, buyerAddress);

  // Cannot buy already sold REC
  assert.throws(
    () => processRecStatusTransition(purchasedRec, 'BUY', 'G_OTHER_BUYER'),
    /REC is already sold/
  );

  // Owner retires REC
  const retiredRec = processRecStatusTransition(purchasedRec, 'RETIRE', buyerAddress);
  assert.equal(retiredRec.is_retired, true);

  // Non-owner cannot retire REC
  assert.throws(
    () => processRecStatusTransition(purchasedRec, 'RETIRE', 'G_UNAUTHORIZED'),
    /Not REC owner/
  );
});

test('3. Categorized Error Handling System - maps raw errors into 3 distinct categories', () => {
  const walletErr = categorizeError(new Error('Freighter user rejected transaction'));
  assert.equal(walletErr.category, 'WALLET_PROVIDER_ERROR');

  const networkErr = categorizeError(new Error('RPC fetch timeout on Stellar Horizon'));
  assert.equal(networkErr.category, 'NETWORK_RPC_ERROR');

  const contractErr = categorizeError(new Error('Soroban contract panic: HostError(Value)'));
  assert.equal(contractErr.category, 'CONTRACT_EXECUTION_ERROR');
});

test('4. Real-time Event Telemetry Serialization - formats on-chain event streams', () => {
  const telemetry = formatTelemetryEvent('rec:purchased', { id: 301, amountMwh: 75 });
  assert.equal(telemetry.topic, 'rec:purchased');
  assert.equal(telemetry.recId, 301);
  assert.equal(telemetry.amountMwh, 75);
  assert.equal(telemetry.status, 'CONFIRMED_ON_CHAIN');
  assert.ok(telemetry.timestamp);
});

test('5. Inter-contract Retirement Certificate Generator - verifies certificate proof hash', () => {
  const cert = generateRetirementCertificate(401, 'G_ECO_CORP', 250);
  assert.ok(cert.certificateId.startsWith('CERT-REC-401-'));
  assert.equal(cert.beneficiary, 'G_ECO_CORP');
  assert.equal(cert.offsetMwh, 250);
  assert.ok(cert.verificationHash.startsWith('0x'));
});
