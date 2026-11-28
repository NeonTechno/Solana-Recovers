import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  API_BASE_URL,
  ApiRequestError,
  askAssistant,
  createRecoveryPlan,
  getActivity,
  getHealth,
  getRecoveryRequests,
  getRewards,
} from "../src/api/client.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("health reads the contract endpoint with JSON accept headers", async () => {
  let received;
  globalThis.fetch = async (url, init) => {
    received = { url, init };
    return new Response(JSON.stringify({ ok: true, cluster: "devnet" }), { status: 200 });
  };

  const result = await getHealth();

  assert.equal(received.url, `${API_BASE_URL}/api/health`);
  assert.equal(received.init.method, undefined);
  assert.equal(received.init.headers.Accept, "application/json");
  assert.deepEqual(result, { ok: true, cluster: "devnet" });
});

test("wallet endpoints encode addresses and unwrap their contract envelopes", async () => {
  const paths = [];
  globalThis.fetch = async url => {
    paths.push(url);
    if (url.endsWith("/activity")) return new Response(JSON.stringify({ events: [{ signature: "sig" }] }), { status: 200 });
    if (url.endsWith("/recovery/requests")) return new Response(JSON.stringify({ requests: [{ request: "pda" }] }), { status: 200 });
    return new Response(JSON.stringify({ score: { score: 72 }, rewards: [], streakDays: 3 }), { status: 200 });
  };

  assert.deepEqual(await getActivity("wallet/with space"), [{ signature: "sig" }]);
  assert.deepEqual(await getRecoveryRequests("wallet/with space"), [{ request: "pda" }]);
  assert.deepEqual(await getRewards("wallet/with space"), { score: { score: 72 }, rewards: [], streakDays: 3 });
  assert.deepEqual(paths, [
    `${API_BASE_URL}/api/wallet/wallet%2Fwith%20space/activity`,
    `${API_BASE_URL}/api/wallet/wallet%2Fwith%20space/recovery/requests`,
    `${API_BASE_URL}/api/wallet/wallet%2Fwith%20space/rewards`,
  ]);
});

test("assistant and recovery-plan POST bodies match the frozen contract", async () => {
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({ reply: "advice", degraded: true, contextUsed: [] }), { status: 200 });
  };

  await askAssistant("wallet-address", "Review guardians", "guardian_advice");
  await createRecoveryPlan("wallet-address", "approve", { nonce: 4 });

  assert.deepEqual(JSON.parse(requests[0].init.body), {
    address: "wallet-address",
    question: "Review guardians",
    intent: "guardian_advice",
  });
  assert.deepEqual(JSON.parse(requests[1].init.body), {
    address: "wallet-address",
    action: "approve",
    nonce: 4,
  });
  assert.equal(requests[0].url, `${API_BASE_URL}/api/ai/assist`);
  assert.equal(requests[1].url, `${API_BASE_URL}/api/recovery/plan`);
  assert.equal(requests[0].init.headers["Content-Type"], "application/json; charset=utf-8");
});

test("HTTP API errors preserve status and contract error codes", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: "provider_unavailable", message: "Try again soon" },
  }), { status: 503 });

  await assert.rejects(getHealth(), error => {
    assert.ok(error instanceof ApiRequestError);
    assert.equal(error.status, 503);
    assert.equal(error.code, "provider_unavailable");
    assert.equal(error.message, "Try again soon");
    return true;
  });
});

test("network failures become a visible typed API error", async () => {
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };

  await assert.rejects(getHealth(), error => {
    assert.ok(error instanceof ApiRequestError);
    assert.equal(error.status, 0);
    assert.equal(error.code, "network_error");
    return true;
  });
});