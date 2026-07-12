#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import process from "node:process";
import { AleoClient } from "./aleo-client.ts";
import { loadEnv, programPath, readConfig, redact, run, setPath, writeConfig } from "./common.ts";

function usage() {
  console.log(`Aleo helper

Network reads use the Aleo endpoint directly. Leo is used for account derivation,
record decryption, proving, signing, execution, and deployment.

Usage:
  npm run aleo -- env
  npm run aleo -- config
  npm run aleo -- config:set <path> <value>
  npm run aleo -- gen-account
  npm run aleo -- account [privateKey]
  npm run aleo -- random-field
  npm run aleo -- build <mock|payroll|all>
  npm run aleo -- test
  npm run aleo -- height
  npm run aleo -- latest-block
  npm run aleo -- block <heightOrHash>
  npm run aleo -- tx <transactionId>
  npm run aleo -- program <programId>
  npm run aleo -- mappings <programId>
  npm run aleo -- mapping <programId> <mapping> <key>
  npm run aleo -- balance <address>
  npm run aleo -- arc-balance <address> [tokenProgram]
  npm run aleo -- decrypt-record <ciphertext> [privateOrViewKey]
  npm run aleo -- execute <mock|payroll> <transition> [inputs...] [--broadcast]
  npm run aleo -- deploy <mock|payroll> [--broadcast]

Examples:
  npm run aleo -- height
  npm run aleo -- balance aleo1...
  npm run aleo -- arc-balance aleo1... mock_token.aleo
  npm run aleo -- mapping payroll_private_v2.aleo escrow_balances 0field
  npm run aleo -- execute payroll fund_credits_escrow 1000u64 123field
`);
}

function networkArgs() {
  return [
    "--network",
    process.env.ALEO_NETWORK || "testnet",
    "--endpoint",
    process.env.ALEO_ENDPOINT || "https://api.explorer.provable.com/v1"
  ];
}

function privateKeyArgs(required = false) {
  const privateKey = process.env.ALEO_PRIVATE_KEY;
  if (!privateKey) {
    if (required) {
      throw new Error("ALEO_PRIVATE_KEY must be set in .env or the shell.");
    }
    return [];
  }
  return ["--private-key", privateKey];
}

function priorityFeeArgs() {
  return ["--priority-fees", process.env.ALEO_PRIORITY_FEES || "0"];
}

function printJson(value: unknown) {
  if (typeof value === "string") {
    console.log(value);
  } else {
    console.log(JSON.stringify(value, null, 2));
  }
}

loadEnv();

const client = new AleoClient(
  process.env.ALEO_ENDPOINT || "https://api.explorer.provable.com/v1",
  process.env.ALEO_NETWORK || "testnet"
);
const [command, ...args] = process.argv.slice(2);

try {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage();
  } else if (command === "env") {
    printJson({
      network: process.env.ALEO_NETWORK,
      endpoint: process.env.ALEO_ENDPOINT,
      privateKey: redact(process.env.ALEO_PRIVATE_KEY),
      priorityFees: process.env.ALEO_PRIORITY_FEES,
      mockTokenProgram: process.env.MOCK_TOKEN_PROGRAM,
      payrollProgram: process.env.PAYROLL_PROGRAM
    });
  } else if (command === "config") {
    printJson(readConfig());
  } else if (command === "config:set") {
    const [dottedPath, value] = args;
    if (!dottedPath || value === undefined) {
      throw new Error("config:set requires <path> and <value>.");
    }
    const config = readConfig();
    setPath(config as unknown as Record<string, unknown>, dottedPath, value);
    config.updatedAt = new Date().toISOString();
    writeConfig(config);
    console.log(`Updated ${dottedPath}`);
  } else if (command === "gen-account") {
    run("leo", ["account", "new", ...networkArgs()]);
  } else if (command === "account") {
    const privateKey = args[0] ?? process.env.ALEO_PRIVATE_KEY;
    if (!privateKey) throw new Error("ALEO_PRIVATE_KEY must be set in .env or the shell.");
    run("leo", ["account", "import", privateKey, ...networkArgs()]);
  } else if (command === "random-field") {
    console.log(`0x${randomBytes(32).toString("hex")}field`);
  } else if (command === "build") {
    const target = args[0] ?? "all";
    const targets = target === "all" ? ["mock", "payroll"] : [target];
    for (const item of targets) {
      run("leo", ["build", "--path", programPath(item)]);
    }
  } else if (command === "test") {
    run("leo", ["test", "--path", "contracts/payroll_private"]);
  } else if (command === "height") {
    printJson(await client.latestHeight());
  } else if (command === "latest-block") {
    printJson(await client.latestBlock());
  } else if (command === "block") {
    const [heightOrHash] = args;
    if (!heightOrHash) throw new Error("block requires <heightOrHash>.");
    printJson(await client.block(heightOrHash));
  } else if (command === "tx") {
    const [transactionId] = args;
    if (!transactionId) throw new Error("tx requires <transactionId>.");
    printJson(await client.transaction(transactionId));
  } else if (command === "program") {
    const [programId] = args;
    if (!programId) throw new Error("program requires <programId>.");
    printJson(await client.program(programId));
  } else if (command === "mappings") {
    const [programId] = args;
    if (!programId) throw new Error("mappings requires <programId>.");
    printJson(await client.mappings(programId));
  } else if (command === "mapping") {
    const [programId, mappingName, key] = args;
    if (!programId || !mappingName || !key) {
      throw new Error("mapping requires <programId> <mapping> <key>.");
    }
    printJson(await client.mappingValue(programId, mappingName, key));
  } else if (command === "balance") {
    const [address] = args;
    if (!address) throw new Error("balance requires <address>.");
    printJson(await client.mappingValue("credits.aleo", "account", address));
  } else if (command === "arc-balance") {
    const [address, tokenProgram = process.env.MOCK_TOKEN_PROGRAM || "mock_token.aleo"] = args;
    if (!address) throw new Error("arc-balance requires <address> [tokenProgram].");
    printJson(await client.mappingValue(tokenProgram, "account", address));
  } else if (command === "decrypt-record") {
    const [ciphertext, key] = args;
    if (!ciphertext) throw new Error("decrypt-record requires <ciphertext> [privateOrViewKey].");
    const recordKey = key ?? process.env.ALEO_VIEW_KEY ?? process.env.ALEO_PRIVATE_KEY;
    if (!recordKey) throw new Error("Set ALEO_VIEW_KEY or ALEO_PRIVATE_KEY, or pass the key as the second argument.");
    run("leo", ["account", "decrypt", "--ciphertext", ciphertext, "-k", recordKey, ...networkArgs()]);
  } else if (command === "execute") {
    const [target, transition, ...rawInputs] = args;
    if (!target || !transition) {
      throw new Error("execute requires <mock|payroll> <transition> [inputs...] [--broadcast].");
    }
    const broadcast = rawInputs.includes("--broadcast");
    const inputs = rawInputs.filter((input) => input !== "--broadcast");
    run("leo", [
      "execute",
      transition,
      ...inputs,
      "--path",
      programPath(target),
      ...networkArgs(),
      ...privateKeyArgs(true),
      ...priorityFeeArgs(),
      "--yes",
      broadcast ? "--broadcast" : "--print"
    ]);
  } else if (command === "deploy") {
    const [target, maybeBroadcast] = args;
    if (!target) throw new Error("deploy requires <mock|payroll> [--broadcast].");
    const broadcast = maybeBroadcast === "--broadcast";
    run("leo", [
      "deploy",
      "--path",
      programPath(target),
      ...networkArgs(),
      ...privateKeyArgs(true),
      ...priorityFeeArgs(),
      "--yes",
      broadcast ? "--broadcast" : "--print"
    ]);
  } else {
    throw new Error(`Unknown command '${command}'.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
