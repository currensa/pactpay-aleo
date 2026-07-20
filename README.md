# PactPay Aleo

Privacy-preserving payroll demo for Aleo with:

- Leo smart contracts for private payroll notes, native credits escrow, arbitrary ARC-style public token escrow, and a mock ARC-like token.
- Leo-native payroll contract tests.
- A NextJS frontend for Shield wallet login and building deposit and withdraw requests.

## Project Layout

```text
apps/web/                    NextJS frontend
contracts/payroll_private/   Private payroll Leo program
contracts/payroll_private/tests/
                             Leo-native payroll contract tests
contracts/mock_token/        Mock token Leo program used by the demo
packages/aleo-artifacts/     Shared program ids and ABI-style metadata
docs/                        Architecture notes
```

## Quick Start

```bash
npm install
npm test
npm run dev
```

The frontend stores wallet users and sessions in SQLite using Node's built-in `node:sqlite` module. By default the database is created at `apps/web/data/pactpay.sqlite` when the app runs from the web workspace. Set `PACTPAY_DB_PATH=/absolute/path/pactpay.sqlite` to override it.

Compile the contracts with:

```bash
leo build --path contracts/mock_token
leo build --path contracts/payroll_private
```

## Privacy Model

The payroll contract represents each receiver allocation as a private `PayrollNote` carrying a token program and amount. Escrow funding creates the private payroll vault record, and the batch deposit transition consumes that funded vault to create 16 private receiver notes, with zero-value padding notes for unused slots. Deposits must be exactly funded: the vault amount must equal the sum of all 16 slot amounts.

The main batch transition is `deposit_16`: it accepts fixed arrays of 16 receivers, amounts, note secrets, and note nonces. If a payroll has fewer than 16 receivers, the caller pads the remaining slots with a valid address and `0u64` amounts.

There is no refund path in this version. Receiver identity, token program, and allocation amount stay inside private records and private transition inputs. Partial withdrawals consume one private note and create a fresh private change note for the remaining balance. A withdrawal cannot be publicly tied back to the deposit batch that created the consumed note through a public mapping.

`payroll_private_v2.aleo` also includes a native credits escrow path:

- `fund_credits_escrow(public amount, nonce)` calls `credits.aleo/transfer_public_as_signer` to move public microcredits from the transaction signer into the payroll program account, then returns the private `DepositVault` for that funded amount.
- `withdraw_credits_from_escrow(note, public amount, public payout_to, ...)` consumes a private credits payroll note, creates a private change note, and calls `credits.aleo/transfer_public` to pay public microcredits from the payroll program account to `payout_to`.

`payroll_private_v2.aleo` also includes a generic ARC-style public token escrow path:

- `fund_arc_escrow(public token_program, public amount, nonce)` calls `{token_program}.aleo/transfer_public_as_signer` to move public ARC-style tokens into the payroll program account, then returns the private `DepositVault` for that funded token program and amount.
- `withdraw_arc_from_escrow(note, public amount, public payout_to, ...)` consumes a private ARC payroll note and calls `{note.token_program}.aleo/transfer_public` to pay public tokens to `payout_to`.
- `mock_token.aleo` exposes public ARC-like balances with `mint_public`, `transfer_public`, and `transfer_public_as_signer` for local demos.

ARC settlement accepts an arbitrary ARC-compatible public token program. This makes the demo economically meaningful without revealing a deposit id or batch id during withdrawal. The tradeoff is intentional: token type, escrow balances, payout amounts, and payout addresses are public settlement metadata.

This is a demo architecture. Production use should replace the mock ARC token with an audited ARC implementation, add stronger off-chain note delivery, view-key UX, and deployment scripts for the target Aleo network.

## UX Overview

After starting the web app, connect an unlocked Shield wallet from the wallet bar. The Account page shows the active address and provides links to testnet credits and demo ARC tokens.

Use **Deposit** to choose a token, fund escrow, and build a private payroll for up to 16 recipients. Each wallet transaction requires confirmation in Shield. Recipients can then open **Withdraw**, select one of their private payroll notes, enter an amount and public payout address, and build the withdrawal call. Partial withdrawals return the remaining balance as a new private note.

The interface is a demo transaction builder: review every request in the wallet before approving it, and use testnet or mock assets only.
