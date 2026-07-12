interface Credits {
    fn transfer_public(public receiver: address, public amount: u64) -> Final;
    fn transfer_public_as_signer(public receiver: address, public amount: u64) -> Final;
}

interface ArcToken {
    fn transfer_public(public receiver: address, public amount: u64) -> Final;
    fn transfer_public_as_signer(public receiver: address, public amount: u64) -> Final;
}

program payroll_private_v2.aleo {
    // Function inputs are intentionally left unqualified: in Leo they are private
    // by default. Add `public` only when a value must be visible in program state.

    mapping escrow_balances: identifier => u64;
    mapping escrow_paid_totals: identifier => u64;
    mapping escrow_recipient_paid_totals: address => u64;

    record DepositVault {
        owner: address,
        token_program: identifier,
        amount: u64,
        nonce: field,
    }

    record PayrollNote {
        owner: address,
        token_program: identifier,
        amount: u64,
        note_secret: field,
        nonce: field,
    }

    record WithdrawReceipt {
        owner: address,
        amount: u64,
        nonce: field,
    }

    @noupgrade
    constructor() {}

    fn fund_credits_escrow(
        public amount: u64,
        nonce: field,
    ) -> (DepositVault, Final) {
        assert(amount > 0u64);

        let payment: Final = Credits@('credits', 'aleo')::transfer_public_as_signer(_self_address(), amount);
        let vault: DepositVault = DepositVault {
            owner: self.signer,
            token_program: 'credits',
            amount,
            nonce,
        };

        let settlement: Final = final {
            let current: u64 = Mapping::get_or_use(escrow_balances, 'credits', 0u64);
            Mapping::set(escrow_balances, 'credits', current + amount);

            _final_run(payment);
        };

        return (vault, settlement);
    }

    fn fund_arc_escrow(
        public token_program: identifier,
        public amount: u64,
        nonce: field,
    ) -> (DepositVault, Final) {
        assert(amount > 0u64);

        let payment: Final = ArcToken@(token_program, 'aleo')::transfer_public_as_signer(_self_address(), amount);
        let vault: DepositVault = DepositVault {
            owner: self.signer,
            token_program,
            amount,
            nonce,
        };

        let settlement: Final = final {
            let current: u64 = Mapping::get_or_use(escrow_balances, token_program, 0u64);
            Mapping::set(escrow_balances, token_program, current + amount);

            _final_run(payment);
        };

        return (vault, settlement);
    }

    fn deposit_one(
        vault: DepositVault,
        receiver: address,
        receiver_amount: u64,
        receiver_secret: field,
        receiver_nonce: field,
    ) -> PayrollNote {
        assert_eq(vault.amount, receiver_amount);

        return PayrollNote {
            owner: receiver,
            token_program: vault.token_program,
            amount: receiver_amount,
            note_secret: receiver_secret,
            nonce: receiver_nonce,
        };
    }

    // Fixed-width one-to-16 private deposit. Callers pad unused slots with a valid
    // address and 0u64 amount. The vault must exactly equal the sum of all amounts.
    fn deposit_16(
        vault: DepositVault,
        receivers: [address; 16],
        amounts: [u64; 16],
        secrets: [field; 16],
        nonces: [field; 16],
    ) -> (
        PayrollNote, PayrollNote, PayrollNote, PayrollNote,
        PayrollNote, PayrollNote, PayrollNote, PayrollNote,
        PayrollNote, PayrollNote, PayrollNote, PayrollNote,
        PayrollNote, PayrollNote, PayrollNote, PayrollNote,
    ) {
        let total: u64 =
            amounts[0u32] + amounts[1u32] + amounts[2u32] + amounts[3u32] +
            amounts[4u32] + amounts[5u32] + amounts[6u32] + amounts[7u32] +
            amounts[8u32] + amounts[9u32] + amounts[10u32] + amounts[11u32] +
            amounts[12u32] + amounts[13u32] + amounts[14u32] + amounts[15u32];
        assert_eq(vault.amount, total);

        return (
            PayrollNote { owner: receivers[0u32], token_program: vault.token_program, amount: amounts[0u32], note_secret: secrets[0u32], nonce: nonces[0u32] },
            PayrollNote { owner: receivers[1u32], token_program: vault.token_program, amount: amounts[1u32], note_secret: secrets[1u32], nonce: nonces[1u32] },
            PayrollNote { owner: receivers[2u32], token_program: vault.token_program, amount: amounts[2u32], note_secret: secrets[2u32], nonce: nonces[2u32] },
            PayrollNote { owner: receivers[3u32], token_program: vault.token_program, amount: amounts[3u32], note_secret: secrets[3u32], nonce: nonces[3u32] },
            PayrollNote { owner: receivers[4u32], token_program: vault.token_program, amount: amounts[4u32], note_secret: secrets[4u32], nonce: nonces[4u32] },
            PayrollNote { owner: receivers[5u32], token_program: vault.token_program, amount: amounts[5u32], note_secret: secrets[5u32], nonce: nonces[5u32] },
            PayrollNote { owner: receivers[6u32], token_program: vault.token_program, amount: amounts[6u32], note_secret: secrets[6u32], nonce: nonces[6u32] },
            PayrollNote { owner: receivers[7u32], token_program: vault.token_program, amount: amounts[7u32], note_secret: secrets[7u32], nonce: nonces[7u32] },
            PayrollNote { owner: receivers[8u32], token_program: vault.token_program, amount: amounts[8u32], note_secret: secrets[8u32], nonce: nonces[8u32] },
            PayrollNote { owner: receivers[9u32], token_program: vault.token_program, amount: amounts[9u32], note_secret: secrets[9u32], nonce: nonces[9u32] },
            PayrollNote { owner: receivers[10u32], token_program: vault.token_program, amount: amounts[10u32], note_secret: secrets[10u32], nonce: nonces[10u32] },
            PayrollNote { owner: receivers[11u32], token_program: vault.token_program, amount: amounts[11u32], note_secret: secrets[11u32], nonce: nonces[11u32] },
            PayrollNote { owner: receivers[12u32], token_program: vault.token_program, amount: amounts[12u32], note_secret: secrets[12u32], nonce: nonces[12u32] },
            PayrollNote { owner: receivers[13u32], token_program: vault.token_program, amount: amounts[13u32], note_secret: secrets[13u32], nonce: nonces[13u32] },
            PayrollNote { owner: receivers[14u32], token_program: vault.token_program, amount: amounts[14u32], note_secret: secrets[14u32], nonce: nonces[14u32] },
            PayrollNote { owner: receivers[15u32], token_program: vault.token_program, amount: amounts[15u32], note_secret: secrets[15u32], nonce: nonces[15u32] },
        );
    }

    fn withdraw_credits_from_escrow(
        note: PayrollNote,
        public amount: u64,
        public payout_to: address,
        change_secret: field,
        change_nonce: field,
        receipt_nonce: field,
    ) -> (PayrollNote, WithdrawReceipt, Final) {
        assert(amount > 0u64);
        assert_eq(note.token_program, 'credits');
        assert(note.amount >= amount);

        let payment: Final = Credits@('credits', 'aleo')::transfer_public(payout_to, amount);
        let change: u64 = note.amount - amount;

        let change_note: PayrollNote = PayrollNote {
            owner: note.owner,
            token_program: note.token_program,
            amount: change,
            note_secret: change_secret,
            nonce: change_nonce,
        };

        let receipt: WithdrawReceipt = WithdrawReceipt {
            owner: note.owner,
            amount,
            nonce: receipt_nonce,
        };

        let settlement: Final = final {
            let current: u64 = Mapping::get_or_use(escrow_balances, 'credits', 0u64);
            assert(current >= amount);

            let paid: u64 = Mapping::get_or_use(escrow_paid_totals, 'credits', 0u64);
            let recipient_paid: u64 = Mapping::get_or_use(escrow_recipient_paid_totals, payout_to, 0u64);
            Mapping::set(escrow_balances, 'credits', current - amount);
            Mapping::set(escrow_paid_totals, 'credits', paid + amount);
            Mapping::set(escrow_recipient_paid_totals, payout_to, recipient_paid + amount);

            _final_run(payment);
        };

        return (change_note, receipt, settlement);
    }

    fn withdraw_arc_from_escrow(
        note: PayrollNote,
        public amount: u64,
        public payout_to: address,
        change_secret: field,
        change_nonce: field,
        receipt_nonce: field,
    ) -> (PayrollNote, WithdrawReceipt, Final) {
        assert(amount > 0u64);
        assert(note.amount >= amount);

        let token_program: identifier = note.token_program;
        let payment: Final = ArcToken@(token_program, 'aleo')::transfer_public(payout_to, amount);
        let change: u64 = note.amount - amount;

        let change_note: PayrollNote = PayrollNote {
            owner: note.owner,
            token_program,
            amount: change,
            note_secret: change_secret,
            nonce: change_nonce,
        };

        let receipt: WithdrawReceipt = WithdrawReceipt {
            owner: note.owner,
            amount,
            nonce: receipt_nonce,
        };

        let settlement: Final = final {
            let current: u64 = Mapping::get_or_use(escrow_balances, token_program, 0u64);
            assert(current >= amount);

            let paid: u64 = Mapping::get_or_use(escrow_paid_totals, token_program, 0u64);
            let recipient_paid: u64 = Mapping::get_or_use(escrow_recipient_paid_totals, payout_to, 0u64);
            Mapping::set(escrow_balances, token_program, current - amount);
            Mapping::set(escrow_paid_totals, token_program, paid + amount);
            Mapping::set(escrow_recipient_paid_totals, payout_to, recipient_paid + amount);

            _final_run(payment);
        };

        return (change_note, receipt, settlement);
    }
}
