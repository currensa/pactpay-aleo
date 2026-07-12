"use client";

import { useEffect, useState } from "react";
import { Banknote, Copy, Droplets, ExternalLink, Database, RefreshCw, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { buildMintMockArc, networkConfig, programs, type BuiltTransaction } from "@/lib/aleo";
import { executeAleoTransaction, inspectWalletCapabilities, type WalletCapabilityReport } from "@/lib/shield";
import { ErrorDetails, errorText } from "./ErrorDetails";
import { TransactionPanel } from "./TransactionPanel";

type StoredUser = {
  address: string;
  walletName: string;
  createdAt: string;
  lastSeenAt: string;
};

function shortAddress(address: string) {
  if (address.length <= 22) return address;
  return `${address.slice(0, 12)}...${address.slice(-8)}`;
}

export function AccountPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [capabilities, setCapabilities] = useState<WalletCapabilityReport[]>([]);
  const [copiedCapabilities, setCopiedCapabilities] = useState(false);
  const [faucetStatus, setFaucetStatus] = useState("");
  const [mintAmount, setMintAmount] = useState("1000u64");
  const [mockHolder, setMockHolder] = useState("");
  const [minting, setMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState("");
  const [mintTx, setMintTx] = useState<BuiltTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/wallet-login")
      .then((response) => response.json())
      .then((payload: { user: StoredUser | null }) => {
        if (!mounted) return;
        setUser(payload.user);
        setMockHolder((current) => current || payload.user?.address || "");
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    refreshCapabilities();
  }, []);

  function copyAddress() {
    if (!user) return;
    navigator.clipboard.writeText(user.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }

  function refreshCapabilities() {
    setCapabilities(inspectWalletCapabilities());
  }

  function copyCapabilities() {
    navigator.clipboard.writeText(JSON.stringify(capabilities, null, 2)).then(() => {
      setCopiedCapabilities(true);
      setTimeout(() => setCopiedCapabilities(false), 1400);
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
      <section className="summaryBand compact">
        <div>
          <span className="eyebrow">Account</span>
          <h1>Wallet session and deployed programs.</h1>
          <div className="deploymentLine">
            <span>{programs.payroll}</span>
            <span>{programs.token}</span>
          </div>
        </div>
      </section>

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
              <span className="eyebrow">Network</span>
              <h2>{networkConfig.network}</h2>
            </div>
            <ShieldCheck size={20} />
          </div>
          <div className="detailList">
            <div>
              <label>Endpoint</label>
              <code>{networkConfig.endpoint}</code>
            </div>
          </div>
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

        <section className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Local data</span>
              <h2>SQLite session store</h2>
            </div>
            <Database size={20} />
          </div>
          <p className="mutedText">The app stores wallet sessions and future payroll-note metadata locally. It does not store private keys or view keys.</p>
        </section>

        <section className="panel wide">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Wallet capability inspector</span>
              <h2>Injected Aleo providers</h2>
            </div>
            <WalletCards size={20} />
          </div>

          <div className="buttonRow">
            <button className="primary secondary" type="button" onClick={refreshCapabilities}>
              <RefreshCw size={16} />
              Refresh
            </button>
            <button className="primary secondary" type="button" disabled={!capabilities.length} onClick={copyCapabilities}>
              <Copy size={16} />
              Copy report
            </button>
            {copiedCapabilities ? <p className="inlineNotice">Capability report copied.</p> : null}
          </div>

          <div className="capabilityGrid">
            {capabilities.map((report) => (
              <article className="capabilityCard" key={report.key}>
                <div className="capabilityHeader">
                  <div>
                    <strong>{report.name}</strong>
                    <span>{report.key}</span>
                  </div>
                  <label className={report.detected ? "statusPill ok" : "statusPill"}>{report.detected ? "Detected" : "Missing"}</label>
                </div>

                {report.detected ? (
                  <div className="capabilitySections">
                    <CapabilityGroup title="Execution" values={report.executionKeys} />
                    <CapabilityGroup title="Signing" values={report.signingKeys} />
                    <CapabilityGroup title="Records" values={report.recordKeys} />
                    <CapabilityGroup title="Accounts" values={report.accountKeys} />
                    <CapabilityGroup title="All functions" values={report.functionKeys} />
                    <CapabilityGroup title="Own keys" values={report.ownKeys} />
                    <CapabilityGroup title="Prototype keys" values={report.prototypeKeys} />
                  </div>
                ) : (
                  <p className="mutedText">No provider object is available on <code>window.{report.key}</code>.</p>
                )}
              </article>
            ))}
          </div>
        </section>

        <TransactionPanel tx={mintTx} />
      </div>

      <ErrorDetails message={error} onClose={() => setError(null)} />
    </>
  );
}

function CapabilityGroup({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="capabilityGroup">
      <label>{title}</label>
      {values.length ? (
        <div className="methodList">
          {values.map((value) => (
            <code key={value}>{value}</code>
          ))}
        </div>
      ) : (
        <span>No matching methods</span>
      )}
    </div>
  );
}
