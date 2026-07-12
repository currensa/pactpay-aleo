"use client";

import { useEffect, useState } from "react";
import { Receipt, Send } from "lucide-react";
import {
  buildEscrowWithdrawTx,
  payrollNoteTokenProgram,
  type BuiltTransaction
} from "@/lib/aleo";
import { ErrorDetails, errorText } from "./ErrorDetails";
import { PayrollNoteSelector, payrollNoteStorageKey } from "./PayrollNoteSelector";
import { TransactionPanel } from "./TransactionPanel";

type WalletAddressEvent = CustomEvent<{ address: string | null }>;

export function WithdrawPage() {
  const [withdrawRecord, setWithdrawRecord] = useState("");
  const [tokenProgram, setTokenProgram] = useState("");
  const [payoutTo, setPayoutTo] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("125u64");
  const [tx, setTx] = useState<BuiltTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(payrollNoteStorageKey);
    if (raw) selectPayrollNote(raw);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/wallet-login")
      .then((response) => response.json())
      .then((payload: { user?: { address?: string } | null }) => {
        if (cancelled || !payload.user?.address) return;
        setPayoutTo((current) => current || payload.user?.address || "");
      })
      .catch(() => null);

    function onWalletAddress(event: Event) {
      const address = (event as WalletAddressEvent).detail?.address;
      setPayoutTo(address ?? "");
    }

    window.addEventListener("pactpay:wallet-address", onWalletAddress);
    return () => {
      cancelled = true;
      window.removeEventListener("pactpay:wallet-address", onWalletAddress);
    };
  }, []);

  function submit(action: () => BuiltTransaction) {
    setError(null);
    try {
      setTx(action());
    } catch (cause) {
      setError(errorText(cause, "Unable to build transaction."));
    }
  }

  function selectPayrollNote(payload: string) {
    setWithdrawRecord(payload);
    try {
      setTokenProgram(payrollNoteTokenProgram(payload));
    } catch {
      setTokenProgram("");
    }
  }

  function clearSelectedNote() {
    setWithdrawRecord("");
    setTokenProgram("");
  }

  return (
    <>
      <div className="workspace pageGrid">
        <section className="panel wide">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Payroll note</span>
              <h2>Withdraw from escrow</h2>
            </div>
            <Receipt size={20} />
          </div>
          <PayrollNoteSelector selectedPayload={withdrawRecord} onSelect={selectPayrollNote} onClear={clearSelectedNote} />
          <div className="fieldGrid">
            <label>
              Token from PayrollNote
              <code>{tokenProgram ? `${tokenProgram}.aleo` : "Select a PayrollNote to detect its token."}</code>
            </label>
            <label>
              Amount
              <input value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} />
            </label>
            <label>
              Payout address
              <input
                placeholder="aleo1..."
                value={payoutTo}
                onChange={(event) => setPayoutTo(event.target.value)}
              />
            </label>
          </div>
          <button
            className="primary"
            type="button"
            disabled={!withdrawRecord}
            onClick={() =>
              submit(() => buildEscrowWithdrawTx(withdrawRecord, withdrawAmount, payoutTo))
            }
          >
            <Send size={18} />
            Build withdraw call
          </button>
        </section>

        <TransactionPanel tx={tx} />
      </div>

      <ErrorDetails message={error} onClose={() => setError(null)} />
    </>
  );
}
