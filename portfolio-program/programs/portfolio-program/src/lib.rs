use anchor_lang::prelude::*;

declare_id!("CoWt88PkJ1sXeBToQhmnMka6Uwu1moVFFee364m6kQnK");

#[program]
pub mod portfolio_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
