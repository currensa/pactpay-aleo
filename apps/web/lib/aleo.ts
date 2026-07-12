import {
  MAX_BATCH_RECEIVERS,
  mockTokenTransitions,
  payrollTransitions,
  type ReceiverAllocation
} from "@pactpay/aleo-artifacts";
import deploymentConfig from "../../config.json";

export const appConfig = deploymentConfig;

export const programs = {
  payroll: deploymentConfig.contracts.payrollPrivate.programId,
  token: deploymentConfig.contracts.mockToken.programId
} as const;

export const networkConfig = {
  network: deploymentConfig.network,
  endpoint: deploymentConfig.endpoint
} as const;

export function programIdToIdentifier(programId: string): string {
  return `'${programId.replace(/\.aleo$/, "")}'`;
}

export const DEFAULT_ARC_TOKEN_IDENTIFIER = programIdToIdentifier(programs.token);
export const ALEO_ZERO_ADDRESS = "aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc";

export type BuiltTransaction = {
  program: string;
  transition: string;
  args: string[];
  imports?: string[];
};

type PayrollRecordName = "DepositVault" | "PayrollNote";

export function randomField(): string {
  // 31 bytes (248 bits) stays safely within the BLS12-377 scalar field modulus (~253 bits).
  // A full 32-byte (256-bit) random would exceed the modulus ~87% of the time and risk
  // rejection at proving time if the tooling does not auto-reduce.
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  const value = bytes.reduce((accumulator, byte) => (accumulator << 8n) + BigInt(byte), 0n);
  return `${value}field`;
}

function normalizeAmount(value: string, label = "amount"): string {
  const amount = value.trim();
  if (!/^[0-9]+(u64|u32|u128)?$/.test(amount)) {
    throw new Error(`Invalid ${label} "${value}". Must be a non-negative integer (e.g. "1000u64").`);
  }
  return amount;
}

function normalizeAddress(value: string, label = "address"): string {
  const address = value.trim();
  if (!/^aleo1[0-9a-z]+$/i.test(address)) {
    throw new Error(`Invalid ${label} "${value}". Must be a valid Aleo address.`);
  }
  return address;
}

function normalizeIdentifier(value: string, label = "identifier"): string {
  const identifier = value.trim();
  if (!/^'[a-zA-Z][a-zA-Z0-9_]*'$/.test(identifier)) {
    throw new Error(`Invalid ${label} "${value}". Must be a Leo identifier literal (e.g. "'mock_token'").`);
  }
  return identifier;
}

function identifierLiteralToProgramId(identifier: string): string {
  return `${identifier.slice(1, -1)}.aleo`;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecordPlaintext(value: string, recordName: PayrollRecordName) {
  const payload = value.toLowerCase();
  if (recordName === "DepositVault") {
    return payload.includes("owner") && payload.includes("token_program") && payload.includes("amount") && payload.includes("nonce") && !payload.includes("note_secret");
  }
  return payload.includes("owner") && payload.includes("token_program") && payload.includes("amount") && payload.includes("note_secret") && payload.includes("nonce");
}

function findRecordPlaintext(value: unknown, recordName: PayrollRecordName, seen = new WeakSet<object>()): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const parsed = parseJson(trimmed);
    if (parsed && parsed !== value) return findRecordPlaintext(parsed, recordName, seen);
    return isRecordPlaintext(trimmed, recordName) ? trimmed : null;
  }

  if (!value || typeof value !== "object") return null;
  if (seen.has(value)) return null;
  seen.add(value);

  const record = value as Record<string, unknown>;
  for (const key of ["plaintext", "plainText", "decrypted", "decryptedRecord", "recordPlaintext", "record_plaintext"]) {
    const found = findRecordPlaintext(record[key], recordName, seen);
    if (found) return found;
  }

  for (const nested of Object.values(record)) {
    const found = findRecordPlaintext(nested, recordName, seen);
    if (found) return found;
  }

  return null;
}

export function recordInput(value: string, recordName: PayrollRecordName) {
  const trimmed = value.trim();
  const found = findRecordPlaintext(trimmed, recordName);
  if (found) return found;
  throw new Error(`Selected ${recordName} is not a decrypted record plaintext. Scan Shield records again and select the decrypted ${recordName} record.`);
}

export function payrollNoteTokenProgram(value: string): string {
  const note = recordInput(value, "PayrollNote");
  const match = note.match(/(?:token_program|tokenProgram)\s*(?::|=)\s*(?:["']\s*)?'?([a-zA-Z][a-zA-Z0-9_]*)'?/);
  if (!match?.[1]) {
    throw new Error("Selected PayrollNote does not include a readable token program.");
  }
  return match[1];
}

export function buildFundCreditsEscrow(amount: string): BuiltTransaction {
  const normalizedAmount = normalizeAmount(amount);
  return {
    program: programs.payroll,
    transition: payrollTransitions.fundCreditsEscrow,
    args: [normalizedAmount, randomField()]
  };
}

export function buildFundArcEscrow(tokenProgram: string, amount: string): BuiltTransaction {
  const normalizedTokenProgram = normalizeIdentifier(tokenProgram, "token program");
  const normalizedAmount = normalizeAmount(amount);
  return {
    program: programs.payroll,
    transition: payrollTransitions.fundArcEscrow,
    args: [normalizedTokenProgram, normalizedAmount, randomField()],
    imports: [identifierLiteralToProgramId(normalizedTokenProgram)]
  };
}

export function buildMintMockArc(receiver: string, amount: string): BuiltTransaction {
  const normalizedReceiver = normalizeAddress(receiver, "mock holder");
  const normalizedAmount = normalizeAmount(amount);
  return {
    program: programs.token,
    transition: mockTokenTransitions.mintPublic,
    args: [normalizedReceiver, normalizedAmount]
  };
}

export function buildDepositTx(
  vaultRecord: string,
  allocations: ReceiverAllocation[],
  paddingReceiver?: string
): BuiltTransaction {
  if (!vaultRecord.trim()) {
    throw new Error("Select a DepositVault record first.");
  }

  const vaultRecordInput = recordInput(vaultRecord, "DepositVault");

  const activeAllocations = allocations.filter((allocation) => allocation.receiver.trim() || allocation.amount.trim());

  if (activeAllocations.length === 0) {
    throw new Error("At least one receiver is required.");
  }

  if (activeAllocations.some((allocation) => !allocation.receiver.trim() || !allocation.amount.trim())) {
    throw new Error("Every active receiver row needs both an address and an amount.");
  }

  const normalizedAllocations = activeAllocations.map((allocation) => ({
    receiver: normalizeAddress(allocation.receiver, "receiver address"),
    amount: normalizeAmount(allocation.amount)
  }));

  if (normalizedAllocations.length === 1) {
    const [allocation] = normalizedAllocations;
    return {
      program: programs.payroll,
      transition: payrollTransitions.depositOne,
      args: [
        vaultRecordInput,
        allocation.receiver,
        allocation.amount,
        randomField(),
        randomField()
      ]
    };
  }

  if (normalizedAllocations.length > MAX_BATCH_RECEIVERS) {
    throw new Error(`A single deposit supports up to ${MAX_BATCH_RECEIVERS} receivers.`);
  }

  const padAddress = paddingReceiver ? normalizeAddress(paddingReceiver, "padding receiver") : ALEO_ZERO_ADDRESS;

  const padded = [
    ...normalizedAllocations,
    ...Array.from({ length: MAX_BATCH_RECEIVERS - normalizedAllocations.length }, () => ({
      receiver: padAddress,
      amount: "0u64"
    }))
  ];

  return {
    program: programs.payroll,
    transition: payrollTransitions.deposit16,
    args: [
      vaultRecordInput,
      `[${padded.map((allocation) => allocation.receiver).join(", ")}]`,
      `[${padded.map((allocation) => allocation.amount).join(", ")}]`,
      `[${Array.from({ length: MAX_BATCH_RECEIVERS }, () => randomField()).join(", ")}]`,
      `[${Array.from({ length: MAX_BATCH_RECEIVERS }, () => randomField()).join(", ")}]`
    ]
  };
}

export function buildCreditsEscrowWithdrawTx(
  noteRecord: string,
  amount: string,
  payoutTo: string
): BuiltTransaction {
  if (!noteRecord.trim()) {
    throw new Error("Select a PayrollNote record first.");
  }

  const noteRecordInput = recordInput(noteRecord, "PayrollNote");
  const normalizedAmount = normalizeAmount(amount);
  const normalizedPayoutTo = normalizeAddress(payoutTo, "payout address");
  return {
    program: programs.payroll,
    transition: payrollTransitions.withdrawCreditsFromEscrow,
    args: [noteRecordInput, normalizedAmount, normalizedPayoutTo, randomField(), randomField(), randomField()]
  };
}

export function buildArcEscrowWithdrawTx(
  noteRecord: string,
  amount: string,
  payoutTo: string
): BuiltTransaction {
  if (!noteRecord.trim()) {
    throw new Error("Select a PayrollNote record first.");
  }

  const noteRecordInput = recordInput(noteRecord, "PayrollNote");
  const tokenProgram = payrollNoteTokenProgram(noteRecord);
  const normalizedAmount = normalizeAmount(amount);
  const normalizedPayoutTo = normalizeAddress(payoutTo, "payout address");
  return {
    program: programs.payroll,
    transition: payrollTransitions.withdrawArcFromEscrow,
    args: [noteRecordInput, normalizedAmount, normalizedPayoutTo, randomField(), randomField(), randomField()],
    imports: [`${tokenProgram}.aleo`]
  };
}

export function buildEscrowWithdrawTx(noteRecord: string, amount: string, payoutTo: string): BuiltTransaction {
  return payrollNoteTokenProgram(noteRecord) === "credits"
    ? buildCreditsEscrowWithdrawTx(noteRecord, amount, payoutTo)
    : buildArcEscrowWithdrawTx(noteRecord, amount, payoutTo);
}
