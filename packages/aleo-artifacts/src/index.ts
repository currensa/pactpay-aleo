export const programs = {
  payroll: "payroll_private_v2.aleo",
  token: "mock_token.aleo"
} as const;

export const payrollTransitions = {
  fundCreditsEscrow: "fund_credits_escrow",
  fundArcEscrow: "fund_arc_escrow",
  depositOne: "deposit_one",
  deposit16: "deposit_16",
  withdrawCreditsFromEscrow: "withdraw_credits_from_escrow",
  withdrawArcFromEscrow: "withdraw_arc_from_escrow"
} as const;

export const MAX_BATCH_RECEIVERS = 16;

export const mockTokenTransitions = {
  mintPublic: "mint_public",
  transferPublic: "transfer_public",
  transferPublicAsSigner: "transfer_public_as_signer",
  mintPrivate: "mint_private",
  splitPrivate: "split_private",
  transferPrivate: "transfer_private",
  burnToReceipt: "burn_to_receipt"
} as const;

export type ReceiverAllocation = {
  receiver: string;
  amount: string;
};
