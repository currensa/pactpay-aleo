import { DecryptPermission, Transaction, WalletAdapterNetwork } from "@demox-labs/aleo-wallet-adapter-base";
import deploymentConfig from "../../config.json";
import type { BuiltTransaction } from "./aleo";

export type ShieldAccount = {
  address: string;
  walletName: string;
};

let connectedAddress: string | null = null;

export function setConnectedAddress(address: string | null) {
  connectedAddress = address;
}

export function getConnectedAddress() {
  return connectedAddress;
}

type WalletProvider = {
  request?: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  connect?: (...args: unknown[]) => Promise<unknown>;
  disconnect?: () => Promise<unknown>;
  executeTransaction?: (...args: unknown[]) => Promise<unknown>;
  executeDeployment?: (...args: unknown[]) => Promise<unknown>;
  requestTransaction?: (transaction: unknown) => Promise<unknown>;
  execute?: (...args: unknown[]) => Promise<unknown>;
  requestExecute?: (...args: unknown[]) => Promise<unknown>;
  requestRecords?: (program: string, includePlaintext?: boolean) => Promise<unknown[]>;
  requestAccounts?: () => Promise<unknown>;
  getAccounts?: () => Promise<unknown>;
  account?: string;
  accounts?: string[];
  publicKey?: string;
  _publicKey?: string;
  address?: string;
};

declare global {
  interface Window {
    shield?: WalletProvider;
    aleo?: WalletProvider;
    leoWallet?: WalletProvider;
  }
}

const providerCandidates = [
  { key: "shield", name: "Shield" },
  { key: "aleo", name: "Aleo wallet" },
  { key: "leoWallet", name: "Leo Wallet" }
] as const;

const payrollProgram = deploymentConfig.contracts.payrollPrivate.programId;
const mockTokenProgram = deploymentConfig.contracts.mockToken.programId;
const walletNetwork = walletNetworkFromConfig(deploymentConfig.network);
const connectPrograms = [payrollProgram, mockTokenProgram];
const walletExecutionTimeoutMs = 45_000;

// recordAccess config for wallets that accept it (Shield).
const recordAccessConfig = {
  level: "byProgram" as const,
  programs: [
    {
      program: payrollProgram,
      records: [{ recordname: "PayrollNote" }, { recordname: "DepositVault" }]
    }
  ]
};

const connectParams = [DecryptPermission.UponRequest, walletNetwork, connectPrograms] as const;
const legacyConnectParams = [deploymentConfig.network, DecryptPermission.UponRequest, connectPrograms] as const;
const connectParamsWithRecords = [DecryptPermission.UponRequest, walletNetwork, connectPrograms, recordAccessConfig] as const;

function walletNetworkFromConfig(network: string) {
  const normalized = network.toLowerCase();
  if (normalized.includes("mainnet")) return WalletAdapterNetwork.MainnetBeta;
  if (normalized.includes("beta")) return WalletAdapterNetwork.TestnetBeta;
  return WalletAdapterNetwork.Testnet;
}

function firstAddress(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string" && item.startsWith("aleo1")) ?? null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return firstAddress(record.address) ?? firstAddress(record.publicKey) ?? firstAddress(record.account) ?? firstAddress(record.accounts);
  }
  return null;
}

type WalletConnectResult = {
  address: string;
};

export type WalletExecutionResult = {
  walletName: string;
  transactionId: string | null;
  raw: unknown;
};

export type WalletCapabilityReport = {
  key: string;
  name: string;
  detected: boolean;
  ownKeys: string[];
  prototypeKeys: string[];
  functionKeys: string[];
  executionKeys: string[];
  signingKeys: string[];
  recordKeys: string[];
  accountKeys: string[];
  valueTypes: Record<string, string>;
  functionArities: Record<string, number>;
};

function accountFromResult(result: unknown): WalletConnectResult | null {
  const address = firstAddress(result);
  return address ? { address } : null;
}

function accountFromProvider(provider: WalletProvider): WalletConnectResult | null {
  return accountFromResult(provider.publicKey) ??
    accountFromResult(provider._publicKey) ??
    accountFromResult(provider.address) ??
    accountFromResult(provider.account) ??
    accountFromResult(provider.accounts) ??
    accountFromResult(provider);
}

function recordsFromResult(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    const records = (result as Record<string, unknown>).records;
    if (Array.isArray(records)) return records;
  }
  return [];
}

function firstTransactionId(value: unknown, seen = new WeakSet()): string | null {
  if (typeof value === "string") {
    return value.match(/\bat1[0-9a-z]+\b/i)?.[0] ?? null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstTransactionId(item, seen);
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === "object") {
    if (seen.has(value as object)) return null;
    seen.add(value as object);
    const record = value as Record<string, unknown>;
    for (const key of ["transactionId", "transaction_id", "txId", "tx_id", "id", "hash"]) {
      const found = firstTransactionId(record[key], seen);
      if (found) return found;
    }
  }

  return null;
}

function transactionRequest(tx: BuiltTransaction, address: string) {
  return {
    address,
    network: deploymentConfig.network,
    chainId: walletNetwork,
    endpoint: deploymentConfig.endpoint,
    program: tx.program,
    programId: tx.program,
    functionName: tx.transition,
    transition: tx.transition,
    inputs: tx.args,
    arguments: tx.args,
    imports: tx.imports,
    fee: Number(process.env.NEXT_PUBLIC_ALEO_FEE ?? 5_000_000),
    feePrivate: false
  };
}

function transitionPayload(request: ReturnType<typeof transactionRequest>) {
  return {
    program: request.programId,
    programId: request.programId,
    functionName: request.functionName,
    transition: request.functionName,
    inputs: request.inputs,
    arguments: request.inputs
  };
}

function walletTransactionPayloads(request: ReturnType<typeof transactionRequest>) {
  const transition = transitionPayload(request);

  return [
    {
      label: "adapter-transaction",
      payload: Transaction.createTransaction(
        request.address,
        request.chainId,
        request.programId,
        request.functionName,
        request.inputs,
        request.fee,
        request.feePrivate
      )
    },
    {
      label: "standard",
      payload: {
        address: request.address,
        chainId: request.chainId,
        transitions: [
          {
            program: request.programId,
            functionName: request.functionName,
            inputs: request.inputs
          }
        ],
        fee: request.fee,
        feePrivate: request.feePrivate
      }
    },
    {
      label: "standard-with-network",
      payload: {
        address: request.address,
        network: request.network,
        chainId: request.chainId,
        transitions: [transition],
        fee: request.fee,
        feePrivate: request.feePrivate
      }
    },
    {
      label: "transition-object",
      payload: {
        address: request.address,
        network: request.network,
        chainId: request.chainId,
        transition,
        fee: request.fee,
        feePrivate: request.feePrivate
      }
    },
    {
      label: "flat",
      payload: request
    }
  ];
}

async function tryWalletExecution(provider: WalletProvider, request: ReturnType<typeof transactionRequest>) {
  const errors: string[] = [];
  const transactionPayloads = walletTransactionPayloads(request);

  if (provider.executeTransaction) {
    for (const { label, payload } of transactionPayloads) {
      try {
        return await provider.executeTransaction(payload);
      } catch (cause) {
        errors.push(`executeTransaction(${label}): ${errorMessage(cause)}`);
      }
    }

    try {
      return await provider.executeTransaction(request.programId, request.functionName, request.inputs, request.fee, request.feePrivate);
    } catch (cause) {
      errors.push(`executeTransaction(positional): ${errorMessage(cause)}`);
    }

    // Provider exposes executeTransaction as its primary API — don't fall
    // through to unrelated method families (requestTransaction, execute, request).
    throw new Error(`Wallet rejected all executeTransaction attempts. ${errors.join(" | ")}`);
  }

  if (provider.requestTransaction) {
    for (const { label, payload } of transactionPayloads) {
      try {
        return await provider.requestTransaction(payload);
      } catch (cause) {
        errors.push(`requestTransaction(${label}): ${errorMessage(cause)}`);
      }
    }

    throw new Error(`Wallet rejected all requestTransaction attempts. ${errors.join(" | ")}`);
  }

  if (provider.requestExecute) {
    for (const { label, payload } of transactionPayloads) {
      try {
        return await provider.requestExecute(payload);
      } catch (cause) {
        errors.push(`requestExecute(${label}): ${errorMessage(cause)}`);
      }
    }

    throw new Error(`Wallet rejected all requestExecute attempts. ${errors.join(" | ")}`);
  }

  if (provider.execute) {
    for (const { label, payload } of transactionPayloads) {
      try {
        return await provider.execute(payload);
      } catch (cause) {
        errors.push(`execute(${label}): ${errorMessage(cause)}`);
      }
    }

    try {
      return await provider.execute(request.programId, request.functionName, request.inputs, request.fee);
    } catch (positionalCause) {
      errors.push(`execute(positional): ${errorMessage(positionalCause)}`);
    }

    throw new Error(`Wallet rejected all execute attempts. ${errors.join(" | ")}`);
  }

  if (!provider.request) {
    const suffix = errors.length ? ` ${errors.join(" | ")}` : "";
    throw new Error(`Wallet does not expose a transaction execution API.${suffix}`);
  }

  const attempts: Array<{ method: string; params: unknown[] | Record<string, unknown> }> = [
    ...transactionPayloads.flatMap(({ payload }) => [
      { method: "requestTransaction", params: [payload] },
      { method: "aleo_requestTransaction", params: [payload] },
      { method: "execute", params: [payload] },
      { method: "aleo_execute", params: [payload] },
      { method: "requestExecute", params: [payload] }
    ]),
    {
      method: "execute",
      params: [request.programId, request.functionName, request.inputs, request.fee]
    }
  ];

  for (const attempt of attempts) {
    try {
      return await provider.request(attempt);
    } catch (cause) {
      errors.push(`${attempt.method}: ${errorMessage(cause)}`);
    }
  }

  throw new Error(`Wallet rejected all known Aleo execution request formats. ${errors.join(" | ")}`);
}

async function tryShieldExecution(provider: WalletProvider, request: ReturnType<typeof transactionRequest>) {
  if (!provider.executeTransaction) {
    throw new Error("Shield does not expose executeTransaction.");
  }

  const payload = {
    program: request.programId,
    function: request.functionName,
    inputs: request.inputs,
    imports: request.imports,
    fee: request.fee,
    network: deploymentConfig.network,
    privateFee: request.feePrivate
  };

  return await withWalletTimeout(
    provider.executeTransaction(payload),
    `Shield did not return a transaction result after ${walletExecutionTimeoutMs / 1000} seconds.

If the Shield popup shows a rejection, the extension did not pass that error back to the page. The payload below is the exact transaction request sent by this app.

${JSON.stringify(payload, null, 2)}`
  );
}

async function withWalletTimeout<T>(operation: Promise<T>, timeoutMessage: string) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), walletExecutionTimeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function executeWithProvider(provider: WalletProvider, providerKey: string, request: ReturnType<typeof transactionRequest>) {
  if (providerKey === "shield") {
    return await tryShieldExecution(provider, request);
  }

  return await tryWalletExecution(provider, request);
}

function isUserRejection(cause: unknown) {
  if (!(cause instanceof Error)) return false;
  return cause.message.toLowerCase().includes("user rejected");
}

function errorMessage(cause: unknown) {
  if (cause instanceof Error) {
    return cause.stack && cause.stack.includes(cause.message) ? cause.stack : cause.message;
  }
  if (typeof cause === "string") return cause;
  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}

async function requestAccount(provider: WalletProvider, providerKey?: string) {
  let attemptedExplicitConnect = false;

  if (providerKey === "shield") {
    const existingAccount = accountFromProvider(provider);
    if (existingAccount) return existingAccount;
  }

  if (provider.connect) {
    attemptedExplicitConnect = true;

    if (providerKey === "shield") {
      try {
        const result = await provider.connect(
          deploymentConfig.network,
          DecryptPermission.UponRequest,
          connectPrograms,
          { recordAccess: recordAccessConfig }
        );
        const account = accountFromResult(result) ?? accountFromProvider(provider);
        if (account) return account;
      } catch (cause) {
        if (isUserVisibleConnectError(cause)) throw cause;
      }
    }

    if (providerKey === "shield") return accountFromProvider(provider);

    // 1. Standard adapter format: connect(decryptPermission, network, programs)
    //    This matches the @demox-labs adapter convention (3 positional args).
    if (providerKey !== "shield") {
      try {
        const result = await provider.connect(...connectParams);
        const account = accountFromResult(result) ?? accountFromProvider(provider);
        if (account) return account;
      } catch (cause) {
        if (isUserVisibleConnectError(cause)) throw cause;
      }
    }

    // 2. Legacy positional order: connect(network, decryptPermission, programs)
    //    Some older wallet versions swapped the first two args.
    if (providerKey !== "shield") {
      try {
        const result = await provider.connect(...legacyConnectParams);
        const account = accountFromResult(result) ?? accountFromProvider(provider);
        if (account) return account;
      } catch (cause) {
        if (isUserVisibleConnectError(cause)) throw cause;
      }
    }

    // 3. With recordAccess as 4th positional arg: connect(decryptPermission, network, programs, recordAccess)
    //    Shield and similar wallets that manage record access scoping accept this.
    if (providerKey !== "shield") {
      try {
        const result = await provider.connect(...connectParamsWithRecords);
        const account = accountFromResult(result) ?? accountFromProvider(provider);
        if (account) return account;
      } catch (cause) {
        if (isUserVisibleConnectError(cause)) throw cause;
      }
    }

    // 4. Single options object — some wallets accept a flat object.
    if (providerKey !== "shield") {
      try {
        const result = await provider.connect({
          decryptPermission: DecryptPermission.UponRequest,
          network: walletNetwork,
          programs: connectPrograms,
          recordAccess: recordAccessConfig
        });
        const account = accountFromResult(result) ?? accountFromProvider(provider);
        if (account) return account;
      } catch (cause) {
        if (isUserVisibleConnectError(cause)) throw cause;
      }
    }

    // 5. Options object with chainId variant.
    if (providerKey !== "shield") {
      try {
        const result = await provider.connect({
          decryptPermission: DecryptPermission.UponRequest,
          network: deploymentConfig.network,
          chainId: walletNetwork,
          programs: connectPrograms,
          recordAccess: recordAccessConfig
        });
        const account = accountFromResult(result) ?? accountFromProvider(provider);
        if (account) return account;
      } catch (cause) {
        if (isUserVisibleConnectError(cause)) throw cause;
      }
    }
  }

  if (provider.request) {
    if (providerKey === "shield") return accountFromProvider(provider);

    try {
      const result = await provider.request({ method: "connect", params: [...connectParams] });
      const account = accountFromResult(result);
      if (account) return account;
    } catch (cause) {
      if (isUserVisibleConnectError(cause)) throw cause;
    }

    try {
      const result = await provider.request({ method: "connect", params: [...legacyConnectParams] });
      const account = accountFromResult(result);
      if (account) return account;
    } catch (cause) {
      if (isUserVisibleConnectError(cause)) throw cause;
    }

    for (const method of ["requestAccounts", "aleo_requestAccounts"]) {
      try {
        const result = await provider.request({ method, params: [] });
        const account = accountFromResult(result);
        if (account) return account;
      } catch {
        // Try the next common provider method.
      }
    }

    attemptedExplicitConnect = true;
  }

  for (const method of [provider.requestAccounts, provider.getAccounts]) {
    if (!method) continue;
    const result = await method.call(provider);
    const account = accountFromResult(result);
    if (account) return account;
  }

  // Only inspect passive provider state when no explicit connect method was
  // available. If the provider exposes connect/request but all attempts failed
  // (and the user didn't explicitly reject), treat it as not connected rather
  // than returning stale state from a previous session.
  const providerAccount = accountFromProvider(provider);
  if (providerAccount) return providerAccount;

  if (attemptedExplicitConnect) return null;

  return providerAccount;
}

function isUserVisibleConnectError(cause: unknown) {
  if (!(cause instanceof Error)) return false;
  const message = cause.message.toLowerCase();
  return (
    message.includes("user rejected") ||
    message.includes("user cancelled") ||
    message.includes("user canceled") ||
    message.includes("user closed") ||
    message.includes("cancelled") ||
    message.includes("canceled") ||
    message.includes("window closed") ||
    message.includes("popup closed") ||
    message.includes("denied") ||
    message.includes("dismissed") ||
    message.includes("request rejected")
  );
}

export async function connectShieldWallet(): Promise<ShieldAccount> {
  if (typeof window === "undefined") {
    throw new Error("Shield login is only available in the browser.");
  }

  for (const candidate of providerCandidates) {
    const provider = window[candidate.key];
    if (!provider) continue;

    const account = await requestAccount(provider, candidate.key);
    if (account) {
      connectedAddress = account.address;
      return {
        address: account.address,
        walletName: candidate.name
      };
    }
  }

  throw new Error("Shield wallet was not detected. Install or unlock Shield, then try again.");
}

async function disconnectProvider(provider: WalletProvider) {
  if (provider.disconnect) {
    await provider.disconnect();
    return;
  }

  if (!provider.request) return;

  const attempts: Array<{ method: string; params: unknown[] | Record<string, unknown> }> = [
    { method: "disconnect", params: [] },
    { method: "aleo_disconnect", params: [] },
    { method: "wallet_disconnect", params: [] },
    { method: "revokePermissions", params: [] },
    { method: "wallet_revokePermissions", params: [{ permissions: ["account", "records"] }] }
  ];

  for (const attempt of attempts) {
    try {
      await provider.request(attempt);
      return;
    } catch {
      // Try the next provider-specific disconnect shape.
    }
  }
}

export async function disconnectShieldWallet() {
  if (typeof window === "undefined") return;

  connectedAddress = null;

  await Promise.allSettled(
    providerCandidates.map((candidate) => {
      const provider = window[candidate.key];
      return provider ? disconnectProvider(provider) : Promise.resolve();
    })
  );
}

export async function requestPayrollRecords() {
  if (typeof window === "undefined") {
    throw new Error("Shield records are only available in the browser.");
  }

  for (const candidate of providerCandidates) {
    const provider = window[candidate.key];
    if (!provider) continue;

    // If the wallet is already connected, try to fetch records without
    // re-invoking the full connect flow — avoids spurious popups on scan.
    if (connectedAddress) {
      if (provider.requestRecords) {
        try {
          return recordsFromResult(await provider.requestRecords(payrollProgram, true));
        } catch {
          // Fall through to re-authenticate below.
        }
      }

      if (provider.request) {
        try {
          const result = await provider.request({
            method: "requestRecords",
            params: [payrollProgram, true]
          });
          return recordsFromResult(result);
        } catch {
          // Fall through.
        }
      }
    }

    await requestAccount(provider, candidate.key);

    if (provider.requestRecords) {
      return recordsFromResult(await provider.requestRecords(payrollProgram, true));
    }

    if (provider.request) {
      const result = await provider.request({
        method: "requestRecords",
        params: [payrollProgram, true]
      });
      return recordsFromResult(result);
    }
  }

  throw new Error("Shield wallet was not detected. Install or unlock Shield, then try again.");
}

export async function requestPayrollNoteRecords() {
  return requestPayrollRecords();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function providerPrototypeKeys(provider: object) {
  const keys: string[] = [];
  let cursor = Object.getPrototypeOf(provider);
  let depth = 0;

  while (cursor && cursor !== Object.prototype && depth < 4) {
    keys.push(...Object.getOwnPropertyNames(cursor));
    cursor = Object.getPrototypeOf(cursor);
    depth += 1;
  }

  return uniqueSorted(keys.filter((key) => key !== "constructor"));
}

function valueType(provider: Record<string, unknown>, key: string) {
  try {
    return typeof provider[key];
  } catch {
    return "inaccessible";
  }
}

function keysMatching(keys: string[], patterns: RegExp[]) {
  return keys.filter((key) => patterns.some((pattern) => pattern.test(key)));
}

export function inspectWalletCapabilities(): WalletCapabilityReport[] {
  if (typeof window === "undefined") {
    return providerCandidates.map((candidate) => ({
      ...candidate,
      detected: false,
      ownKeys: [],
      prototypeKeys: [],
      functionKeys: [],
      executionKeys: [],
      signingKeys: [],
      recordKeys: [],
      accountKeys: [],
      valueTypes: {},
      functionArities: {}
    }));
  }

  return providerCandidates.map((candidate) => {
    const provider = window[candidate.key];
    if (!provider) {
      return {
        ...candidate,
        detected: false,
        ownKeys: [],
        prototypeKeys: [],
        functionKeys: [],
        executionKeys: [],
        signingKeys: [],
        recordKeys: [],
        accountKeys: [],
        valueTypes: {},
        functionArities: {}
      };
    }

    const ownKeys = uniqueSorted(Object.keys(provider));
    const prototypeKeys = providerPrototypeKeys(provider);
    const allKeys = uniqueSorted([...ownKeys, ...prototypeKeys]);
    const providerRecord = provider as Record<string, unknown>;
    const valueTypes = Object.fromEntries(allKeys.map((key) => [key, valueType(providerRecord, key)]));
    const functionKeys = allKeys.filter((key) => valueTypes[key] === "function");
    const functionArities = Object.fromEntries(
      functionKeys.map((key) => [key, (providerRecord[key] as (...args: unknown[]) => unknown).length])
    );

    return {
      ...candidate,
      detected: true,
      ownKeys,
      prototypeKeys,
      functionKeys,
      executionKeys: keysMatching(functionKeys, [/execute/i, /transaction/i, /submit/i, /broadcast/i, /deploy/i]),
      signingKeys: keysMatching(functionKeys, [/sign/i, /signature/i]),
      recordKeys: keysMatching(functionKeys, [/record/i, /decrypt/i]),
      accountKeys: keysMatching(functionKeys, [/connect/i, /account/i, /permission/i]),
      valueTypes,
      functionArities
    };
  });
}

export async function executeAleoTransaction(tx: BuiltTransaction): Promise<WalletExecutionResult> {
  if (typeof window === "undefined") {
    throw new Error("Wallet execution is only available in the browser.");
  }

  const errors: string[] = [];

  for (const candidate of providerCandidates) {
    const provider = window[candidate.key];
    if (!provider) continue;

    const account = await requestAccount(provider, candidate.key);
    if (!account) continue;

    const request = transactionRequest(tx, account.address);
    try {
      const raw = await executeWithProvider(provider, candidate.key, request);
      return {
        walletName: candidate.name,
        transactionId: firstTransactionId(raw),
        raw
      };
    } catch (cause) {
      if (isUserRejection(cause)) throw cause;
      errors.push(`${candidate.name}: ${errorMessage(cause)}`);
    }
  }

  throw new Error(errors.length ? errors.join(" | ") : "No connected Aleo wallet could execute this transaction. Confirm Shield supports dApp transaction execution.");
}
