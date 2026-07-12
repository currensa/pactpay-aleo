"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Search, Send, Trash2, Wallet } from "lucide-react";
import { MAX_BATCH_RECEIVERS } from "@pactpay/aleo-artifacts";
import {
  buildDepositTx,
  buildFundArcEscrow,
  buildFundCreditsEscrow,
  DEFAULT_ARC_TOKEN_IDENTIFIER,
  programs,
  type BuiltTransaction
} from "@/lib/aleo";
import { executeAleoTransaction } from "@/lib/shield";
import { ErrorDetails, errorText } from "./ErrorDetails";
import { depositVaultStorageKey, PayrollRecordSelector } from "./PayrollNoteSelector";
import { TransactionPanel } from "./TransactionPanel";

type AllocationRow = {
  id: string;
  receiver: string;
  amount: string;
};

type RegisteredReceiver = {
  address: string;
  walletName: string;
  lastSeenAt: string;
};

type TokenKind = "credits" | "mockArc";

const emptyRow = (): AllocationRow => ({
  id: crypto.randomUUID(),
  receiver: "",
  amount: ""
});

export function DepositPage() {
  const [vaultAmount, setVaultAmount] = useState("1000u64");
  const [tokenKind, setTokenKind] = useState<TokenKind>("credits");
  const [arcTokenProgram, setArcTokenProgram] = useState(DEFAULT_ARC_TOKEN_IDENTIFIER);
  const [vaultRecord, setVaultRecord] = useState("");
  const [rows, setRows] = useState<AllocationRow[]>([emptyRow()]);
  const [receivers, setReceivers] = useState<RegisteredReceiver[]>([]);
  const [receiverSearch, setReceiverSearch] = useState("");
  const [receiverStatus, setReceiverStatus] = useState("Loading platform receivers");
  const [tx, setTx] = useState<BuiltTransaction | null>(null);
  const [funding, setFunding] = useState(false);
  const [fundStatus, setFundStatus] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [depositStatus, setDepositStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => {
    return rows.reduce((sum, row) => sum + Number.parseFloat(row.amount.replace(/u\d+$/, "") || "0"), 0);
  }, [rows]);

  const selectedReceiverCount = rows.filter((row) => row.receiver).length;

  const availableReceivers = useMemo(() => {
    const query = receiverSearch.trim().toLowerCase();
    return receivers.filter((receiver) => {
      const selected = rows.some((row) => row.receiver === receiver.address);
      if (selected) return false;
      if (!query) return true;
      return receiver.address.toLowerCase().includes(query) || receiver.walletName.toLowerCase().includes(query);
    });
  }, [receiverSearch, receivers, rows]);

  useEffect(() => {
    const raw = sessionStorage.getItem(depositVaultStorageKey);
    if (raw) setVaultRecord(raw);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/users")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load platform receivers.");
        return Array.isArray(payload.users) ? payload.users : [];
      })
      .then((users: RegisteredReceiver[]) => {
        if (cancelled) return;
        setReceivers(users);
        setReceiverStatus(users.length ? `${users.length} registered receiver${users.length === 1 ? "" : "s"} available` : "No registered receivers yet");
      })
      .catch((cause) => {
        if (!cancelled) setReceiverStatus(cause instanceof Error ? cause.message : "Unable to load platform receivers.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function updateRow(id: string, patch: Partial<AllocationRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function addReceiver(address: string) {
    setRows((current) => {
      if (current.length >= MAX_BATCH_RECEIVERS || current.some((row) => row.receiver === address)) return current;
      const emptyIndex = current.findIndex((row) => !row.receiver && !row.amount);
      if (emptyIndex === -1) return [...current, { id: crypto.randomUUID(), receiver: address, amount: "" }];
      return current.map((row, index) => (index === emptyIndex ? { ...row, receiver: address } : row));
    });
    setReceiverSearch("");
  }

  async function fundVault() {
    setError(null);
    setFunding(true);
    setFundStatus("Opening wallet for vault funding");

    try {
      const fundTx = tokenKind === "credits"
        ? buildFundCreditsEscrow(vaultAmount)
        : buildFundArcEscrow(arcTokenProgram, vaultAmount);
      setTx(fundTx);
      const result = await executeAleoTransaction(fundTx);
      setFundStatus(result.transactionId ? `Funding broadcasted ${result.transactionId}` : `Funding submitted with ${result.walletName}`);
    } catch (cause) {
      setFundStatus("");
      setError(errorText(cause, "Unable to fund vault."));
    } finally {
      setFunding(false);
    }
  }

  function selectToken(next: TokenKind) {
    setTokenKind(next);
  }

  function clearSelectedVault() {
    setVaultRecord("");
  }

  function receiverName(address: string) {
    return receivers.find((receiver) => receiver.address === address)?.walletName ?? "Registered wallet";
  }

  async function onDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDepositing(true);
    setDepositStatus("Opening wallet for private note deposit");

    try {
      const depositTx = buildDepositTx(
        vaultRecord,
        rows.map((row) => ({ receiver: row.receiver, amount: row.amount }))
      );
      setTx(depositTx);
      const result = await executeAleoTransaction(depositTx);
      setDepositStatus(result.transactionId ? `Deposit broadcasted ${result.transactionId}` : `Deposit submitted with ${result.walletName}`);
    } catch (cause) {
      setDepositStatus("");
      setError(errorText(cause, "Unable to deposit private payroll notes."));
    } finally {
      setDepositing(false);
    }
  }

  return (
    <>
      <section className="summaryBand compact">
        <div>
          <span className="eyebrow">Deposit</span>
          <h1>Fund escrow and issue private payroll notes.</h1>
          <div className="deploymentLine">
            <span>{programs.payroll}</span>
            <span>{programs.token}</span>
          </div>
        </div>
        <div className="metrics">
          <div>
            <span>{selectedReceiverCount}</span>
            <label>Rows / 16</label>
          </div>
          <div>
            <span>{Number.isFinite(total) ? total : 0}</span>
            <label>Allocated</label>
          </div>
        </div>
      </section>

      <div className="workspace">
        <section className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Step 1</span>
              <h2>Fund private vault</h2>
            </div>
            <Wallet size={20} />
          </div>
          <div className="fieldGrid">
            <label>
              Token
              <select value={tokenKind} onChange={(event) => selectToken(event.target.value as TokenKind)}>
                <option value="credits">Native Aleo credits</option>
                <option value="mockArc">Mock ARC token</option>
              </select>
            </label>
            <label>
              Amount
              <input value={vaultAmount} onChange={(event) => setVaultAmount(event.target.value)} />
            </label>
            {tokenKind === "mockArc" ? (
              <label>
                ARC program
                <input value={arcTokenProgram} onChange={(event) => setArcTokenProgram(event.target.value)} />
              </label>
            ) : null}
          </div>
          <button
            className="primary"
            type="button"
            disabled={funding}
            onClick={fundVault}
          >
            <Wallet size={18} />
            {funding ? "Funding vault" : "Fund and create vault"}
          </button>
          {fundStatus ? <p className="inlineNotice">{fundStatus}</p> : null}
        </section>

        <form className="panel wide" onSubmit={onDeposit}>
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Step 2</span>
              <h2>Issue private notes</h2>
            </div>
          </div>
          <PayrollRecordSelector
            selectedPayload={vaultRecord}
            onSelect={setVaultRecord}
            onClear={clearSelectedVault}
            recordName="DepositVault"
            storageKey={depositVaultStorageKey}
            selectedLabel="DepositVault selected"
            emptyLabel="Select a DepositVault record"
            savedStatus="Selected vault saved for deposit"
          />
          <div className="receiverSection">
            <div className="sectionLabel">
              <span>Selected receivers ({selectedReceiverCount} / {MAX_BATCH_RECEIVERS})</span>
              <strong>{Number.isFinite(total) ? total : 0} total</strong>
            </div>
            {rows.filter((row) => row.receiver).length === 0 ? (
              <p className="mutedText">No receivers selected yet.</p>
            ) : (
              <div className="selectedReceiverList">
                {rows.filter((row) => row.receiver).map((row) => (
                  <div className="selectedReceiver" key={row.id}>
                    <div>
                      <strong>{receiverName(row.receiver)}</strong>
                      <code>{row.receiver}</code>
                    </div>
                    <input
                      aria-label={`Private amount for ${row.receiver}`}
                      placeholder="250u64"
                      value={row.amount}
                      onChange={(event) => updateRow(row.id, { amount: event.target.value })}
                    />
                    <button className="iconButton" title="Remove receiver" type="button" onClick={() => removeRow(row.id)}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="receiverSection">
            <div className="sectionLabel">
              <span>Registered users</span>
              <strong>{availableReceivers.length} available</strong>
            </div>
            <label className="searchField">
              <Search size={16} />
              <input
                placeholder="Search address or wallet"
                value={receiverSearch}
                onChange={(event) => setReceiverSearch(event.target.value)}
              />
            </label>
            <div className="registeredReceiverList">
              {availableReceivers.map((receiver) => (
                <div className="registeredReceiver" key={receiver.address}>
                  <div>
                    <strong>{receiver.walletName}</strong>
                    <code>{receiver.address}</code>
                  </div>
                  <button
                    className="primary secondary compactButton"
                    disabled={selectedReceiverCount >= MAX_BATCH_RECEIVERS}
                    type="button"
                    onClick={() => addReceiver(receiver.address)}
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
              ))}
              {!availableReceivers.length ? <p className="mutedText">{receivers.length ? "No matching registered users." : "No registered users found."}</p> : null}
            </div>
            <p className="inlineNotice">{receiverStatus}</p>
          </div>

          <button className="primary" type="submit" disabled={!vaultRecord || depositing}>
            <Send size={18} />
            {depositing ? "Depositing notes" : "Build deposit call"}
          </button>
          {depositStatus ? <p className="inlineNotice">{depositStatus}</p> : null}
        </form>

        <TransactionPanel tx={tx} />
      </div>

      <ErrorDetails message={error} onClose={() => setError(null)} />
    </>
  );
}
