#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { findTransactionId, loadEnv, readConfig, root, run, writeConfig } from "./common.ts";

type ContractTarget = {
  key: "mockToken" | "payrollPrivate";
  shortName: "mock" | "payroll";
  envKey: string;
  path: string;
};

const outputDir = path.join(root, "apps", "deployments");

const contracts: ContractTarget[] = [
  {
    key: "mockToken",
    shortName: "mock",
    envKey: "MOCK_TOKEN_PROGRAM",
    path: "contracts/mock_token"
  },
  {
    key: "payrollPrivate",
    shortName: "payroll",
    envKey: "PAYROLL_PROGRAM",
    path: "contracts/payroll_private"
  }
];

function readProgramId(contractPath: string) {
  const manifestPath = path.join(root, contractPath, "program.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { program?: string };
  if (!manifest.program) {
    throw new Error(`${manifestPath} does not define a program id.`);
  }
  return manifest.program;
}

function usage() {
  console.log(`Deploy PactPay Aleo programs

Default mode prints deployment transactions only.

Usage:
  npm run deploy:testnet -- [--broadcast] [--skip <mock|payroll>] [--only <mock|payroll>]

Examples:
  npm run deploy:testnet
  npm run deploy:testnet -- --broadcast
  npm run deploy:testnet -- --broadcast --only payroll
`);
}

loadEnv();

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  usage();
  process.exit(0);
}

const broadcast = argv.includes("--broadcast");
const skipIndex = argv.indexOf("--skip");
const skip = skipIndex === -1 ? null : argv[skipIndex + 1];
const onlyIndex = argv.indexOf("--only");
const only = onlyIndex === -1 ? null : argv[onlyIndex + 1];

const network = process.env.ALEO_NETWORK || "testnet";
const endpoint = process.env.ALEO_ENDPOINT || "https://api.explorer.provable.com/v1";
const privateKey = process.env.ALEO_PRIVATE_KEY;
const priorityFees = process.env.ALEO_PRIORITY_FEES || "0";

if (!privateKey) {
  console.error("ALEO_PRIVATE_KEY must be set in .env or the shell before deployment.");
  process.exit(1);
}

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const selected = contracts.filter((contract) => {
  if (only && contract.shortName !== only) return false;
  if (skip && contract.shortName === skip) return false;
  return true;
});

const config = readConfig();
config.network = network;
config.endpoint = endpoint;

for (const contract of selected) {
  const programId = readProgramId(contract.path);
  const expectedProgramId = process.env[contract.envKey];
  if (expectedProgramId && expectedProgramId !== programId) {
    console.warn(`${contract.envKey}=${expectedProgramId} does not match ${contract.path}/program.json (${programId}). Recording ${programId}.`);
  }
  const jsonOutput = path.join(outputDir, `${contract.key}-${Date.now()}.json`);
  const deployArgs = [
    "deploy",
    "--path",
    contract.path,
    "--network",
    network,
    "--endpoint",
    endpoint,
    "--private-key",
    privateKey,
    "--priority-fees",
    priorityFees,
    `--json-output=${jsonOutput}`,
    "--yes",
    broadcast ? "--broadcast" : "--print"
  ];

  console.log(`${broadcast ? "Deploying" : "Printing deploy transaction for"} ${programId}`);
  run("leo", ["build", "--path", contract.path]);
  const startedAt = new Date().toISOString();
  run("leo", deployArgs);

  let transactionId: string | null = null;
  if (existsSync(jsonOutput)) {
    try {
      transactionId = findTransactionId(JSON.parse(readFileSync(jsonOutput, "utf8")));
    } catch {
      transactionId = null;
    }
  }

  config.contracts[contract.key] = {
    ...(config.contracts[contract.key] ?? {}),
    programId,
    path: contract.path,
    deployment: {
      network,
      endpoint,
      broadcast,
      transactionId,
      jsonOutput: path.relative(root, jsonOutput),
      deployedAt: broadcast ? new Date().toISOString() : null,
      preparedAt: broadcast ? null : startedAt
    }
  };
}

config.updatedAt = new Date().toISOString();
writeConfig(config);

console.log("Updated apps/config.json");
if (!broadcast) {
  console.log("No deployment was broadcast. Re-run with --broadcast when ready.");
}
