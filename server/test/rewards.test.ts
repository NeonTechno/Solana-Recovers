/**
 * Resilience score + Lifeline Rewards engine tests.
 *
 * The score must be deterministic and reproducible offline: same input, same
 * output, no AI, no network.
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  bandFor,
  computeLifelineRewards,
  computeResilienceScore,
  type ScoreInput,
} from "../rewards/engine.ts";
import type { WalletPolicy } from "../../shared/types.ts";

const NOW = 1_700_000_000;

function policy(overrides: Partial<WalletPolicy> = {}): WalletPolicy {
  return {
    guardians: [
      { address: "guardian-1" },
      { address: "guardian-2" },
      { address: "guardian-3" },
    ],
    threshold: 2,
    delaySeconds: 7 * 24 * 60 * 60,
    policyVersion: 4,
    nextNonce: 0,
    ...overrides,
  };
}

function input(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    policy: policy(),
    hasActiveRequest: false,
    vaultEverFunded: true,
    policyUpdatedAt: NOW - 30 * 24 * 60 * 60,
    now: NOW,
    ...overrides,
  };
}

test("the score is deterministic", () => {
  const a = computeResilienceScore(input());
  const b = computeResilienceScore(input());
  assert.deepEqual(a, b);
});

test("the score stays within 0..100", () => {
  const best = computeResilienceScore(
    input({
      policy: policy({
        guardians: [{ address: "a" }, { address: "b" }, { address: "c" }, { address: "d" }],
        threshold: 4,
        delaySeconds: 30 * 24 * 60 * 60,
      }),
    }),
  );
  const worst = computeResilienceScore(
    input({
      policy: policy({ guardians: [], threshold: 0, delaySeconds: 0 }),
      hasActiveRequest: true,
      vaultEverFunded: false,
      policyUpdatedAt: 0,
    }),
  );
  assert.ok(best.score >= 0 && best.score <= 100, `best was ${best.score}`);
  assert.ok(worst.score >= 0 && worst.score <= 100, `worst was ${worst.score}`);
  assert.ok(best.score > worst.score);
});

test("no guardians scores lower than a full guardian set", () => {
  const none = computeResilienceScore(
    input({ policy: policy({ guardians: [], threshold: 0 }) }),
  );
  const many = computeResilienceScore(
    input({
      policy: policy({
        guardians: [{ address: "a" }, { address: "b" }, { address: "c" }, { address: "d" }],
        threshold: 3,
      }),
    }),
  );
  assert.ok(none.score < many.score);
});

test("an active recovery request reduces the score", () => {
  const clean = computeResilienceScore(input({ hasActiveRequest: false }));
  const attacked = computeResilienceScore(input({ hasActiveRequest: true }));
  assert.ok(attacked.score < clean.score);
});

test("a short timelock reduces the score", () => {
  const short = computeResilienceScore(
    input({ policy: policy({ delaySeconds: 60 }) }),
  );
  const long = computeResilienceScore(
    input({ policy: policy({ delaySeconds: 30 * 24 * 60 * 60 }) }),
  );
  assert.ok(short.score < long.score);
});

test("every factor has an id, label, detail and bounded impact", () => {
  const result = computeResilienceScore(input());
  assert.ok(result.factors.length > 0);
  for (const factor of result.factors) {
    assert.ok(factor.id.length > 0);
    assert.ok(factor.label.length > 0);
    assert.ok(factor.detail.length > 0);
    assert.ok(factor.impact >= -1 && factor.impact <= 1);
  }
});

test("band boundaries are correct", () => {
  assert.equal(bandFor(0), "critical");
  assert.equal(bandFor(29), "critical");
  assert.equal(bandFor(30), "weak");
  assert.equal(bandFor(49), "weak");
  assert.equal(bandFor(50), "fair");
  assert.equal(bandFor(69), "fair");
  assert.equal(bandFor(70), "strong");
  assert.equal(bandFor(84), "strong");
  assert.equal(bandFor(85), "resilient");
  assert.equal(bandFor(100), "resilient");
});

test("rewards progress is monotonic and bounded", () => {
  const rewards = computeLifelineRewards(input(), 0);
  assert.ok(rewards.length > 0);
  for (const reward of rewards) {
    assert.ok(reward.progress >= 0 && reward.progress <= 100, `${reward.id}`);
    assert.ok(reward.points > 0);
    assert.ok(reward.requirement.length > 0);
  }
});

test("rewards are earned when their requirement is met", () => {
  const rewards = computeLifelineRewards(input(), 7);
  const byId = new Map(rewards.map((r) => [r.id, r]));
  assert.equal(byId.get("guardian-circle")?.earned, true);
  assert.equal(byId.get("cooling-off")?.earned, true);
  assert.equal(byId.get("funded-vault")?.earned, true);
  assert.equal(byId.get("steady-hand")?.earned, true);
  assert.equal(byId.get("clear-signals")?.earned, true);
  assert.equal(byId.get("first-guardian")?.earned, true);
});

test("an empty guardian set does not earn guardian rewards", () => {
  const rewards = computeLifelineRewards(
    input({ policy: policy({ guardians: [], threshold: 0 }) }),
    0,
  );
  const byId = new Map(rewards.map((r) => [r.id, r]));
  assert.equal(byId.get("first-guardian")?.earned, false);
  assert.equal(byId.get("guardian-circle")?.earned, false);
});

test("an active request clears the clear-signals reward", () => {
  const rewards = computeLifelineRewards(input({ hasActiveRequest: true }), 0);
  const byId = new Map(rewards.map((r) => [r.id, r]));
  assert.equal(byId.get("clear-signals")?.earned, false);
  assert.equal(byId.get("clear-signals")?.progress, 0);
});
