"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, ShieldCheck, Wallet } from "lucide-react";
import { connectShieldWallet, disconnectShieldWallet, setConnectedAddress, type ShieldAccount } from "@/lib/shield";

type StoredUser = {
  address: string;
  walletName: string;
};

type Props = {
  onAddressChange?: (address: string | null) => void;
};

const walletAddressEvent = "pactpay:wallet-address";

function notifyAddressChange(address: string | null) {
  window.dispatchEvent(new CustomEvent(walletAddressEvent, { detail: { address } }));
}

function shortAddress(address: string) {
  if (address.length <= 18) return address;
  return `${address.slice(0, 10)}...${address.slice(-6)}`;
}

export function WalletLogin({ onAddressChange }: Props) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [status, setStatus] = useState("Not connected");
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);
  const onAddressChangeRef = useRef(onAddressChange);
  onAddressChangeRef.current = onAddressChange;

  useEffect(() => {
    mountedRef.current = true;

    fetch("/api/wallet-login")
      .then((response) => response.json())
      .then((payload: { user: StoredUser | null }) => {
        if (!mountedRef.current) return;
        setUser(payload.user);
        setConnectedAddress(payload.user?.address ?? null);
        onAddressChangeRef.current?.(payload.user?.address ?? null);
        notifyAddressChange(payload.user?.address ?? null);
        setStatus(payload.user ? "Connected" : "Not connected");
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setStatus("Session unavailable");
      });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function persistLogin(account: ShieldAccount) {
    const response = await fetch("/api/wallet-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account)
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to store wallet login.");
    }

    return payload.user as StoredUser;
  }

  async function login() {
    setBusy(true);
    setStatus("Opening Shield");

    try {
      const account = await connectShieldWallet();
      if (!mountedRef.current) return;
      const nextUser = await persistLogin(account);
      if (!mountedRef.current) return;
      setUser(nextUser);
      onAddressChange?.(nextUser.address);
      notifyAddressChange(nextUser.address);
      setStatus("Connected");
    } catch (cause) {
      if (!mountedRef.current) return;
      setStatus(cause instanceof Error ? cause.message : "Unable to connect Shield.");
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setStatus("Disconnecting wallet");
    try {
      await disconnectShieldWallet();
      await fetch("/api/wallet-login", { method: "DELETE" }).catch(() => null);
      if (!mountedRef.current) return;
      setUser(null);
      onAddressChange?.(null);
      notifyAddressChange(null);
      setStatus("Disconnected. Connect again to choose an account.");
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  async function copyAddress() {
    if (!user) return;

    try {
      await navigator.clipboard.writeText(user.address);
      setStatus("Address copied");
      window.setTimeout(() => {
        if (mountedRef.current) setStatus("Connected");
      }, 1400);
    } catch {
      setStatus("Unable to copy address");
    }
  }

  return (
    <section className="walletBar" aria-label="Wallet login">
      <button
        className="walletIdentity"
        type="button"
        disabled={!user}
        title={user ? "Copy wallet address" : undefined}
        onClick={copyAddress}
      >
        <ShieldCheck size={20} />
        <div>
          <span>{user ? shortAddress(user.address) : "Shield wallet"}</span>
          <label>{user ? user.walletName : status}</label>
        </div>
      </button>
      <div className="walletActions">
        <span className="walletStatus">{status}</span>
        {user ? (
          <button className="iconButton" type="button" title="Log out" onClick={logout} disabled={busy}>
            <LogOut size={17} />
          </button>
        ) : (
          <button className="primary" type="button" onClick={login} disabled={busy}>
            <Wallet size={18} />
            Connect Shield
          </button>
        )}
      </div>
    </section>
  );
}
