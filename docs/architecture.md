# Architecture

## Actors

- Depositor: creates exactly funded private payroll batches.
- Receiver: receives a private payroll note and can withdraw partially.
- Program: verifies private credential accounting and maintains a public pooled escrow.

## Contract Shape

`payroll_private_v2.aleo` uses private records:

- `DepositVault`: private payroll authorization owned by the depositor and created only by an escrow funding transition.
- `PayrollNote`: private receiver allocation with token program and remaining balance.
- `WithdrawReceipt`: private receipt for a withdrawal.

Public escrow mappings:

- `escrow_balances`: remaining public pool balance by token program.
- `escrow_paid_totals`: public total paid out by token program.
- `escrow_recipient_paid_totals`: public total paid out by payout address.

There is no public payroll mapping and no refund transition in this version. Aleo record consumption prevents reusing the same private note.

Native Aleo credits are integrated through a dynamic interface to `credits.aleo`:

- `fund_credits_escrow(amount, nonce)` transfers public credits from `self.signer` into the payroll program account using `transfer_public_as_signer` and returns the private funded `DepositVault`.
- `withdraw_credits_from_escrow(note, amount, payout_to, ...)` transfers public credits from the payroll program account to `payout_to` using `transfer_public`.
- Private notes for native credits use `token_program = 'credits'`.

ARC-style public tokens are integrated through a dynamic interface:

- `fund_arc_escrow(token_program, amount, nonce)` transfers public tokens from `self.signer` into the payroll program account by calling `{token_program}.aleo/transfer_public_as_signer` and returns the private funded `DepositVault`.
- `withdraw_arc_from_escrow(note, amount, payout_to, ...)` transfers public tokens from the payroll program account to `payout_to` by calling `{note.token_program}.aleo/transfer_public`.
- `mock_token.aleo` has public `account` balances and public `mint_public`, `transfer_public`, and `transfer_public_as_signer` functions for local demos.
- Private notes for the mock ARC token demo use `token_program = 'mock_token'`; other ARC-compatible token programs can be used through the same interface.

## Business Rules

- Deposit must be exactly funded: `vault.amount == sum(amounts)`.
- A `DepositVault` is only created by the funding transition that also moves the real credits or ARC tokens into escrow.
- A vault and all notes created from it carry the same private token program.
- `deposit_16` always creates 16 notes.
- Unused receiver slots are padded with a valid address and `0u64` amount.
- Receiver withdrawals can be partial.
- A partial withdrawal consumes the old note and creates a new private note with the remaining amount.
- Escrow settlement consumes a private note and publicly decrements the pooled asset balance.
- Credits escrow settlement also moves real public microcredits through `credits.aleo`.
- ARC escrow settlement also moves public token balances through the caller-supplied ARC-compatible token program.

## Privacy Properties

- Receiver address and allocation amount are private record fields.
- The note's token program is private too, so the note does not expose whether it represents native credits, an ARC token, or a test token before withdrawal.
- Transition inputs are private by default in Leo; the settlement paths mark only token routing, amount, and payout fields as public.
- Public payroll mappings are avoided, so withdrawals do not update a public per-claim key.
- Partial withdrawal state remains private in the receiver's change note.
- Public escrow settlement reveals token type, payout amount, payout address, and timing.
- The transaction sender and fee payer can still leak metadata outside the private record contents.

## Asset Backing

`payroll_private_v2.aleo` intentionally keeps note authorization and public escrow settlement in the same program. A `PayrollNote` is verifiable because it is a record created by this program and later consumed by this same program; outsiders cannot forge one and pass verification.

The native credits path is backed by real public credits. The payroll program account holds the pooled public credits balance in `credits.aleo`, while `payroll_private_v2.aleo` keeps mirrored escrow accounting for visibility and checks.

The ARC path is backed by public balances in an ARC-compatible token program selected by the public `token_program` input. It uses the same dynamic transfer pattern as native credits. The included `mock_token.aleo` is a demo token rather than an audited standard implementation.

This is still the option-1 tradeoff: observers can see pooled token deposits and withdrawals, but the program does not expose which private deposit batch created the note used for a withdrawal.

## Fixed Batch Size

Aleo programs cannot dynamically output arbitrary-length records from a single transition. Leo 4.2 also limits entry outputs to 16, so the main batch transition uses fixed arrays of 16 slots:

- `receivers: [address; 16]`
- `amounts: [u64; 16]`
- `secrets: [field; 16]`
- `nonces: [field; 16]`

The transition returns 16 `PayrollNote` records. Payrolls with fewer than 16 real receivers are padded with a valid address and `0u64` amounts. Larger payrolls should be split into multiple `deposit_16` calls.

## Frontend

The frontend token selector switches between native credits and ARC-style tokens. The ARC path defaults to the demo `mock_token` program, and the token program is editable before building vault and escrow funding payloads.

## Demo Limits

The current frontend builds transaction payloads but does not yet submit them to a wallet or node. Leo tooling is also required to compile the program and confirm syntax against the installed compiler version.
