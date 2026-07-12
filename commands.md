# Commands for Aleo

## Compile

```bash
  cargo install leo-lang leo-fmt leo-lsp
  leo --version
  leo build --path contracts/payroll_private
  leo build --path contracts/mock_token
  npm test
  npm run build
```

`npm test` runs the Leo-native payroll tests in `contracts/payroll_private/tests`.

## Helper

```bash
  npm run aleo -- env
  npm run aleo -- config
  npm run aleo -- gen-account
  npm run aleo -- account
  npm run aleo -- random-field
  npm run aleo -- build all
  npm run aleo -- height
  npm run aleo -- latest-block
  npm run aleo -- block 17820516
  npm run aleo -- tx at1...
  npm run aleo -- program credits.aleo
  npm run aleo -- mappings credits.aleo
  npm run aleo -- mapping credits.aleo account aleo1...
  npm run aleo -- balance aleo1...
  npm run aleo -- arc-balance aleo1... mock_token.aleo
  npm run aleo -- decrypt-record record1...
  npm run aleo -- execute payroll fund_credits_escrow 1000u64 123field
```

The helper reads `.env` and `apps/config.json`. Read-only network commands use direct HTTP requests to `ALEO_ENDPOINT`; local cryptographic operations, proving, signing, execution, and deployment use `leo`.

## Deploy

Deployment settings are read from `.env`:

```bash
  ALEO_NETWORK=testnet
  ALEO_ENDPOINT=https://api.explorer.provable.com/v1
  ALEO_PRIVATE_KEY=
  ALEO_PRIORITY_FEES=0
```

Prepare deployment transactions without broadcasting:

```bash
  npm run deploy:testnet
```

Broadcast when ready:

```bash
  npm run deploy:testnet -- --broadcast
```

The script records successful deployment metadata in `apps/config.json`.

## Native Credits Calls

`payroll_private_v2.aleo` uses dynamic calls into `credits.aleo`:

- `fund_credits_escrow(amount, nonce)` transfers public credits from the signer into the payroll program account and returns the private funded vault record.
- `withdraw_credits_from_escrow(note, amount, payout_to, ...)` transfers public credits from the payroll program account to the payout address.

## ARC Token Calls

`mock_token.aleo` is the demo ARC-like token:

- `mint_public(receiver, amount)` mints public mock-token balance for testing.
- `transfer_public(receiver, amount)` transfers public mock tokens from `self.caller`.
- `transfer_public_as_signer(receiver, amount)` transfers public mock tokens from `self.signer`.

`payroll_private_v2.aleo` can use dynamic calls into any ARC-compatible public token program exposing the same transfer functions:

- `fund_arc_escrow(token_program, amount, nonce)` transfers public tokens from the signer into the payroll program account and returns the private funded vault record.
- `withdraw_arc_from_escrow(note, amount, payout_to, ...)` transfers public tokens from the payroll program account to the payout address. The token program is read from `note.token_program`.

For the included mock token demo, use `token_program = 'mock_token'`.

### Mint

```bash
    npm run aleo -- execute mock mint_public aleo17c69phd8lzdtzc8tscew6l7eamunv57lmwa5jst7zshhzscufqgswrnvvx 10000u64 --broadcast
```

## Run Node

  If you mean “which snarkOS version should I run for mainnet,” follow the official mainnet branch:

```bash
  git clone --branch mainnet --single-branch https://github.com/ProvableHQ/snarkOS.git
```
