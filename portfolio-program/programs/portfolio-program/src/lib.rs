use anchor_lang::prelude::*;

declare_id!("CoWt88PkJ1sXeBToQhmnMka6Uwu1moVFFee364m6kQnK");

#[program]
pub mod portfolio_program {
    use super::*;

    // Initialize the portfolio
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        // Extract mutable reference to the portfolio account
        let portfolio = &mut ctx.accounts.portfolio;
        // Set portfolio owner and initialize other fields
        portfolio.owner = *ctx.accounts.authority.key;
        portfolio.bio = String::default();
        portfolio.links = vec![];
        portfolio.image_url = String::default();
        portfolio.vouches = vec![];
        portfolio.vouch_requests = vec![];
        portfolio.messages = vec![];
        portfolio.tip_amount = 0;
        Ok(())
    }

    // Create a portfolio 
    pub fn create_portfolio(ctx: Context<CreatePortfolio>, bio: String) -> Result<()> {
        // Access control check: Only owner can update bio
        if *ctx.accounts.authority.key != ctx.accounts.portfolio.owner {
            return Err(ErrorCode::Unauthorized.into());
        }
        // Update the portfolio's bio
        ctx.accounts.portfolio.bio = bio;
        Ok(())
    }

    // Store links on-chain
    pub fn store_links(ctx: Context<StoreLinks>, links: Vec<String>) -> Result<()> {
        // Access control check: Only owner can update links
        if *ctx.accounts.authority.key != ctx.accounts.portfolio.owner {
            return Err(ErrorCode::Unauthorized.into());
        }
        // Add new links to the portfolio's links
        ctx.accounts.portfolio.links.extend(links);
        Ok(())
    }

    // Store an image URL
    pub fn store_image(ctx: Context<StoreImage>, image_url: String) -> Result<()> {
        // Access control check: Only owner can update image URL
        if *ctx.accounts.authority.key != ctx.accounts.portfolio.owner {
            return Err(ErrorCode::Unauthorized.into());
        }
        // Update the portfolio's image URL
        ctx.accounts.portfolio.image_url = image_url;
        Ok(())
    }

    // Request a vouch for the portfolio
    pub fn request_vouch(ctx: Context<RequestVouch>, vouch: VouchRequest) -> Result<()> {
        // Extract mutable reference to the portfolio account
        let portfolio = &mut ctx.accounts.portfolio;
        // Add the vouch request to the portfolio's list of vouch requests
        portfolio.vouch_requests.push(vouch);
        Ok(())
    }

    // Approve a vouch for the portfolio
    pub fn approve_vouch(ctx: Context<ApproveVouch>, vouch_user: Pubkey) -> Result<()> {
        // Access control check: Only owner can approve vouch
        if *ctx.accounts.authority.key != ctx.accounts.portfolio.owner {
            return Err(ErrorCode::Unauthorized.into());
        }
        // Extract mutable reference to the portfolio account
        let portfolio = &mut ctx.accounts.portfolio;
        // Find the vouch request and approve it
        if let Some(vouch_request) = portfolio.vouch_requests.iter_mut().find(|v| v.vouched_by == vouch_user) {
            vouch_request.is_approved = true;
            // Add the vouch to the portfolio's list of vouches
            portfolio.vouches.push(Vouch {
                vouched_by: vouch_request.vouched_by,
                comment: vouch_request.comment.clone(),
            });
        }
        Ok(())
    }

    // Send a message to the portfolio owner
    pub fn send_message(ctx: Context<SendMessage>, content: String) -> Result<()> {
        // Extract mutable reference to the portfolio account
        let portfolio = &mut ctx.accounts.portfolio;
        // Add the message to the portfolio's list of messages
        portfolio.messages.push(Message {
            sender: *ctx.accounts.authority.key,
            content,
        });
        Ok(())
    }

    // Receive a tip
    pub fn tip(ctx: Context<Tip>, amount: u64) -> Result<()> {
        // Extract mutable reference to the portfolio account
        let portfolio = &mut ctx.accounts.portfolio;
        // Increase the tip amount in the portfolio
        portfolio.tip_amount += amount;
        Ok(())
    }
}

// Define accounts and instructions

// Initialize account: Creates a new portfolio
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, seeds = [b"portfolio".as_ref()], bump, payer = authority, space = Portfolio::LEN)]
    pub portfolio: Account<'info, Portfolio>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// CreatePortfolio account: Updates the bio of the portfolio
#[derive(Accounts)]
#[instruction(bio: String)]
pub struct CreatePortfolio<'info> {
    #[account(mut, seeds = [b"portfolio".as_ref()], bump = portfolio.bump)]
    pub portfolio: Account<'info, Portfolio>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// StoreLinks account: Stores links in the portfolio
#[derive(Accounts)]
#[instruction(links: Vec<String>)]
pub struct StoreLinks<'info> {
    #[account(mut, seeds = [b"portfolio".as_ref()], bump = portfolio.bump)]
    pub portfolio: Account<'info, Portfolio>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// StoreImage account: Stores an image URL in the portfolio
#[derive(Accounts)]
#[instruction(image_url: String)]
pub struct StoreImage<'info> {
    #[account(mut, seeds = [b"portfolio".as_ref()], bump = portfolio.bump)]
    pub portfolio: Account<'info, Portfolio>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// RequestVouch account: Requests a vouch for the portfolio
#[derive(Accounts)]
pub struct RequestVouch<'info> {
    #[account(mut, seeds = [b"portfolio".as_ref()], bump = portfolio.bump)]
    pub portfolio: Account<'info, Portfolio>,
    pub system_program: Program<'info, System>,
}

// ApproveVouch account: Approves a vouch for the portfolio
#[derive(Accounts)]
pub struct ApproveVouch<'info> {
    #[account(mut, seeds = [b"portfolio".as_ref()], bump = portfolio.bump)]
    pub portfolio: Account<'info, Portfolio>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// SendMessage account: Sends a message to the portfolio owner
#[derive(Accounts)]
#[instruction(content: String)]
pub struct SendMessage<'info> {
    #[account(mut, seeds = [b"portfolio".as_ref()], bump = portfolio.bump)]
    pub portfolio: Account<'info, Portfolio>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Tip account: Receives a tip
#[derive(Accounts)]
pub struct Tip<'info> {
    #[account(mut, seeds = [b"portfolio".as_ref()], bump = portfolio.bump)]
    pub portfolio: Account<'info, Portfolio>,
    pub system_program: Program<'info, System>,
}

// Define custom data structure

// Portfolio data structure
#[account]
pub struct Portfolio {
    pub owner: Pubkey,
    pub bio: String,
    pub links: Vec<String>,      // A vector to store multiple links
    pub image_url: String,
    pub vouches: Vec<Vouch>,     // A vector to store vouches
    pub vouch_requests: Vec<VouchRequest>,   // A vector to store vouch requests
    pub messages: Vec<Message>,   // A vector to store messages
    pub tip_amount: u64,
}

// Vouch data structure
#[account]
pub struct Vouch {
    pub vouched_by: Pubkey,
    pub comment: String,
}

// Vouch request data structure
#[account]
pub struct VouchRequest {
    pub vouched_by: Pubkey,
    pub comment: String,
    pub is_approved: bool,
}

// Message data structure
#[account]
pub struct Message {
    pub sender: Pubkey,
    pub content: String,
}

// Error codes
#[error]
pub enum ErrorCode {
    Unauthorized,
}
