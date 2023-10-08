import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from '@solana/web3.js';
import { PortfolioProgram } from "../target/types/portfolio_program";
import assert from "assert";

describe("portfolio-program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.PortfolioProgram as Program<PortfolioProgram>;

  const authority = Keypair.generate();
  const portfolio = Keypair.generate();
  const tipAmount = new anchor.BN(100);
  const links = ["myLink1", "myLink2"];
  const bio = "my Bio";
  const imageUrl = "https://myimage.com";
  const vouchUser = Keypair.generate().publicKey;;
  const vouchComment = "Too real";
  const vouchRequest = {
    vouched_by: vouchUser,
    comment: vouchComment,
  };  
  const messageContent = "message content";

  type Message = {
    sender: PublicKey;
    content: string;
  };

  type Vouch = {
    vouched_by: PublicKey;
    comment: string;
  };


  it("Is initialized!", async () => {
    // Add your test here.
    await program.rpc.initialize({
      accounts: {
        portfolio: portfolio.publicKey,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [authority, portfolio],
    });

    const portfolioAccount = await program.account.portfolio.fetch(portfolio.publicKey);
    assert.equal(portfolioAccount.owner.toString(), authority.publicKey.toString());
  });

  it('Creates a portfolio', async () => {
    await program.rpc.createPortfolio(bio, {
      accounts: {
        portfolio: portfolio.publicKey,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [authority, portfolio],
    });

    const portfolioAccount = await program.account.portfolio.fetch(portfolio.publicKey);
    assert.equal(portfolioAccount.bio, bio);
  });

  it('Stores links', async () => {
    await program.rpc.storeLinks(links, {
      accounts: {
        portfolio: portfolio.publicKey,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [authority, portfolio],
    });

    const portfolioAccount = await program.account.portfolio.fetch(portfolio.publicKey);
    assert.deepEqual(portfolioAccount.links, links);
  });

  it('Stores an image URL', async () => {
    await program.rpc.storeImage(imageUrl, {
      accounts: {
        portfolio: portfolio.publicKey,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [authority, portfolio],
    });

    const portfolioAccount = await program.account.portfolio.fetch(portfolio.publicKey);
    assert.equal(portfolioAccount.imageUrl, imageUrl);
  });

  it('Requests a vouch for the portfolio', async () => {
    await program.rpc.requestVouch(vouchRequest, {
      accounts: {
        portfolio: portfolio.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [portfolio],
    });

    const portfolioAccount = await program.account.portfolio.fetch(portfolio.publicKey);
    assert.deepEqual(portfolioAccount.vouchRequests[0], vouchRequest);
  });

  it('Approves a vouch for the portfolio', async () => {
    await program.rpc.approveVouch(vouchUser, {
      accounts: {
        portfolio: portfolio.publicKey,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [authority, portfolio],
    });

    const portfolioAccount = await program.account.portfolio.fetch(portfolio.publicKey);
    const vouches = portfolioAccount.vouches as Array<Vouch>;
    assert.equal(vouches[0].vouched_by.toString(), vouchUser.toString());
});

it('Sends a message to the portfolio owner', async () => {
    await program.rpc.sendMessage(messageContent, {
      accounts: {
        portfolio: portfolio.publicKey,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [authority, portfolio],
    });

    const portfolioAccount = await program.account.portfolio.fetch(portfolio.publicKey);
    const messages = portfolioAccount.messages as Array<Message>;
    assert.equal(messages[0].content, messageContent);
    assert.equal(messages[0].sender.toString(), authority.publicKey.toString());
});

  it('Receives a tip', async () => {

    await program.rpc.tip(tipAmount, {
      accounts: {
        portfolio: portfolio.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [portfolio],
    });

    const portfolioAccount = await program.account.portfolio.fetch(portfolio.publicKey);
    assert.equal(portfolioAccount.tipAmount, tipAmount);
  });
});
