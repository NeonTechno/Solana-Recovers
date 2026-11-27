import assert from "node:assert/strict";
import test from "node:test";
import { initialRecoveryDemo, recoveryDemoReducer } from "../src/recoveryDemo.ts";

test("the first demo approval stays pending and the threshold does not imply execution", () => {
  const first = recoveryDemoReducer(initialRecoveryDemo, { type: "start" });
  const second = recoveryDemoReducer(first, { type: "approve", guardian: "guardian-a" });
  const thresholdMet = recoveryDemoReducer(second, { type: "approve", guardian: "guardian-b" });

  assert.deepEqual(second, { status: "pending", approvals: ["guardian-a"] });
  assert.deepEqual(thresholdMet, { status: "threshold-met", approvals: ["guardian-a", "guardian-b"] });
});

test("duplicate guardians cannot satisfy the approval threshold", () => {
  const pending = recoveryDemoReducer(initialRecoveryDemo, { type: "start" });
  const approvedOnce = recoveryDemoReducer(pending, { type: "approve", guardian: "guardian-a" });
  const duplicate = recoveryDemoReducer(approvedOnce, { type: "approve", guardian: "guardian-a" });

  assert.deepEqual(duplicate, approvedOnce);
});

test("the owner can cancel after the threshold while the demo timelock is pending", () => {
  const pending = recoveryDemoReducer(initialRecoveryDemo, { type: "start" });
  const first = recoveryDemoReducer(pending, { type: "approve", guardian: "guardian-a" });
  const thresholdMet = recoveryDemoReducer(first, { type: "approve", guardian: "guardian-b" });
  const cancelled = recoveryDemoReducer(thresholdMet, { type: "cancel" });

  assert.deepEqual(cancelled, { status: "cancelled", approvals: [] });
});

test("starting a new demo clears prior approvals and state", () => {
  const pending = recoveryDemoReducer(initialRecoveryDemo, { type: "start" });
  const first = recoveryDemoReducer(pending, { type: "approve", guardian: "guardian-a" });
  const restarted = recoveryDemoReducer(first, { type: "start" });

  assert.deepEqual(restarted, { status: "pending", approvals: [] });
});