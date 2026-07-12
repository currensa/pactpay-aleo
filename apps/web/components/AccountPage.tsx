"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Copy, Droplets, ExternalLink, RefreshCw, UserRound } from "lucide-react";
import { buildMintMockArc, type BuiltTransaction } from "@/lib/aleo";
import { executeAleoTransaction } from "@/lib/shield";
import { ErrorDetails, errorText } from "./ErrorDetails";
import { TransactionPanel } from "./TransactionPanel";

type StoredUser = {
  address: string;
  walletName: string;
  createdAt: string;
  lastSeenAt: string;
};

type Balances = {
  credits: string;
  mockToken: string;
};

function shortAddress(address: string) {
  if (address.length <= 22) return address;
  return `${address.slice(0, 12)}...${address.slice(-8)}`;
}

function amountValue(value: string) {
  return value.replace(/u64$/i, "").trim();
}

function aleoValue(value: string) {
  try {
    const microcredits = BigInt(amountValue(value) || "0");
    const whole = microcredits / 1_000_000n;
    const fraction = (microcredits % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole.toString();
  } catch {
    return amountValue(value);
  }
}

export function AccountPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [faucetStatus, setFaucetStatus] = useState("");
  const [mintAmount, setMintAmount] = useState("1000u64");
  const [mockHolder, setMockHolder] = useState("");
  const [minting, setMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState("");
  const [mintTx, setMintTx] = useState<BuiltTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState("");

  const loadBalances = useCallback(async (address: string | null) => {
    if (!address) {
      setBalances(null);
      setBalancesError("");
      return;
    }

    setBalancesLoading(true);
    setBalancesError("");
    try {
      const response = await fetch(`/api/balances?address=${encodeURIComponent(address)}`, { cache: "no-store" });
      const payload = (await response.json()) as Balances & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load balances.");
      setBalances({ credits: payload.credits, mockToken: payload.mockToken });
    } catch (cause) {
      setBalances(null);
      setBalancesError(cause instanceof Error ? cause.message : "Unable to load balances.");
    } finally {
      setBalancesLoading(false);
    }
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch("/api/wallet-login");
      if (!response.ok) throw new Error("Unable to load wallet session.");
      const payload = (await response.json()) as { user: StoredUser | null };
      setUser(payload.user);
      setMockHolder((current) => current || payload.user?.address || "");
      void loadBalances(payload.user?.address ?? null);
    } catch {
      setUser(null);
      void loadBalances(null);
    } finally {
      setLoading(false);
    }
  }, [loadBalances]);

  useEffect(() => {
    void loadSession();

    function onWalletAddress() {
      void loadSession();
    }

    window.addEventListener("pactpay:wallet-address", onWalletAddress);
    return () => window.removeEventListener("pactpay:wallet-address", onWalletAddress);
  }, [loadSession]);

  function copyAddress() {
    if (!user) return;
    navigator.clipboard.writeText(user.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }

  async function openFaucet() {
    if (!user) return;

    try {
      await navigator.clipboard.writeText(user.address);
      setFaucetStatus("Address copied. Paste it into the Aleo Faucet.");
    } catch {
      setFaucetStatus("Open the faucet, then copy your wallet address from above.");
    }

    window.open("https://faucet.aleo.org/", "_blank", "noopener,noreferrer");
  }

  async function mintMockArc() {
    if (!user) return;

    setError(null);
    setMinting(true);
    setMintStatus("Opening wallet for mock ARC mint");

    try {
      const transaction = buildMintMockArc(mockHolder.trim() || user.address, mintAmount);
      setMintTx(transaction);
      const result = await executeAleoTransaction(transaction);
      setMintStatus(result.transactionId ? `Mint broadcasted ${result.transactionId}` : `Mint submitted with ${result.walletName}`);
    } catch (cause) {
      setMintStatus("");
      setError(errorText(cause, "Unable to mint mock ARC."));
    } finally {
      setMinting(false);
    }
  }

  return (
    <>
      <div className="workspace pageGrid">
        <section className="panel wide">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Connected wallet</span>
              <h2>{loading ? "Loading account" : user ? "Shield account" : "No active session"}</h2>
            </div>
            <UserRound size={20} />
          </div>

          {user ? (
            <div className="detailList">
              <div>
                <label>Address</label>
                <div className="copyLine">
                  <code>{shortAddress(user.address)}</code>
                  <button className="iconButton" type="button" title="Copy address" onClick={copyAddress}>
                    <Copy size={17} />
                  </button>
                </div>
              </div>
              <div>
                <label>Wallet</label>
                <strong>{user.walletName}</strong>
              </div>
              <div>
                <label>Last seen</label>
                <strong>{new Date(user.lastSeenAt).toLocaleString()}</strong>
              </div>
              {copied ? <p className="inlineNotice">Address copied.</p> : null}
            </div>
          ) : (
            <p className="mutedText">Connect Shield from the wallet bar to create a local session.</p>
          )}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Balances</span>
              <h2>Available funds</h2>
            </div>
            <button
              className="iconButton"
              type="button"
              title="Refresh balances"
              disabled={!user || balancesLoading}
              onClick={() => void loadBalances(user?.address ?? null)}
            >
              <RefreshCw size={17} />
            </button>
          </div>
          {user ? (
            balances ? (
              <div className="detailList">
                <div>
                  <label>ALEO</label>
                  <strong>{aleoValue(balances.credits)} ALEO</strong>
                </div>
                <div>
                  <label>mock_token</label>
                  <strong>{amountValue(balances.mockToken)} MOCK</strong>
                </div>
              </div>
            ) : (
              <p className="mutedText">{balancesLoading ? "Loading balances…" : balancesError || "Balances are unavailable."}</p>
            )
          ) : (
            <p className="mutedText">Connect a wallet to view balances.</p>
          )}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Testnet credits</span>
              <h2>Aleo Faucet</h2>
            </div>
            <Droplets size={20} />
          </div>
          <p className="mutedText">Request free testnet ALEO for wallet fees and payroll testing.</p>
          <div className="buttonRow">
            <button className="primary secondary" type="button" disabled={!user} onClick={openFaucet}>
              <ExternalLink size={16} />
              Open faucet
            </button>
          </div>
          <p className="inlineNotice">{faucetStatus || (user ? "Your address will be copied before the faucet opens." : "Connect a wallet to request testnet credits.")}</p>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Demo token</span>
              <h2>Mint mock ARC</h2>
            </div>
            <Banknote size={20} />
          </div>
          <p className="mutedText">Mint demo ARC tokens to an Aleo address for payroll testing.</p>
          <div className="fieldGrid">
            <label>
              Holder address
              <input placeholder="aleo1..." value={mockHolder} onChange={(event) => setMockHolder(event.target.value)} />
            </label>
            <label>
              Amount
              <input value={mintAmount} onChange={(event) => setMintAmount(event.target.value)} />
            </label>
          </div>
          <button className="primary" type="button" disabled={!user || minting} onClick={mintMockArc}>
            <Banknote size={18} />
            {minting ? "Minting mock ARC" : "Mint mock ARC"}
          </button>
          {mintStatus ? <p className="inlineNotice">{mintStatus}</p> : null}
        </section>

        <TransactionPanel tx={mintTx} />
      </div>

      <ErrorDetails message={error} onClose={() => setError(null)} />
    </>
  );
}
