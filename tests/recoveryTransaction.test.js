import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { buildRecoveryInstruction, REKEY_PROGRAM_ID } from "../src/security/recoveryTransaction.ts";

const addressFromByte = byte => new PublicKey(new Uint8Array(32).fill(byte));
const signer = addressFromByte(8);
const initialOwner = addressFromByte(7);
const programId = new PublicKey(REKEY_PROGRAM_ID);

function plan(overrides = {}) {
  const { args: argumentOverrides, accounts: accountOverrides, ...planOverrides } = overrides;
  const args = { nonce: 7, ...argumentOverrides };
  const walletConfig = PublicKey.findProgramAddressSync([
    new TextEncoder().encode("wallet"),
    initialOwner.toBytes(),
  ], programId)[0];
  const nonceBytes = new Uint8Array(8);
  new DataView(nonceBytes.buffer).setBigUint64(0, BigInt(args.nonce), true);
  const recoveryRequest = PublicKey.findProgramAddressSync([
    new TextEncoder().encode("recovery"),
    walletConfig.toBytes(),
    nonceBytes,
  ], programId)[0];
  return {
    mode: "live",
    action: "approve",
    programId: REKEY_PROGRAM_ID,
    accounts: {
      walletConfig: walletConfig.toBase58(),
      recoveryRequest: recoveryRequest.toBase58(),
      ...accountOverrides,
    },
    args,
    description: "Guardian approves recovery request #7",
    requiresSignatureFrom: signer.toBase58(),
    warnings: [],
    ...planOverrides,
  };
}

test("approval instructions use the Anchor discriminator and the connected guardian signer", async () => {
  const instruction = await buildRecoveryInstruction(plan(), signer, initialOwner.toBase58());
  const discriminator = createHash("sha256").update("global:approve_recovery").digest().subarray(0, 8);

  assert.equal(instruction.programId.toBase58(), REKEY_PROGRAM_ID);
  assert.equal(instruction.data.length, 8);
  assert.deepEqual(new Uint8Array(instruction.data), Uint8Array.from(discriminator));
  assert.deepEqual(instruction.keys.map(key => [key.pubkey.toBase58(), key.isSigner, key.isWritable]), [
    [plan().accounts.walletConfig, false, false],
    [plan().accounts.recoveryRequest, false, true],
    [signer.toBase58(), true, false],
  ]);
});

test("initiation serializes the proposed owner and adds only the canonical system program", async () => {
  const newOwner = addressFromByte(11);
  const initiationPlan = plan({
    action: "initiate",
    args: { newOwner: newOwner.toBase58(), nonce: 7 },
  });

  const instruction = await buildRecoveryInstruction(initiationPlan, signer, initialOwner.toBase58());

  assert.equal(instruction.data.length, 40);
  assert.deepEqual(instruction.data.subarray(8), newOwner.toBytes());
  assert.equal(instruction.keys.length, 4);
  assert.equal(instruction.keys[2].pubkey.toBase58(), signer.toBase58());
  assert.equal(instruction.keys[3].pubkey.toBase58(), SystemProgram.programId.toBase58());
});

test("simulated plans, wrong program IDs, and mismatched signers are rejected", async () => {
  await assert.rejects(buildRecoveryInstruction(plan({ mode: "simulated" }), signer, initialOwner.toBase58()), /simulated/i);
  await assert.rejects(buildRecoveryInstruction(plan({ programId: addressFromByte(9).toBase58() }), signer, initialOwner.toBase58()), /unexpected program/i);
  await assert.rejects(buildRecoveryInstruction(plan({ requiresSignatureFrom: addressFromByte(10).toBase58() }), signer, initialOwner.toBase58()), /required signer/i);
});

test("an API-supplied guardian account cannot redirect the signer", async () => {
  const suppliedGuardian = addressFromByte(12);
  await assert.rejects(
    buildRecoveryInstruction(plan({ accounts: { guardian: suppliedGuardian.toBase58() } }), signer, initialOwner.toBase58()),
    /guardian does not match/i,
  );
});

test("wallet and recovery PDAs are bound to the initial owner and nonce", async () => {
  await assert.rejects(
    buildRecoveryInstruction(plan({ accounts: { walletConfig: addressFromByte(13).toBase58() } }), signer, initialOwner.toBase58()),
    /wallet account does not match/i,
  );
  await assert.rejects(
    buildRecoveryInstruction(plan({ accounts: { recoveryRequest: addressFromByte(14).toBase58() } }), signer, initialOwner.toBase58()),
    /recovery account does not match/i,
  );
});