"use client";

import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import type { BuiltTransaction } from "@/lib/aleo";
import { executeAleoTransaction } from "@/lib/shield";
import { ErrorDetails, errorText } from "./ErrorDetails";

type Props = {
  tx: BuiltTransaction | null;
};

export function TransactionPanel({ tx }: Props) {
  const [executing, setExecuting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setExecuting(false);
    setStatus("");
    setError(null);
  }, [tx]);

  async function executeTransaction() {
    if (!tx) return;

    setExecuting(true);
    setStatus("Opening wallet execution");
    setError(null);

    try {
      const execution = await executeAleoTransaction(tx);
      setStatus(execution.transactionId ? `Broadcasted ${execution.transactionId}` : `Submitted with ${execution.walletName}`);
    } catch (cause) {
      setStatus("Execution failed");
      setError(errorText(cause, "Unable to execute transaction."));
    } finally {
      setExecuting(false);
    }
  }

  if (!tx) return null;

  return (
    <section className="panel output">
      <div className="panelHeader">
        <div>
          <span className="eyebrow">Ready</span>
          <h2>Confirm transaction</h2>
        </div>
      </div>
      <button className="primary" type="button" disabled={!tx || executing} onClick={executeTransaction}>
        <Send size={18} />
        {executing ? "Executing" : "Execute on Aleo"}
      </button>
      {status ? <p className="inlineNotice">{status}</p> : null}
      <ErrorDetails message={error} onClose={() => setError(null)} />
    </section>
  );
}
