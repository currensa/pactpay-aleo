import "server-only";

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

type UserRow = {
  address: string;
  wallet_name: string;
  created_at: string;
  last_seen_at: string;
};

type SessionRow = {
  id: string;
  address: string;
  wallet_name: string;
  created_at: string;
  last_seen_at: string;
};

export type WalletUser = {
  address: string;
  walletName: string;
  createdAt: string;
  lastSeenAt: string;
};

const dbPath = process.env.PACTPAY_DB_PATH ?? path.join(process.cwd(), "data", "pactpay.sqlite");

let database: DatabaseSync | null = null;

function now() {
  return new Date().toISOString();
}

function openDatabase() {
  if (database) return database;

  const directory = path.dirname(dbPath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }

  database = new DatabaseSync(dbPath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      address TEXT PRIMARY KEY,
      wallet_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallet_sessions (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL REFERENCES users(address) ON DELETE CASCADE,
      wallet_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

  `);

  return database;
}

function toWalletUser(row: UserRow): WalletUser {
  return {
    address: row.address,
    walletName: row.wallet_name,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at
  };
}

export function upsertUser(address: string, walletName: string): WalletUser {
  const db = openDatabase();
  const timestamp = now();

  db.prepare(`
    INSERT INTO users (address, wallet_name, created_at, last_seen_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET
      wallet_name = excluded.wallet_name,
      last_seen_at = excluded.last_seen_at
  `).run(address, walletName, timestamp, timestamp);

  const row = db.prepare("SELECT * FROM users WHERE address = ?").get(address) as UserRow | undefined;
  if (!row) {
    throw new Error("Unable to load wallet user after login.");
  }

  return toWalletUser(row);
}

export function createWalletSession(address: string, walletName: string) {
  const db = openDatabase();
  const sessionId = crypto.randomUUID();
  const timestamp = now();

  db.prepare(`
    INSERT INTO wallet_sessions (id, address, wallet_name, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, address, walletName, timestamp, timestamp);

  return {
    id: sessionId,
    address,
    walletName,
    createdAt: timestamp,
    lastSeenAt: timestamp
  };
}

export function getWalletSession(sessionId: string) {
  const db = openDatabase();
  const row = db.prepare("SELECT * FROM wallet_sessions WHERE id = ?").get(sessionId) as SessionRow | undefined;
  if (!row) return null;

  db.prepare("UPDATE wallet_sessions SET last_seen_at = ? WHERE id = ?").run(now(), sessionId);
  const user = db.prepare("SELECT * FROM users WHERE address = ?").get(row.address) as UserRow | undefined;
  if (!user) return null;

  return toWalletUser(user);
}

export function listWalletUsers(): WalletUser[] {
  const db = openDatabase();
  const rows = db.prepare("SELECT * FROM users ORDER BY last_seen_at DESC").all() as UserRow[];
  return rows.map(toWalletUser);
}

export function deleteWalletSession(sessionId: string) {
  const db = openDatabase();
  db.prepare("DELETE FROM wallet_sessions WHERE id = ?").run(sessionId);
}
