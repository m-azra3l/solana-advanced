import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DiamondHands } from "../target/types/diamond_hands";
import { PublicKey, Keypair } from "@solana/web3.js";
import assert from "assert";

describe("diamond_hands", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  // Access the DiamondHands program
  const program = anchor.workspace.DiamondHands as Program<DiamondHands>;

  // Create keypairs for sender and receiver
  const sender = Keypair.generate();
  const receiver = Keypair.generate();
  const wrongUser = Keypair.generate(); // Wrong user's keypair

  let bankAccount: PublicKey;

  // Test case: Should create a bank account
  it("Should create a bank account", async () => {
    const timestamp = Math.floor(Date.now() / 1000) + 1000; // Timelock 1000 seconds in the future
    const amount = 1000; // Amount to be deposited

    await program.rpc.createBank(timestamp, amount, {
      accounts: {
        bank: sender.publicKey,
        sender: program.provider.wallet.publicKey,
        receiver: receiver.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [sender, receiver],
    });

    // Fetch bank account details
    const bank = await program.account.bank.fetch(sender.publicKey);
    bankAccount = sender.publicKey;

    // Assertion checks
    assert.equal(bank.sender.toString(), sender.publicKey.toString());
    assert.equal(bank.receiver.toString(), receiver.publicKey.toString());
    assert.equal(bank.amount, amount);
    assert.equal(bank.timestamp, timestamp);
  });

  // Test case: Should fail to withdraw before timelock
  it("Should fail to withdraw before timelock", async () => {
    const timestamp = Math.floor(Date.now() / 1000) + 500; // Timelock 500 seconds in the future

    // Expect rejection with specific error code
    await assert.rejects(
      program.rpc.withdrawBank(timestamp, {
        accounts: {
          bank: bankAccount,
          sender: sender.publicKey,
          receiver: receiver.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      }),
      (err) => {
        assert.equal(err.code, "WrongAccount");
        return true;
      }
    );
  });

  // Test case: Should fail for wrong user to withdraw
  it("Should fail for wrong user to withdraw", async () => {
    const timestamp = Math.floor(Date.now() / 1000) - 500; // Timelock expired 500 seconds ago

    // Expect rejection with specific error code
    await assert.rejects(
      program.rpc.withdrawBank(timestamp, {
        accounts: {
          bank: bankAccount,
          sender: wrongUser.publicKey, // Use wrong user's public key here
          receiver: receiver.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      }),
      (err) => {
        assert.equal(err.code, "HandsTooWeak");
        return true;
      }
    );
  });

  // Test case: Should withdraw after timelock
  it("Should withdraw after timelock", async () => {
    const timestamp = Math.floor(Date.now() / 1000) - 500; // Timelock expired 500 seconds ago

    // Get sender and receiver's balance before withdrawal
    const senderLamportsBefore = await program.provider.connection.getBalance(sender.publicKey);
    const receiverLamportsBefore = await program.provider.connection.getBalance(receiver.publicKey);

    // Execute withdrawal transaction
    await program.rpc.withdrawBank(timestamp, {
      accounts: {
        bank: bankAccount,
        sender: sender.publicKey,
        receiver: receiver.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
    });

    // Get sender and receiver's balance after withdrawal
    const senderLamportsAfter = await program.provider.connection.getBalance(sender.publicKey);
    const receiverLamportsAfter = await program.provider.connection.getBalance(receiver.publicKey);

    // Fetch updated bank account details
    const bank = await program.account.bank.fetch(sender.publicKey);

    // Assertion checks
    assert.equal(senderLamportsAfter, senderLamportsBefore - bank.amount);
    assert.equal(receiverLamportsAfter, receiverLamportsBefore + bank.amount);
    assert.equal(bank.amount, 1000); // Assuming bank.amount is 1000
  });
});
