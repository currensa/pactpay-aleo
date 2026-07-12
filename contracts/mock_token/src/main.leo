program mock_token.aleo {
    // Function inputs are intentionally left unqualified: in Leo they are private
    // by default. Add `public` only when a value must be visible in program state.

    mapping account: address => u64;

    @noupgrade
    constructor() {}

    // Public ARC-like surface used by payroll_private_v2.aleo for demo settlement.
    // This is intentionally minimal: public balances plus public transfer calls.
    fn mint_public(
        public receiver: address,
        public amount: u64,
    ) -> Final {
        assert(amount > 0u64);

        return final {
            let current: u64 = Mapping::get_or_use(account, receiver, 0u64);
            Mapping::set(account, receiver, current + amount);
        };
    }

    fn transfer_public(
        public receiver: address,
        public amount: u64,
    ) -> Final {
        assert(amount > 0u64);

        let sender: address = _self_caller();

        return final {
            let sender_balance: u64 = Mapping::get_or_use(account, sender, 0u64);
            assert(sender_balance >= amount);

            let receiver_balance: u64 = Mapping::get_or_use(account, receiver, 0u64);
            Mapping::set(account, sender, sender_balance - amount);
            Mapping::set(account, receiver, receiver_balance + amount);
        };
    }

    fn transfer_public_as_signer(
        public receiver: address,
        public amount: u64,
    ) -> Final {
        assert(amount > 0u64);

        let sender: address = _self_signer();

        return final {
            let sender_balance: u64 = Mapping::get_or_use(account, sender, 0u64);
            assert(sender_balance >= amount);

            let receiver_balance: u64 = Mapping::get_or_use(account, receiver, 0u64);
            Mapping::set(account, sender, sender_balance - amount);
            Mapping::set(account, receiver, receiver_balance + amount);
        };
    }

    // Private record token functions kept for local privacy experiments.
    record Token {
        owner: address,
        amount: u64,
        nonce: field,
    }

    record TransferReceipt {
        owner: address,
        amount: u64,
        nonce: field,
    }

    fn mint_private(
        receiver: address,
        amount: u64,
        nonce: field,
    ) -> Token {
        return Token {
            owner: receiver,
            amount,
            nonce,
        };
    }

    fn split_private(
        input: Token,
        first_owner: address,
        first_amount: u64,
        first_nonce: field,
        second_nonce: field,
    ) -> (Token, Token) {
        assert(input.amount >= first_amount);

        let remaining: u64 = input.amount - first_amount;

        return (
            Token {
                owner: first_owner,
                amount: first_amount,
                nonce: first_nonce,
            },
            Token {
                owner: input.owner,
                amount: remaining,
                nonce: second_nonce,
            },
        );
    }

    fn transfer_private(
        input: Token,
        receiver: address,
        amount: u64,
        receiver_nonce: field,
        change_nonce: field,
    ) -> (Token, Token) {
        assert(input.amount >= amount);

        let change: u64 = input.amount - amount;

        return (
            Token {
                owner: receiver,
                amount,
                nonce: receiver_nonce,
            },
            Token {
                owner: input.owner,
                amount: change,
                nonce: change_nonce,
            },
        );
    }

    fn burn_to_receipt(
        input: Token,
        receipt_nonce: field,
    ) -> TransferReceipt {
        return TransferReceipt {
            owner: input.owner,
            amount: input.amount,
            nonce: receipt_nonce,
        };
    }
}
