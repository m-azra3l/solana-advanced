import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EscrowProgram } from "../target/types/escrow_program";
import { createMint, createAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID, getAccount } from '@solana/spl-token';
import { PublicKey, Keypair, Connection, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { safeAirdrop } from './utils/utils';
import { BN, min } from "bn.js";
import { assert } from "chai";

describe("escrow-program-demo", async () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env())

  const program = anchor.workspace.EscrowProgram as Program<EscrowProgram>
  const provider = anchor.AnchorProvider.env()
  const connection = provider.connection

  // create test keypairs and airdrop SOL
  const payer = new Keypair
  const userA = new Keypair
  const userB = new Keypair

  // Assuming PublicKey is a custom data type or a class for representing public keys

  let tokenA: PublicKey | undefined = undefined;
  let tokenB: PublicKey | undefined = undefined;
  let userATokenA: PublicKey | undefined = undefined;
  let userATokenB: PublicKey | undefined = undefined;
  let userBTokenA: PublicKey | undefined = undefined;
  let userBTokenB: PublicKey | undefined = undefined;
  let escrowState: PublicKey | undefined = undefined;

  // derive pdas
  const [programVault, vaultBump] = await PublicKey.findProgramAddress(
    [userA.publicKey.toBuffer(), Buffer.from("program-vault")],
    program.programId
  )
  
  const [programAuthority, programAuthBump] = await PublicKey.findProgramAddress(
    [Buffer.from("program-authority")],
    program.programId
  )

  it("Minting tokens", async () => {

      await safeAirdrop(userA.publicKey, connection)
      await safeAirdrop(userB.publicKey, connection)
      await safeAirdrop(payer.publicKey, connection)

      // create token mints
      tokenA = await createMint(
        provider.connection,
        payer,
        payer.publicKey,
        null,
        6
      )
      tokenB = await createMint(
        provider.connection,
        payer,
        payer.publicKey,
        null,
        6
      )
      // create ATA's for users
      userATokenA = await createAssociatedTokenAccount(connection, userA, tokenA, userA.publicKey)
      userATokenB = await createAssociatedTokenAccount(connection, userA, tokenB, userA.publicKey)
      userBTokenA = await createAssociatedTokenAccount(connection, userB, tokenA, userB.publicKey)
      userBTokenB = await createAssociatedTokenAccount(connection, userB, tokenB, userB.publicKey)

      // mint to users
      await mintTo(
        connection,
        userA,
        tokenA,
        userATokenA,
        payer,
        100000000
        )

      await mintTo(
          connection,
          userB,
          tokenB,
          userBTokenB,
          payer,
          100000000
          )
  })

  it("Initialize Escrow!", async () => {
    if(tokenB === undefined){
      return
    }
    const [escrow, escrowStateBump] = await PublicKey.findProgramAddress(
      [userA.publicKey.toBuffer(), tokenB.toBuffer(), Buffer.from("escrow-state")],
      program.programId
    )
    escrowState = escrow

    // Add your test here.
    const tx = await program.methods.initializeEscrow(new BN(5), new BN(15))
    .accounts({
      initializer: userA.publicKey,
      initializerTokenAccount: userATokenA,
      initializerTokenBAccount: userATokenB,
      tokenMint: tokenA,
      requestedMint: tokenB,
      programVault: programVault,
      programAuthority: programAuthority,
      escrowState: escrowState,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .signers([userA])
    .rpc()

    await connection.confirmTransaction(tx)

    let escrowVault = await getAccount(connection, programVault)
    assert(Number(escrowVault.amount) == 5)

    let escrowStateAcct = await program.account.escrowState.fetch(escrowState)
    assert(escrowStateAcct.maker.toBase58() == userA.publicKey.toBase58())
    assert(escrowStateAcct.amountA.toNumber() == 5)
    assert(escrowStateAcct.requestedMint.toBase58() == tokenB.toBase58())
    assert(escrowStateAcct.requestedAmountB.toNumber() == 15)
  })

    it("Execute escrow swap!", async () => {
    const tx = await program.methods.executeEscrow()
    .accounts({
      taker: userB.publicKey,
      takerTokenBAccount: userBTokenB,
      takerTokenAAccount: userBTokenA,
      initializer: userA.publicKey,
      initializerTokenBAccount: userATokenB,
      programVault: programVault,
      programAuthority: programAuthority,
      escrowState: escrowState,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .signers([userB])
    .rpc()

    await connection.confirmTransaction(tx)
    if(userATokenB === undefined || userBTokenA === undefined || escrowState === undefined){
      return
    }
    let userATokenBAcct = await getAccount(connection, userATokenB)
    let userBTokenAAcct = await getAccount(connection, userBTokenA)
    let escrowStateAcct = await program.account.escrowState.fetch(escrowState)
    assert(Number(userATokenBAcct.amount) == escrowStateAcct.requestedAmountB.toNumber())
    assert(Number(userBTokenAAcct.amount) == escrowStateAcct.amountA.toNumber())
  })
})
