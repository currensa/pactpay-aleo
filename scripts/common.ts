import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

export const root = process.cwd();
export const envPath = path.join(root, ".env");
export const configPath = path.join(root, "apps", "config.json");

export type AppConfig = {
  network: string;
  endpoint: string;
  contracts: Record<string, {
    programId: string;
    path: string;
    deployment: null | Record<string, unknown>;
  }>;
  updatedAt: string | null;
};

export function readEnvFile(filePath = envPath) {
  if (!existsSync(filePath)) return {};

  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        if (index === -1) return [line, ""];
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
        return [key, value];
      })
  );
}

export function loadEnv() {
  const fileEnv = readEnvFile();
  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return fileEnv;
}

export function readConfig(): AppConfig {
  return JSON.parse(readFileSync(configPath, "utf8")) as AppConfig;
}

export function writeConfig(config: AppConfig) {
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

export function redact(value: string | undefined) {
  if (!value) return "";
  if (value.length <= 12) return "***";
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export function run(command: string, args: string[], options: { capture?: boolean } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
  });

  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stderr || result.stdout);
    }
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }

  return result;
}

export function setPath(target: Record<string, unknown>, dottedPath: string, value: unknown) {
  const parts = dottedPath.split(".");
  let cursor: Record<string, unknown> = target;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts.at(-1) as string] = value;
}

export function programPath(name: string) {
  if (name === "mock") return "contracts/mock_token";
  if (name === "payroll") return "contracts/payroll_private";
  throw new Error(`Unknown program '${name}'. Use mock, payroll, or all.`);
}

export function findTransactionId(value: unknown): string | null {
  if (typeof value === "string") {
    const match = value.match(/\bat1[0-9a-z]+\b/i);
    return match?.[0] ?? null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTransactionId(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const found = findTransactionId(item);
      if (found) return found;
    }
  }
  return null;
}
