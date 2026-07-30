/**
 * Soroban RPC client helpers for contract simulation, invocation, and event polling.
 */

export function createSorobanClient(SDK, rpcUrl) {
  const RpcServer = SDK.rpc?.Server;
  if (!RpcServer) {
    throw new Error("Stellar SDK rpc.Server is unavailable.");
  }
  return new RpcServer(rpcUrl);
}

export function addressToScVal(SDK, publicKey) {
  return new SDK.Address(publicKey).toScVal();
}

export function symbolToScVal(SDK, name) {
  if (SDK.nativeToScVal) {
    return SDK.nativeToScVal(name, { type: "symbol" });
  }
  return SDK.xdr.ScVal.scvSymbol(SDK.xdr.ScSymbol.fromAscii(name));
}

export function buildContractCallOperation(SDK, contractId, method, scValArgs) {
  const Contract = SDK.Contract;
  const contract = new Contract(contractId);
  return contract.call(method, ...scValArgs);
}

export async function simulateContractCall({
  SDK,
  rpcServer,
  contractId,
  method,
  scValArgs,
  publicKey,
  networkPassphrase,
}) {
  const account = await rpcServer.getAccount(publicKey);
  const tx = new SDK.TransactionBuilder(account, {
    fee: SDK.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(buildContractCallOperation(SDK, contractId, method, scValArgs))
    .setTimeout(180)
    .build();

  const simulation = await rpcServer.simulateTransaction(tx);
  if (SDK.rpc?.Api?.isSimulationError?.(simulation)) {
    throw new Error(simulation.error || "Contract simulation failed.");
  }
  if (simulation.error) {
    throw new Error(simulation.error);
  }

  const retval = simulation.result?.retval ?? simulation.results?.[0]?.retval;
  return retval != null ? SDK.scValToNative(retval) : null;
}

export async function invokeContractCall({
  SDK,
  rpcServer,
  contractId,
  method,
  scValArgs,
  publicKey,
  networkPassphrase,
  signTransaction,
}) {
  const account = await rpcServer.getAccount(publicKey);
  let tx = new SDK.TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(buildContractCallOperation(SDK, contractId, method, scValArgs))
    .setTimeout(180)
    .build();

  tx = await rpcServer.prepareTransaction(tx);
  tx = await signTransaction(tx);

  const sendResult = await rpcServer.sendTransaction(tx);
  const hash = sendResult.hash;
  if (!hash) {
    throw new Error("Soroban RPC did not return a transaction hash.");
  }

  let status = sendResult.status;
  let attempts = 0;
  while ((status === "PENDING" || status === "TRY_AGAIN_LATER" || !status) && attempts < 30) {
    await new Promise((r) => setTimeout(r, 1000));
    const txResult = await rpcServer.getTransaction(hash);
    status = txResult.status;
    if (status === "SUCCESS") return { hash, result: txResult };
    if (status === "FAILED") {
      throw new Error(txResult.resultXdr || "Soroban transaction failed on-chain.");
    }
    attempts += 1;
  }

  if (status !== "SUCCESS") {
    throw new Error(`Transaction ${hash} did not confirm in time (status: ${status}).`);
  }

  return { hash };
}

export async function fetchContractEvents({ rpcServer, contractId, startLedger, limit = 20 }) {
  const latest = await rpcServer.getLatestLedger();
  const endLedger = latest.sequence;
  const fromLedger = Math.max(1, startLedger ?? endLedger - 17_280);

  const response = await rpcServer.getEvents({
    startLedger: fromLedger,
    endLedger,
    filters: [{ type: "contract", contractIds: [contractId] }],
    limit,
  });

  return {
    events: response.events || [],
    nextStartLedger: endLedger + 1,
  };
}
