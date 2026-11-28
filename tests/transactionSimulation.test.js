import assert from "node:assert/strict";
import test from "node:test";
import { simulateSignedTransaction } from "../src/security/transactionSimulation.ts";

const signedTransaction = { signatures: [new Uint8Array(64).fill(1)] };

test("simulation verifies signatures, records provenance, and never submits", async () => {
  let receivedTransaction;
  let receivedOptions;
  const connection = {
    async simulateTransaction(transaction, options) {
      receivedTransaction = transaction;
      receivedOptions = options;
      return {
        context: { slot: 412 },
        value: {
          err: null,
          logs: ["Program log: recovery policy checked"],
          accounts: null,
          unitsConsumed: 42_000,
          innerInstructions: [{ index: 0, instructions: [{}, {}] }],
          returnData: null,
          loadedAccountsDataSize: 1024,
          replacementBlockhash: null,
          fee: 5_000,
        },
      };
    },
  };

  const review = await simulateSignedTransaction(connection, signedTransaction);

  assert.equal(receivedTransaction, signedTransaction);
  assert.deepEqual(receivedOptions, {
    commitment: "confirmed",
    innerInstructions: true,
    replaceRecentBlockhash: false,
    sigVerify: true,
  });
  assert.equal(review.disposition, "no-error-detected");
  assert.equal(review.slot, 412);
  assert.equal(review.signatureVerificationRequested, true);
  assert.equal(review.feeLamports, 5_000);
  assert.equal(review.unitsConsumed, 42_000);
  assert.equal(review.innerInstructionCount, 2);
  assert.match(review.disclaimer, /slot 412/i);
  assert.match(review.disclaimer, /not a security guarantee/i);
  assert.ok(review.signals.some(signal => signal.kind === "heuristic" && signal.code === "cpi-observed"));
  assert.equal(typeof connection.sendTransaction, "undefined");
});

test("an RPC execution error is deterministic and is not labeled as a heuristic", async () => {
  const connection = {
    async simulateTransaction() {
      return {
        context: { slot: 513 },
        value: {
          err: { InstructionError: [0, "Custom"] },
          logs: null,
          accounts: null,
          unitsConsumed: null,
          innerInstructions: null,
          returnData: null,
          loadedAccountsDataSize: null,
          replacementBlockhash: null,
          fee: null,
        },
      };
    },
  };

  const review = await simulateSignedTransaction(connection, signedTransaction);

  assert.equal(review.disposition, "execution-error");
  assert.ok(review.signals.some(signal => signal.kind === "deterministic" && signal.code === "simulation-error"));
  assert.equal(review.signals.some(signal => signal.code === "simulation-error" && signal.kind === "heuristic"), false);
});

test("untrusted RPC logs are bounded and presented only as review evidence", async () => {
  const longLog = `Program log: ${"x".repeat(2_000)}`;
  const connection = {
    async simulateTransaction() {
      return {
        context: { slot: 514 },
        value: {
          err: null,
          logs: [longLog],
          accounts: null,
          unitsConsumed: 1,
          innerInstructions: null,
          returnData: null,
          loadedAccountsDataSize: null,
          replacementBlockhash: null,
          fee: null,
        },
      };
    },
  };

  const review = await simulateSignedTransaction(connection, signedTransaction);

  assert.equal(review.logs[0].length, 1_000);
  assert.equal(review.logsTruncated, true);
  assert.ok(review.signals.some(signal => signal.kind === "heuristic" && signal.code === "logs-observed"));
});

test("unsigned transactions are rejected before reaching RPC", async () => {
  let called = false;
  const connection = {
    async simulateTransaction() {
      called = true;
      throw new Error("must not run");
    },
  };

  await assert.rejects(
    simulateSignedTransaction(connection, { signatures: [new Uint8Array(64)] }),
    /complete signatures/i,
  );
  assert.equal(called, false);
});