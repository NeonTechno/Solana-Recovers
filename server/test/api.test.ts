/**
 * Application API tests.
 *
 * Uses a mock Solana connection with real Anchor-compatible account buffers so
 * the routes are exercised against genuine byte layouts.
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { PublicKey } from "@solana/web3.js";
import { buildServer } from "../index.ts";
import { loadConfig } from "../config.ts";
import {
  NEW_OWNER,
  OWNER,
  createMockConnection,
  createMockState,
  installRequest,
  installWallet,
} from "./mock-connection.ts";

const GUARDIAN_A = new PublicKey("4wBqgdQSa64nKNShp3DBRoyY4Dikcp85PfEFxHMpCcq");
const GUARDIAN_B = new PublicKey("Gh5Gb2SDTykCb7y1i1y448GGXrKmosakcfCS6RA4Cax");
const GUARDIAN_C = new PublicKey("USxhVRTzMsRcrsVKbzivgSZ11Uvnzw3RqfAcEYxJCZ5");

async function makeApp() {
  const state = createMockState();
  const connection = createMockConnection(state);
  const config = loadConfig({
    REKEY_ENV: "devnet",
    REKEY_PROGRAM_ID: "CuNNoYhAJsGNKZzi7NbEZjVTR2T8GUZyNKMN8SUPzRhS",
    SOLANA_RPC_URL: "http://127.0.0.1:8899",
    PORT: "8787",
    AI_API_KEY: "",
  } as NodeJS.ProcessEnv);
  return { state, config, app: await buildServer({ config, connection }) };
}

test("GET /api/health reports cluster, program and AI state", async () => {
  const { app } = await makeApp();
  const response = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.ok, true);
  assert.equal(body.cluster, "devnet");
  assert.equal(body.programId, "CuNNoYhAJsGNKZzi7NbEZjVTR2T8GUZyNKMN8SUPzRhS");
  assert.equal(body.ai.configured, false);
  assert.equal(body.ai.reachable, false);
  assert.equal(response.headers["x-rekey-api-version"], "1.0.0");
});

test("GET /api/wallet/:address returns the wallet summary", async () => {
  const { app, state } = await makeApp();
  installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B, GUARDIAN_C],
    threshold: 2,
    delaySeconds: 7 * 24 * 60 * 60,
    nextNonce: 0,
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/wallet/${OWNER.toBase58()}`,
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.owner, OWNER.toBase58());
  assert.equal(body.policy.guardians.length, 3);
  assert.equal(body.policy.threshold, 2);
  assert.equal(body.mode, "live");
  assert.equal(body.cluster, "devnet");
  assert.ok(body.vaultBalanceLamports > 0);
});

test("GET /api/wallet/:address returns 404 for an unknown wallet", async () => {
  const { app } = await makeApp();
  const response = await app.inject({
    method: "GET",
    url: `/api/wallet/${OWNER.toBase58()}`,
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "wallet_not_found");
});

test("GET /api/wallet/:address returns 400 for an invalid address", async () => {
  const { app } = await makeApp();
  const response = await app.inject({ method: "GET", url: "/api/wallet/not-a-key" });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "invalid_address");
});

test("GET recovery requests lists requests newest first", async () => {
  const { app, state } = await makeApp();
  const { walletConfig } = installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B, GUARDIAN_C],
    threshold: 2,
    delaySeconds: 3600,
    nextNonce: 2,
  });
  installRequest(state, walletConfig, { nonce: 0, status: "Approved" });
  installRequest(state, walletConfig, { nonce: 1, status: "Pending" });

  const response = await app.inject({
    method: "GET",
    url: `/api/wallet/${OWNER.toBase58()}/recovery/requests`,
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.requests.length, 2);
  assert.equal(body.requests[0].nonce, 1);
  assert.equal(body.requests[1].nonce, 0);
  assert.equal(body.requests[0].mode, "live");
});

test("GET a single recovery request returns 404 when absent", async () => {
  const { app, state } = await makeApp();
  installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A],
    threshold: 1,
    delaySeconds: 3600,
    nextNonce: 0,
  });
  const response = await app.inject({
    method: "GET",
    url: `/api/wallet/${OWNER.toBase58()}/recovery/requests/7`,
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "request_not_found");
});

test("GET /api/wallet/:address/score returns a deterministic score", async () => {
  const { app, state } = await makeApp();
  installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B, GUARDIAN_C],
    threshold: 2,
    delaySeconds: 7 * 24 * 60 * 60,
    nextNonce: 0,
  });

  const first = await app.inject({
    method: "GET",
    url: `/api/wallet/${OWNER.toBase58()}/score`,
  });
  const second = await app.inject({
    method: "GET",
    url: `/api/wallet/${OWNER.toBase58()}/score`,
  });
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().score, second.json().score);
  assert.ok(first.json().score >= 0 && first.json().score <= 100);
});

test("GET /api/wallet/:address/rewards returns the score and reward list", async () => {
  const { app, state } = await makeApp();
  installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B, GUARDIAN_C],
    threshold: 2,
    delaySeconds: 7 * 24 * 60 * 60,
    nextNonce: 0,
  });
  const response = await app.inject({
    method: "GET",
    url: `/api/wallet/${OWNER.toBase58()}/rewards`,
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(body.score);
  assert.ok(Array.isArray(body.rewards));
  assert.ok(body.rewards.length > 0);
});

test("POST /api/ai/assist degrades gracefully with no AI key", async () => {
  const { app, state } = await makeApp();
  installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B],
    threshold: 2,
    delaySeconds: 3600,
    nextNonce: 0,
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/ai/assist",
    payload: { address: OWNER.toBase58(), question: "Is this safe?" },
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.degraded, true);
  assert.ok(body.reply.includes("Offline security assessment"));
  assert.ok(Array.isArray(body.contextUsed));
});

test("POST /api/ai/assist returns 400 without an address", async () => {
  const { app } = await makeApp();
  const response = await app.inject({
    method: "POST",
    url: "/api/ai/assist",
    payload: { question: "hello" },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "invalid_request");
});

test("POST /api/recovery/plan prepares an unsigned approve plan", async () => {
  const { app, state } = await makeApp();
  const { walletConfig } = installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B, GUARDIAN_C],
    threshold: 2,
    delaySeconds: 3600,
    nextNonce: 1,
  });
  installRequest(state, walletConfig, { nonce: 0, status: "Pending" });

  const response = await app.inject({
    method: "POST",
    url: "/api/recovery/plan",
    payload: {
      wallet: OWNER.toBase58(),
      action: "approve",
      nonce: 0,
      actor: GUARDIAN_A.toBase58(),
    },
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.action, "approve");
  assert.equal(body.mode, "live");
  assert.equal(body.programId, "CuNNoYhAJsGNKZzi7NbEZjVTR2T8GUZyNKMN8SUPzRhS");
  assert.ok(body.accounts.recoveryRequest);
  // AR-02: the signer is the guardian (the actor), not the wallet lookup key.
  assert.equal(body.requiresSignatureFrom, GUARDIAN_A.toBase58());
  assert.equal(body.accounts.guardian, GUARDIAN_A.toBase58());
  assert.ok(Array.isArray(body.warnings));
  // The plan is explicitly advisory.
  assert.equal(body.advisoryOnly, true);
});

test("AR-01: the plan endpoint rejects a non-guardian actor", async () => {
  const { app, state } = await makeApp();
  const { walletConfig } = installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B],
    threshold: 1,
    delaySeconds: 3600,
    nextNonce: 1,
  });
  installRequest(state, walletConfig, { nonce: 0, status: "Pending" });

  const response = await app.inject({
    method: "POST",
    url: "/api/recovery/plan",
    payload: {
      wallet: OWNER.toBase58(),
      action: "approve",
      nonce: 0,
      actor: OWNER.toBase58(),
    },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "unauthorized");
});

test("AR-02: the resolve endpoint reports an address's role", async () => {
  const { app, state } = await makeApp();
  installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B],
    threshold: 1,
    delaySeconds: 3600,
    nextNonce: 0,
  });

  const asGuardian = await app.inject({
    method: "GET",
    url: `/api/wallet/${OWNER.toBase58()}/resolve?actor=${GUARDIAN_A.toBase58()}`,
  });
  assert.equal(asGuardian.statusCode, 200);
  const guardianBody = asGuardian.json();
  assert.equal(guardianBody.isGuardian, true);
  assert.equal(guardianBody.guardianIndex, 0);
  assert.equal(guardianBody.isCurrentOwner, false);
  assert.equal(guardianBody.currentOwner, OWNER.toBase58());

  const asOwner = await app.inject({
    method: "GET",
    url: `/api/wallet/${OWNER.toBase58()}/resolve?actor=${OWNER.toBase58()}`,
  });
  const ownerBody = asOwner.json();
  assert.equal(ownerBody.isInitialOwner, true);
  assert.equal(ownerBody.isCurrentOwner, true);
  assert.equal(ownerBody.isGuardian, false);
});

test("AR-01: health reports whether the program is deployed", async () => {
  const { app } = await makeApp();
  const response = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(typeof body.programDeployed, "boolean");
  // The mock has no program account, so this must be false, not a silent "ok".
  assert.equal(body.programDeployed, false);
});

test("POST /api/recovery/plan rejects an unknown action", async () => {
  const { app } = await makeApp();
  const response = await app.inject({
    method: "POST",
    url: "/api/recovery/plan",
    payload: { address: OWNER.toBase58(), action: "steal" },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "unknown_action");
});

test("POST /api/recovery/plan rejects an already-approved request", async () => {
  const { app, state } = await makeApp();
  const { walletConfig } = installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B],
    threshold: 1,
    delaySeconds: 3600,
    nextNonce: 1,
  });
  installRequest(state, walletConfig, { nonce: 0, status: "Approved" });

  const response = await app.inject({
    method: "POST",
    url: "/api/recovery/plan",
    payload: { wallet: OWNER.toBase58(), action: "approve", nonce: 0, actor: GUARDIAN_A.toBase58() },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "invalid_state");
});

test("POST /api/recovery/plan rejects a stale policy request", async () => {
  const { app, state } = await makeApp();
  const { walletConfig } = installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B],
    threshold: 1,
    delaySeconds: 3600,
    nextNonce: 1,
    policyVersion: 2,
  });
  installRequest(state, walletConfig, { nonce: 0, policyVersion: 1, status: "Pending" });

  const response = await app.inject({
    method: "POST",
    url: "/api/recovery/plan",
    payload: { wallet: OWNER.toBase58(), action: "approve", nonce: 0, actor: GUARDIAN_A.toBase58() },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "stale_policy");
});

test("POST /api/recovery/plan refuses to cancel once the timelock elapsed", async () => {
  const { app, state } = await makeApp();
  const { walletConfig } = installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B],
    threshold: 1,
    delaySeconds: 3600,
    nextNonce: 1,
  });
  const past = Math.floor(Date.now() / 1000) - 10;
  installRequest(state, walletConfig, {
    nonce: 0,
    status: "Approved",
    executeAfter: past,
    expiresAt: past + 1000,
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/recovery/plan",
    payload: { wallet: OWNER.toBase58(), action: "cancel", nonce: 0, actor: OWNER.toBase58() },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "timelock_elapsed");
});

test("the API never returns a signature or submits a transaction", async () => {
  const { app, state } = await makeApp();
  const { walletConfig } = installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B],
    threshold: 1,
    delaySeconds: 3600,
    nextNonce: 1,
  });
  installRequest(state, walletConfig, { nonce: 0, status: "Pending" });

  const response = await app.inject({
    method: "POST",
    url: "/api/recovery/plan",
    payload: { wallet: OWNER.toBase58(), action: "approve", nonce: 0, actor: GUARDIAN_A.toBase58() },
  });
  const body = JSON.stringify(response.json());
  assert.ok(!body.includes("privateKey"));
  assert.ok(!body.includes("secretKey"));
  assert.ok(!body.includes("seed"));
  assert.ok(!/"signature"\s*:/.test(body));
});

test("the API survives an offline RPC for the health route", async () => {
  const { app, state } = await makeApp();
  state.offline = true;
  const response = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().rpcReachable, false);
});
