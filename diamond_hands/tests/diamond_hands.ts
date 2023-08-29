import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DiamondHands } from "../target/types/diamond_hands";
import { PublicKey, Keypair } from "@solana/web3.js";
import assert from "assert";

describe("diamond_hands", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.DiamondHands as Program<DiamondHands>;

  // Create keypairs for sender and receiver
  const sender = Keypair.generate();
  const receiver = Keypair.generate();
  const wrongUser = Keypair.generate(); // Wrong user's keypair

  let bankAccount: PublicKey;

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

    const bank = await program.account.bank.fetch(sender.publicKey);
    bankAccount = sender.publicKey;
    assert.equal(bank.sender.toString(), sender.publicKey.toString());
    assert.equal(bank.receiver.toString(), receiver.publicKey.toString());
    assert.equal(bank.amount, amount);
    assert.equal(bank.timestamp, timestamp);
  });

  it("Should fail to withdraw before timelock", async () => {
    const timestamp = Math.floor(Date.now() / 1000) + 500; // Timelock 500 seconds in the future
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

  it("Should fail for wrong user to withdraw", async () => {
    const timestamp = Math.floor(Date.now() / 1000) - 500; // Timelock expired 500 seconds ago

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

  it("Should withdraw after timelock", async () => {
    const timestamp = Math.floor(Date.now() / 1000) - 500; // Timelock expired 500 seconds ago

    const senderLamportsBefore = await program.provider.connection.getBalance(sender.publicKey);
    const receiverLamportsBefore = await program.provider.connection.getBalance(receiver.publicKey);

    await program.rpc.withdrawBank(timestamp, {
      accounts: {
        bank: bankAccount,
        sender: sender.publicKey,
        receiver: receiver.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
    });

    const senderLamportsAfter = await program.provider.connection.getBalance(sender.publicKey);
    const receiverLamportsAfter = await program.provider.connection.getBalance(receiver.publicKey);

    const bank = await program.account.bank.fetch(sender.publicKey);
    assert.equal(senderLamportsAfter, senderLamportsBefore - bank.amount);
    assert.equal(receiverLamportsAfter, receiverLamportsBefore + bank.amount);
    assert.equal(bank.amount, 1000); // Assuming bank.amount is 1000
  });
});
