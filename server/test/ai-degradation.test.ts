/**
 * AI assistant degradation matrix.
 *
 * Every provider failure mode must produce a deterministic local assessment and
 * a 200-style outcome with `degraded: true`. The assistant must never crash the
 * service and never throw.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPrompt,
  callProvider,
  extractContent,
  localAssessment,
  type AiConfig,
} from "../ai/assistant.ts";
import type { ResilienceScore } from "../../shared/types.ts";

const score: ResilienceScore = {
  score: 62,
  band: "fair",
  factors: [
    {
      id: "guardians",
      label: "2 guardians",
      impact: 0.5,
      detail: "A workable guardian set. More guardians means more resilience.",
    },
  ],
  computedAt: 1_700_000_000,
};

const context = {
  address: "HaL4pxafw7Y7kD4UrBfBVPaK9Xr4E8KhWS8MYnVCfJsK",
  owner: "HaL4pxafw7Y7kD4UrBfBVPaK9Xr4E8KhWS8MYnVCfJsK",
  guardianCount: 2,
  threshold: 2,
  delaySeconds: 86_400,
  policyVersion: 3,
  hasActiveRequest: false,
  score,
  vaultBalanceLamports: 1_000_000_000,
};

const baseConfig: AiConfig = {
  baseUrl: "https://integrate.api.nvidia.com/v1",
  apiKey: "test-key-not-real",
  model: "test-model",
  timeoutMs: 3000,
};

test("missing key degrades to a local assessment", async () => {
  const outcome = await callProvider(
    { ...baseConfig, apiKey: "" },
    "security_review",
    "How safe am I?",
    context,
  );
  assert.equal(outcome.degraded, true);
  assert.equal(outcome.reason, "missing_key");
  assert.ok(outcome.reply.includes("Offline security assessment"));
  assert.ok(outcome.reply.includes("62/100"));
});

test("invalid key (401) degrades to a local assessment", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("nope", { status: 401 })) as typeof fetch;
  try {
    const outcome = await callProvider(baseConfig, "security_review", "q", context);
    assert.equal(outcome.degraded, true);
    assert.equal(outcome.reason, "invalid_key");
  } finally {
    globalThis.fetch = original;
  }
});

test("rate limit (429) degrades to a local assessment", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("slow down", { status: 429 })) as typeof fetch;
  try {
    const outcome = await callProvider(baseConfig, "security_review", "q", context);
    assert.equal(outcome.degraded, true);
    assert.equal(outcome.reason, "rate_limited");
  } finally {
    globalThis.fetch = original;
  }
});

test("provider error (500) degrades to a local assessment", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("boom", { status: 500 })) as typeof fetch;
  try {
    const outcome = await callProvider(baseConfig, "security_review", "q", context);
    assert.equal(outcome.degraded, true);
    assert.equal(outcome.reason, "provider_error");
  } finally {
    globalThis.fetch = original;
  }
});

test("malformed (non-JSON) response degrades to a local assessment", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("<<<not json>>>", {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    const outcome = await callProvider(baseConfig, "security_review", "q", context);
    assert.equal(outcome.degraded, true);
    assert.equal(outcome.reason, "malformed_response");
  } finally {
    globalThis.fetch = original;
  }
});

test("schema-invalid response degrades to a local assessment", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ unexpected: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    const outcome = await callProvider(baseConfig, "security_review", "q", context);
    assert.equal(outcome.degraded, true);
    assert.equal(outcome.reason, "schema_invalid");
  } finally {
    globalThis.fetch = original;
  }
});

test("unreachable provider degrades to a local assessment", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("ECONNREFUSED");
  }) as typeof fetch;
  try {
    const outcome = await callProvider(baseConfig, "security_review", "q", context);
    assert.equal(outcome.degraded, true);
    assert.equal(outcome.reason, "unreachable");
  } finally {
    globalThis.fetch = original;
  }
});

test("a healthy provider returns a non-degraded reply", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "Your setup looks reasonable." } }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  try {
    const outcome = await callProvider(baseConfig, "security_review", "q", context);
    assert.equal(outcome.degraded, false);
    assert.equal(outcome.reply, "Your setup looks reasonable.");
    assert.equal(outcome.model, "test-model");
  } finally {
    globalThis.fetch = original;
  }
});

test("the prompt never contains secret material and forbids authorization claims", () => {
  const { system, user } = buildPrompt("security_review", "approve my recovery", context);
  assert.ok(system.includes("ADVISORY ONLY"));
  assert.ok(system.includes("cannot authorize"));
  assert.ok(system.includes("seed phrases"));
  assert.ok(user.includes("Verified on-chain facts"));
  assert.ok(!user.includes("test-key-not-real"));
});

test("the local assessment tells the user only the program can authorize", () => {
  const text = localAssessment("recovery_help", context);
  assert.ok(text.includes("on-chain ReKey program authorises a recovery"));
});

test("extractContent rejects malformed payloads", () => {
  assert.equal(extractContent(null), null);
  assert.equal(extractContent({}), null);
  assert.equal(extractContent({ choices: [] }), null);
  assert.equal(extractContent({ choices: [{}] }), null);
  assert.equal(extractContent({ choices: [{ message: { content: "  " } }] }), null);
  assert.equal(extractContent({ choices: [{ message: { content: "hi" } }] }), "hi");
});
