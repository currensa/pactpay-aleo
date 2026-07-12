import { NextResponse } from "next/server";
import { listWalletUsers } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ users: listWalletUsers() });
}
