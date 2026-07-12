import { NextRequest, NextResponse } from "next/server";
import { createWalletSession, deleteWalletSession, getWalletSession, upsertUser } from "@/lib/server/db";

export const runtime = "nodejs";

const sessionCookie = "pactpay_session";

function isAleoAddress(value: unknown): value is string {
  return typeof value === "string" && /^aleo1[0-9a-z]+$/i.test(value);
}

function normalizeWalletName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 48) : "Shield";
}

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(sessionCookie)?.value;
  if (!sessionId) {
    return NextResponse.json({ user: null });
  }

  const user = getWalletSession(sessionId);
  return NextResponse.json({ user });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const address = body?.address;

  if (!isAleoAddress(address)) {
    return NextResponse.json({ error: "A valid Aleo address is required." }, { status: 400 });
  }

  const walletName = normalizeWalletName(body?.walletName);
  const user = upsertUser(address, walletName);
  const session = createWalletSession(address, walletName);
  const response = NextResponse.json({ user });

  response.cookies.set(sessionCookie, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return response;
}

export async function DELETE(request: NextRequest) {
  const sessionId = request.cookies.get(sessionCookie)?.value;
  if (sessionId) {
    deleteWalletSession(sessionId);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });

  return response;
}
