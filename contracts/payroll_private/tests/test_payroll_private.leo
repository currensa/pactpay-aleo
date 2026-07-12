import payroll_private_v2.aleo;
import mock_token.aleo;

program test_payroll_private.aleo {
    @test
    fn test_fund_and_deposit_one() -> Final {
        let funded = payroll_private_v2.aleo::fund_credits_escrow(100u64, 1field);
        let vault: payroll_private_v2.aleo::DepositVault = funded.0;
        assert_eq(vault.owner, self.signer);
        assert_eq(vault.token_program, 'credits');
        assert_eq(vault.amount, 100u64);

        let note: payroll_private_v2.aleo::PayrollNote = payroll_private_v2.aleo::deposit_one(vault, self.signer, 100u64, 2field, 3field);
        assert_eq(note.owner, self.signer);
        assert_eq(note.token_program, 'credits');
        assert_eq(note.amount, 100u64);

        return final {
            _final_run(funded.1);
        };
    }

    @test
    fn test_deposit_16_pads() -> Final {
        let funded = payroll_private_v2.aleo::fund_credits_escrow(600u64, 4field);
        let vault: payroll_private_v2.aleo::DepositVault = funded.0;
        let notes: (
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
        ) = payroll_private_v2.aleo::deposit_16(
            vault,
            [
                self.signer, self.signer, self.signer, self.signer,
                self.signer, self.signer, self.signer, self.signer,
                self.signer, self.signer, self.signer, self.signer,
                self.signer, self.signer, self.signer, self.signer,
            ],
            [
                100u64, 200u64, 300u64, 0u64,
                0u64, 0u64, 0u64, 0u64,
                0u64, 0u64, 0u64, 0u64,
                0u64, 0u64, 0u64, 0u64,
            ],
            [
                11field, 12field, 13field, 14field,
                15field, 16field, 17field, 18field,
                19field, 20field, 21field, 22field,
                23field, 24field, 25field, 26field,
            ],
            [
                31field, 32field, 33field, 34field,
                35field, 36field, 37field, 38field,
                39field, 40field, 41field, 42field,
                43field, 44field, 45field, 46field,
            ],
        );

        assert_eq(notes.0.amount, 100u64);
        assert_eq(notes.1.amount, 200u64);
        assert_eq(notes.2.amount, 300u64);
        assert_eq(notes.3.amount, 0u64);
        assert_eq(notes.15.amount, 0u64);
        assert_eq(notes.0.token_program, 'credits');
        assert_eq(notes.15.token_program, 'credits');

        return final {
            _final_run(funded.1);
        };
    }

    @test
    @should_fail
    fn test_deposit_one_fails() -> Final {
        let funded = payroll_private_v2.aleo::fund_credits_escrow(100u64, 5field);
        let vault: payroll_private_v2.aleo::DepositVault = funded.0;
        let note: payroll_private_v2.aleo::PayrollNote = payroll_private_v2.aleo::deposit_one(vault, self.signer, 99u64, 6field, 7field);
        assert_eq(note.amount, 99u64);

        return final {
            _final_run(funded.1);
        };
    }

    @test
    @should_fail
    fn test_deposit_16_fails() -> Final {
        let funded = payroll_private_v2.aleo::fund_credits_escrow(601u64, 8field);
        let vault: payroll_private_v2.aleo::DepositVault = funded.0;
        let notes: (
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
        ) = payroll_private_v2.aleo::deposit_16(
            vault,
            [
                self.signer, self.signer, self.signer, self.signer,
                self.signer, self.signer, self.signer, self.signer,
                self.signer, self.signer, self.signer, self.signer,
                self.signer, self.signer, self.signer, self.signer,
            ],
            [
                100u64, 200u64, 300u64, 0u64,
                0u64, 0u64, 0u64, 0u64,
                0u64, 0u64, 0u64, 0u64,
                0u64, 0u64, 0u64, 0u64,
            ],
            [
                51field, 52field, 53field, 54field,
                55field, 56field, 57field, 58field,
                59field, 60field, 61field, 62field,
                63field, 64field, 65field, 66field,
            ],
            [
                71field, 72field, 73field, 74field,
                75field, 76field, 77field, 78field,
                79field, 80field, 81field, 82field,
                83field, 84field, 85field, 86field,
            ],
        );
        assert_eq(notes.0.amount, 100u64);

        return final {
            _final_run(funded.1);
        };
    }

    @test
    fn test_withdraw_credits_partial() -> Final {
        let funded = payroll_private_v2.aleo::fund_credits_escrow(100u64, 91field);
        let vault: payroll_private_v2.aleo::DepositVault = funded.0;
        let note: payroll_private_v2.aleo::PayrollNote = payroll_private_v2.aleo::deposit_one(vault, self.signer, 100u64, 92field, 93field);

        let withdrawal = payroll_private_v2.aleo::withdraw_credits_from_escrow(
            note,
            40u64,
            self.signer,
            94field,
            95field,
            96field,
        );
        let change_note: payroll_private_v2.aleo::PayrollNote = withdrawal.0;
        let receipt: payroll_private_v2.aleo::WithdrawReceipt = withdrawal.1;

        assert_eq(change_note.owner, self.signer);
        assert_eq(change_note.token_program, 'credits');
        assert_eq(change_note.amount, 60u64);
        assert_eq(receipt.owner, self.signer);
        assert_eq(receipt.amount, 40u64);

        return final {
            _final_run(funded.1);
            _final_run(withdrawal.2);
        };
    }

    @test
    @should_fail
    fn test_withdraw_credits_overdraw() -> Final {
        let funded = payroll_private_v2.aleo::fund_credits_escrow(100u64, 101field);
        let vault: payroll_private_v2.aleo::DepositVault = funded.0;
        let note: payroll_private_v2.aleo::PayrollNote = payroll_private_v2.aleo::deposit_one(vault, self.signer, 100u64, 102field, 103field);

        let withdrawal = payroll_private_v2.aleo::withdraw_credits_from_escrow(
            note,
            101u64,
            self.signer,
            104field,
            105field,
            106field,
        );
        let change_note: payroll_private_v2.aleo::PayrollNote = withdrawal.0;
        assert_eq(change_note.amount, 0u64);

        return final {
            _final_run(funded.1);
            _final_run(withdrawal.2);
        };
    }

    @test
    fn test_arc_deposit16_withdraw() -> Final {
        let minted: Final = mock_token.aleo::mint_public(self.signer, 600u64);
        let funded = payroll_private_v2.aleo::fund_arc_escrow('mock_token', 600u64, 201field);
        let vault: payroll_private_v2.aleo::DepositVault = funded.0;
        assert_eq(vault.owner, self.signer);
        assert_eq(vault.token_program, 'mock_token');
        assert_eq(vault.amount, 600u64);

        let notes: (
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
            payroll_private_v2.aleo::PayrollNote, payroll_private_v2.aleo::PayrollNote,
        ) = payroll_private_v2.aleo::deposit_16(
            vault,
            [
                self.signer, self.signer, self.signer, self.signer,
                self.signer, self.signer, self.signer, self.signer,
                self.signer, self.signer, self.signer, self.signer,
                self.signer, self.signer, self.signer, self.signer,
            ],
            [
                0u64, 125u64, 0u64, 0u64,
                275u64, 0u64, 0u64, 0u64,
                0u64, 0u64, 200u64, 0u64,
                0u64, 0u64, 0u64, 0u64,
            ],
            [
                211field, 212field, 213field, 214field,
                215field, 216field, 217field, 218field,
                219field, 220field, 221field, 222field,
                223field, 224field, 225field, 226field,
            ],
            [
                231field, 232field, 233field, 234field,
                235field, 236field, 237field, 238field,
                239field, 240field, 241field, 242field,
                243field, 244field, 245field, 246field,
            ],
        );

        assert_eq(notes.1.token_program, 'mock_token');
        assert_eq(notes.1.amount, 125u64);
        assert_eq(notes.4.token_program, 'mock_token');
        assert_eq(notes.4.amount, 275u64);
        assert_eq(notes.10.token_program, 'mock_token');
        assert_eq(notes.10.amount, 200u64);
        assert_eq(notes.0.amount, 0u64);
        assert_eq(notes.15.amount, 0u64);

        let withdrawal = payroll_private_v2.aleo::withdraw_arc_from_escrow(
            notes.4,
            75u64,
            self.signer,
            251field,
            252field,
            253field,
        );
        let change_note: payroll_private_v2.aleo::PayrollNote = withdrawal.0;
        let receipt: payroll_private_v2.aleo::WithdrawReceipt = withdrawal.1;

        assert_eq(change_note.owner, self.signer);
        assert_eq(change_note.token_program, 'mock_token');
        assert_eq(change_note.amount, 200u64);
        assert_eq(receipt.owner, self.signer);
        assert_eq(receipt.amount, 75u64);

        return final {
            _final_run(minted);
            _final_run(funded.1);
            _final_run(withdrawal.2);
        };
    }

    @noupgrade
    constructor() {}
}
