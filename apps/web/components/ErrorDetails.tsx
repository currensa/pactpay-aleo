"use client";

import { AlertTriangle, Copy, X } from "lucide-react";

type Props = {
  message: string | null;
  onClose: () => void;
};

export function errorText(cause: unknown, fallback: string) {
  if (cause instanceof Error) {
    return cause.stack && cause.stack.includes(cause.message) ? cause.stack : cause.message;
  }

  if (typeof cause === "string") return cause;

  try {
    return JSON.stringify(cause, null, 2);
  } catch {
    return fallback;
  }
}

export function ErrorDetails({ message, onClose }: Props) {
  if (!message) return null;

  return (
    <div className="errorOverlay" role="alertdialog" aria-modal="true" aria-label="Transaction error">
      <section className="errorDialog">
        <div className="errorHeader">
          <div>
            <AlertTriangle size={18} />
            <h2>Transaction Error</h2>
          </div>
          <div className="errorActions">
            <button
              className="iconButton"
              type="button"
              title="Copy full error"
              onClick={() => navigator.clipboard.writeText(message)}
            >
              <Copy size={17} />
            </button>
            <button className="iconButton" type="button" title="Close error" onClick={onClose}>
              <X size={17} />
            </button>
          </div>
        </div>
        <pre className="errorBody">{message}</pre>
      </section>
    </div>
  );
}
