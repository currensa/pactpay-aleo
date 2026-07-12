"use client";

import { Copy, FileCode2, Send } from "lucide-react";
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
  const [result, setResult] = useState<unknown>(null);
  const content = tx ? JSON.stringify(tx, null, 2) : "Build a request to preview transaction arguments.";

  useEffect(() => {
    setExecuting(false);
    setStatus("");
    setError(null);
    setResult(null);
  }, [tx]);

  async function executeTransaction() {
    if (!tx) return;

    setExecuting(true);
    setStatus("Opening wallet execution");
    setError(null);
    setResult(null);

    try {
      const execution = await executeAleoTransaction(tx);
      setResult(execution);
      setStatus(execution.transactionId ? `Broadcasted ${execution.transactionId}` : `Submitted with ${execution.walletName}`);
    } catch (cause) {
      setStatus("Execution failed");
      setError(errorText(cause, "Unable to execute transaction."));
    } finally {
      setExecuting(false);
    }
  }

  return (
    <section className="panel output">
      <div className="panelHeader">
        <div>
          <span className="eyebrow">Prepared call</span>
          <h2>Transaction payload</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {result ? (
            <button
              className="iconButton"
              title="Copy execution result"
              type="button"
              onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
            >
              <Copy size={18} />
            </button>
          ) : null}
          <button
            className="iconButton"
            title="Copy transaction payload"
            type="button"
            onClick={() => navigator.clipboard.writeText(content)}
          >
            <Copy size={18} />
          </button>
        </div>
      </div>
      <button className="primary" type="button" disabled={!tx || executing} onClick={executeTransaction}>
        <Send size={18} />
        {executing ? "Executing" : "Execute on Aleo"}
      </button>
      {status ? <p className="inlineNotice">{status}</p> : null}
      <pre>
        <FileCode2 size={18} />
        <code>{result ? JSON.stringify(result, null, 2) : content}</code>
      </pre>
      <ErrorDetails message={error} onClose={() => setError(null)} />
    </section>
  );
}
