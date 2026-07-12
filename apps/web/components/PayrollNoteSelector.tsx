"use client";

import { useEffect, useState } from "react";
import { Inbox, RefreshCw, Trash2 } from "lucide-react";
import { recordInput } from "@/lib/aleo";
import { requestPayrollRecords } from "@/lib/shield";

export const payrollNoteStorageKey = "pactpay_payroll_note";
export const depositVaultStorageKey = "pactpay_deposit_vault";

export type PayrollRecord = {
  id: string;
  label: string;
  payload: string;
  spent: boolean | null;
};

type Props = {
  selectedPayload: string;
  onSelect: (payload: string) => void;
  onClear: () => void;
};

type RecordSelectorProps = Props & {
  recordName: "PayrollNote" | "DepositVault";
  storageKey: string;
  selectedLabel: string;
  emptyLabel: string;
  savedStatus: string;
};

type RecordDetail = {
  label: string;
  value: string;
};

function recordPayload(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function executableRecordPayload(value: unknown, recordName: "PayrollNote" | "DepositVault") {
  const payload = recordPayload(value);
  try {
    return recordInput(payload, recordName);
  } catch {
    return payload;
  }
}

function recordLabel(value: unknown, index: number, fallbackName: string) {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const name = record.recordName ?? record.record_name ?? record.record ?? record.name;
    const commitment = record.commitment ?? record.id ?? record.commitmentId;
    if (typeof name === "string" && typeof commitment === "string") return `${name} ${commitment.slice(0, 12)}...`;
    if (typeof name === "string") return name;
    if (typeof commitment === "string") return `${fallbackName} ${commitment.slice(0, 12)}...`;
  }
  return `${fallbackName} ${index + 1}`;
}

function looksLikeRecord(value: unknown, recordName: string) {
  const payload = recordPayload(value).toLowerCase();
  if (recordName === "PayrollNote") {
    return payload.includes("payrollnote") || payload.includes("note_secret") || payload.includes("claimed");
  }
  return (
    payload.includes("depositvault") ||
    (payload.includes("token_program") && payload.includes("amount") && !payload.includes("note_secret"))
  );
}

function recordSpent(value: unknown, seen = new WeakSet<object>()): boolean | null {
  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    return parsed ? recordSpent(parsed, seen) : null;
  }

  if (!value || typeof value !== "object") return null;
  if (seen.has(value)) return null;
  seen.add(value);

  const record = value as Record<string, unknown>;
  for (const key of ["spent", "isSpent", "used", "isUsed"]) {
    if (typeof record[key] === "boolean") return record[key];
  }

  if (typeof record.status === "string") {
    const status = record.status.toLowerCase();
    if (["spent", "used", "consumed"].includes(status)) return true;
    if (["unspent", "unused", "available"].includes(status)) return false;
  }

  for (const nested of Object.values(record)) {
    const spent = recordSpent(nested, seen);
    if (spent !== null) return spent;
  }

  return null;
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function stringifyRecordValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

function findField(value: unknown, keys: string[], seen = new WeakSet<object>()): string | null {
  if (!value || typeof value !== "object") return null;
  if (seen.has(value)) return null;
  seen.add(value);

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return stringifyRecordValue(record[key]);
  }

  for (const nested of Object.values(record)) {
    const found = findField(nested, keys, seen);
    if (found) return found;
  }

  return null;
}

function matchField(payload: string, keys: string[]) {
  for (const key of keys) {
    const pattern = new RegExp(`${key}\\s*(?::|=)\\s*([^,}\\n]+)`, "i");
    const match = payload.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/^"|"$/g, "");
  }
  return null;
}

function recordDetails(payload: string, recordName: "PayrollNote" | "DepositVault"): RecordDetail[] {
  const parsed = tryParseJson(payload);
  const details: RecordDetail[] = [];

  function field(label: string, keys: string[]) {
    const value = findField(parsed, keys) ?? matchField(payload, keys);
    if (value) details.push({ label, value });
  }

  field("Owner", ["owner"]);
  field("Token", ["token_program", "tokenProgram"]);
  field("Amount", ["amount"]);

  if (recordName === "PayrollNote") {
    field("Secret", ["note_secret", "noteSecret"]);
  }

  field("Nonce", ["nonce"]);

  return details;
}

export function PayrollRecordSelector({
  selectedPayload,
  onSelect,
  onClear,
  recordName,
  storageKey,
  selectedLabel,
  emptyLabel,
  savedStatus
}: RecordSelectorProps) {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [status, setStatus] = useState(emptyLabel);
  const [scanning, setScanning] = useState(false);
  const selectedDetails = selectedPayload ? recordDetails(selectedPayload, recordName) : [];

  useEffect(() => {
    if (selectedPayload) setStatus(selectedLabel);
  }, [selectedLabel, selectedPayload]);

  async function scanRecords() {
    setScanning(true);
    setStatus("Opening Shield record access");
    try {
      const rawRecords = await requestPayrollRecords();
      const nextRecords = rawRecords
        .filter((record) => looksLikeRecord(record, recordName))
        .map((record, index) => ({
          id: `${index}-${recordLabel(record, index, recordName)}`,
          label: recordLabel(record, index, recordName),
          payload: executableRecordPayload(record, recordName),
          spent: recordSpent(record)
        }));

      setRecords(nextRecords);
      const spentCount = nextRecords.filter((record) => record.spent).length;
      const suffix = spentCount ? ` (${spentCount} used)` : "";
      setStatus(nextRecords.length ? `Found ${nextRecords.length} ${recordName} record${nextRecords.length === 1 ? "" : "s"}${suffix}` : `No ${recordName} records found`);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Unable to scan wallet records.");
    } finally {
      setScanning(false);
    }
  }

  function selectRecord(record: PayrollRecord) {
    sessionStorage.setItem(storageKey, record.payload);
    onSelect(record.payload);
    setStatus(savedStatus);
  }

  function clearSelection() {
    sessionStorage.removeItem(storageKey);
    onClear();
    setStatus("Selection cleared");
  }

  return (
    <>
      <button className="primary" type="button" onClick={scanRecords} disabled={scanning}>
        <RefreshCw size={18} />
        {scanning ? "Scanning records" : "Scan Shield records"}
      </button>

      {records.length ? (
        <div className="recordList">
          {records.map((record) => (
            <button className="recordItem" key={record.id} type="button" disabled={record.spent === true} onClick={() => selectRecord(record)}>
              <div className="capabilityHeader">
                <span>{record.label}</span>
                <span className={record.spent === true ? "statusPill" : record.spent === false ? "statusPill ok" : "statusPill"}>
                  {record.spent === true ? "Used" : record.spent === false ? "Unspent" : "Status unavailable"}
                </span>
              </div>
              <code>{record.payload.slice(0, 180)}{record.payload.length > 180 ? "..." : ""}</code>
            </button>
          ))}
        </div>
      ) : null}

      <div className="selectedRecord">
        <div>
          <Inbox size={18} />
          <span>{selectedPayload ? selectedLabel : emptyLabel}</span>
        </div>
        {selectedPayload ? (
          <button className="iconButton" type="button" title="Clear selected record" onClick={clearSelection}>
            <Trash2 size={17} />
          </button>
        ) : null}
      </div>

      {selectedPayload ? (
        selectedDetails.length ? (
          <dl className="recordDetails">
            {selectedDetails.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <code className="recordPreview">{selectedPayload.slice(0, 360)}{selectedPayload.length > 360 ? "..." : ""}</code>
        )
      ) : null}
      <p className="inlineNotice">{status}</p>
    </>
  );
}

export function PayrollNoteSelector(props: Props) {
  return (
    <PayrollRecordSelector
      {...props}
      recordName="PayrollNote"
      storageKey={payrollNoteStorageKey}
      selectedLabel="PayrollNote selected"
      emptyLabel="Select a PayrollNote record"
      savedStatus="Selected note saved for withdraw"
    />
  );
}
