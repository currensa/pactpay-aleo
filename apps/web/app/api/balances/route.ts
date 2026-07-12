import { NextRequest, NextResponse } from "next/server";
import deploymentConfig from "../../../../config.json";

export const runtime = "nodejs";

function isAleoAddress(value: string | null): value is string {
  return Boolean(value && /^aleo1[0-9a-z]+$/i.test(value));
}

async function mappingValue(program: string, mapping: string, address: string) {
  const endpoint = deploymentConfig.endpoint.replace(/\/+$/, "");
  const url = `${endpoint}/${deploymentConfig.network}/program/${encodeURIComponent(program)}/mapping/${encodeURIComponent(mapping)}/${encodeURIComponent(address)}`;
  const response = await fetch(url, { cache: "no-store" });

  // A missing mapping entry represents a zero balance.
  if (response.status === 404) return "0u64";
  if (!response.ok) throw new Error(`Balance service returned ${response.status}.`);

  const value = await response.text();
  try {
    return String(JSON.parse(value));
  } catch {
    return value;
  }
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!isAleoAddress(address)) {
    return NextResponse.json({ error: "A valid Aleo address is required." }, { status: 400 });
  }

  try {
    const [credits, mockToken] = await Promise.all([
      mappingValue("credits.aleo", "account", address),
      mappingValue(deploymentConfig.contracts.mockToken.programId, "account", address)
    ]);
    return NextResponse.json({ credits, mockToken });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "Unable to load balances.";
    return NextResponse.json({ error }, { status: 502 });
  }
}
