use {
    anchor_lang::prelude::*,
    anchor_spl::token::{TokenAccount, Mint, Token, Transfer, CloseAccount, close_account, transfer},
};

declare_id!("3x4iPCKfqTRLN13UbS5oSNk2j57u8yNHawyuyJjG9Ep6");

#[program]
pub mod escrow_program {
    use super::*;

    pub fn initialize_escrow(ctx: Context<InitializeEscrow>, amount: u64, requested_amount: u64) -> Result<()> {
        // transfer funds to escrow
        transfer(ctx.accounts.transfer_ctx(), amount)?;

        // udpate escrow state
        let escrow_state = &mut ctx.accounts.escrow_state;
        escrow_state.maker = ctx.accounts.initializer.key();
        escrow_state.program_token_a_vault = ctx.accounts.program_vault.key();
        escrow_state.amount_a = amount;
        escrow_state.requested_amount_b = requested_amount;
        escrow_state.requested_mint = ctx.accounts.requested_mint.key();
        escrow_state.initializer_token_b_account = ctx.accounts.initializer_token_b_account.key();

        Ok(())
    }

    pub fn execute_escrow(ctx: Context<ExecuteEscrow>) -> Result<()> {
        // check that token account is == initializer token account to receive
        require!(
            ctx.accounts.initializer_token_b_account.key() == ctx.accounts.escrow_state.initializer_token_b_account,
            EscrowError::IncorrectAccount
        );

        // check that token mint == escrow_state.requested_mint
        require!(
            ctx.accounts.taker_token_b_account.mint == ctx.accounts.escrow_state.requested_mint,
            EscrowError::IncorrectMint
        );

        // transfer token b from taker to maker
        transfer(
            ctx.accounts.transfer_ctx(
                ctx.accounts.taker_token_b_account.to_account_info(),
                ctx.accounts.initializer_token_b_account.to_account_info(),
                ctx.accounts.taker.to_account_info()
            ),
            ctx.accounts.escrow_state.requested_amount_b
        )?;

        // seeds and bump
        let auth_bump = *ctx.bumps.get("program_authority").unwrap();
        let auth_seeds = &["program-authority".as_bytes(), &[auth_bump]];
        let signer = &[&auth_seeds[..]];

        // transfer token a from vault to taker
        transfer(
            ctx.accounts.transfer_ctx(
                ctx.accounts.program_vault.to_account_info(),
                ctx.accounts.taker_token_a_account.to_account_info(),
                ctx.accounts.program_authority.to_account_info()
            ).with_signer(signer),
            ctx.accounts.escrow_state.amount_a
        )?;

        // close the vault account
        close_account(ctx.accounts.close_account_ctx().with_signer(signer))?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeEscrow <'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    #[account(mut)]
    pub initializer_token_account: Account<'info, TokenAccount>,
    pub initializer_token_b_account: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    pub requested_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = initializer,
        token::mint = token_mint,
        token::authority = program_authority,
        seeds = [initializer.key().as_ref(), b"program-vault"],
        bump
    )]
    pub program_vault: Account<'info, TokenAccount>,
    ///CHECK: program signer
    #[account(
        seeds = [b"program-authority"],
        bump
    )]
    pub program_authority: AccountInfo<'info>,
    #[account(
        init,
        seeds = [initializer.key().as_ref(), requested_mint.key().as_ref(), b"escrow-state"],
        bump,
        payer = initializer,
        space = 8 + 32 + 32 + 8 + 8 + 32 + 32
    )]
    pub escrow_state: Box<Account<'info, EscrowState>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>
}

#[derive(Accounts)]
pub struct ExecuteEscrow<'info> {
    #[account(mut)]
    pub taker: Signer <'info>,
    #[account(mut)]
    pub taker_token_b_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub taker_token_a_account: Account<'info, TokenAccount>,
    /// CHECK: Safe because we're not accessing or writing data
    #[account(mut)]
    pub initializer: AccountInfo<'info>,
    #[account(mut)]
    pub initializer_token_b_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [initializer.key().as_ref(), b"program-vault"],
        bump
    )]
    pub program_vault: Account<'info, TokenAccount>,
    /// CHECK: program signer
    #[account(
        seeds = [b"program-authority"],
        bump
    )]
    pub program_authority: AccountInfo<'info>,
    #[account(
        seeds = [initializer.key().as_ref(), initializer_token_b_account.mint.as_ref(), b"escrow-state"],
        bump,
    )]
    pub escrow_state: Box<Account<'info, EscrowState>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>
}


#[account]
pub struct EscrowState {
    pub maker: Pubkey,
    pub program_token_a_vault: Pubkey,
    pub amount_a: u64,
    pub requested_amount_b: u64,
    pub requested_mint: Pubkey,
    pub initializer_token_b_account: Pubkey
}

// An enum for custom error codes
#[error_code]
pub enum EscrowError {
    IncorrectAccount,
    IncorrectMint,
    IncorrectAmount
}

impl<'info> InitializeEscrow <'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.initializer_token_account.to_account_info(),
            to: self.program_vault.to_account_info(),
            authority: self.initializer.to_account_info()
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}

impl<'info> ExecuteEscrow <'info> {
    pub fn transfer_ctx(
        &self,
        from: AccountInfo<'info>,
        to: AccountInfo<'info>,
        authority: AccountInfo<'info>
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: from,
            to: to,
            authority: authority
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn close_account_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = CloseAccount {
            account: self.program_vault.to_account_info(),
            destination: self.initializer.to_account_info(),
            authority: self.program_authority.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}