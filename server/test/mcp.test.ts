/**
 * MCP Gateway tests.
 *
 * Verifies the tool catalogue, that every tool is read-only, and the error-code
 * contract for agent consumption.
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { PublicKey } from "@solana/web3.js";
import { TOOLS, createMcpServer, dispatch } from "../mcp/index.ts";
import { RekeyError, type RekeyService } from "../services/rekey.ts";
import type { ServerConfig } from "../config.ts";
import { loadConfig } from "../config.ts";
import {
  OWNER,
  createMockConnection,
  createMockState,
  installRequest,
  installWallet,
} from "./mock-connection.ts";

const GUARDIAN_A = new PublicKey("4wBqgdQSa64nKNShp3DBRoyY4Dikcp85PfEFxHMpCcq");
const GUARDIAN_B = new PublicKey("Gh5Gb2SDTykCb7y1i1y448GGXrKmosakcfCS6RA4Cax");
const GUARDIAN_C = new PublicKey("USxhVRTzMsRcrsVKbzivgSZ11Uvnzw3RqfAcEYxJCZ5");

function makeServer() {
  const state = createMockState();
  const connection = createMockConnection(state);
  const config = loadConfig({
    REKEY_ENV: "devnet",
    REKEY_PROGRAM_ID: "CuNNoYhAJsGNKZzi7NbEZjVTR2T8GUZyNKMN8SUPzRhS",
    SOLANA_RPC_URL: "http://127.0.0.1:8899",
    PORT: "8787",
    AI_API_KEY: "",
  } as NodeJS.ProcessEnv);
  const mcp = createMcpServer({ config, connection });
  return { state, config, mcp, service: mcp.service };
}

async function callTool(
  ctx: { service: RekeyService; config: ServerConfig },
  name: string,
  args: Record<string, unknown>,
) {
  try {
    const result = await dispatch(name, args, ctx.service, ctx.config);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    } as { content: Array<{ type: string; text: string }>; isError?: boolean };
  } catch (error) {
    const code = error instanceof RekeyError ? error.code : "unexpected_error";
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [
        { type: "text", text: JSON.stringify({ error: { code, message } }) },
      ],
    } as { content: Array<{ type: string; text: string }>; isError?: boolean };
  }
}

function parse(result: { content: Array<{ text: string }> }): unknown {
  return JSON.parse(result.content[0].text);
}

test("the gateway advertises exactly the eight documented tools", () => {
  const names = TOOLS.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "rekey_get_activity",
    "rekey_get_health",
    "rekey_get_recovery_request",
    "rekey_get_resilience_score",
    "rekey_get_rewards",
    "rekey_get_wallet",
    "rekey_get_wallet_health",
    "rekey_list_guardians",
  ]);
  for (const tool of TOOLS) {
    assert.ok(tool.description.length > 0, `${tool.name} needs a description`);
  }
});

test("no tool name implies a state change", () => {
  const forbidden = ["approve", "cancel", "execute", "initiate", "withdraw", "sign", "submit"];
  for (const tool of TOOLS) {
    for (const word of forbidden) {
      assert.ok(
        !tool.name.includes(word),
        `${tool.name} contains the state-changing word "${word}"`,
      );
    }
  }
});

test("every tool declares a JSON schema with a required address where relevant", () => {
  for (const tool of TOOLS) {
    const schema = tool.inputSchema as unknown as {
      type: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
    assert.equal(schema.type, "object");
    if (tool.name !== "rekey_get_health") {
      assert.ok(schema.required?.includes("address"), `${tool.name} needs address`);
    }
  }
});

test("rekey_get_wallet returns a wallet summary", async () => {
  const { mcp, state } = makeServer();
  installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B, GUARDIAN_C],
    threshold: 2,
    delaySeconds: 3600,
    nextNonce: 0,
  });

  const result = await callTool({ service: mcp.service, config: mcp.config }, "rekey_get_wallet", {
    address: OWNER.toBase58(),
  });
  if (result.isError) {
    assert.fail(`tool errored: ${result.content[0].text}`);
  }
  const body = parse(result) as { policy: { guardians: unknown[] }; mode: string };
  assert.equal(body.policy.guardians.length, 3);
  assert.equal(body.mode, "live");
});

test("rekey_get_wallet returns a structured error for an invalid address", async () => {
  const { mcp } = makeServer();
  const result = await callTool({ service: mcp.service, config: mcp.config }, "rekey_get_wallet", { address: "nope" });
  assert.equal(result.isError, true);
  const body = parse(result) as { error: { code: string } };
  assert.equal(body.error.code, "invalid_address");
});

test("rekey_get_wallet returns wallet_not_found for an unknown wallet", async () => {
  const { mcp } = makeServer();
  const result = await callTool({ service: mcp.service, config: mcp.config }, "rekey_get_wallet", {
    address: OWNER.toBase58(),
  });
  assert.equal(result.isError, true);
  const body = parse(result) as { error: { code: string } };
  assert.equal(body.error.code, "wallet_not_found");
});

test("rekey_list_guardians returns the policy", async () => {
  const { mcp, state } = makeServer();
  installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B],
    threshold: 2,
    delaySeconds: 7200,
    nextNonce: 0,
    policyVersion: 5,
  });
  const result = await callTool({ service: mcp.service, config: mcp.config }, "rekey_list_guardians", {
    address: OWNER.toBase58(),
  });
  const body = parse(result) as { threshold: number; policyVersion: number };
  assert.equal(body.threshold, 2);
  assert.equal(body.policyVersion, 5);
});

test("rekey_get_recovery_request returns a request or a stable error code", async () => {
  const { mcp, state } = makeServer();
  const { walletConfig } = installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B],
    threshold: 1,
    delaySeconds: 3600,
    nextNonce: 1,
  });
  installRequest(state, walletConfig, { nonce: 0, status: "Pending" });

  const found = await callTool({ service: mcp.service, config: mcp.config }, "rekey_get_recovery_request", {
    address: OWNER.toBase58(),
    nonce: 0,
  });
  const body = parse(found) as { nonce: number; status: string };
  assert.equal(body.nonce, 0);
  assert.equal(body.status, "Pending");

  const missing = await callTool({ service: mcp.service, config: mcp.config }, "rekey_get_recovery_request", {
    address: OWNER.toBase58(),
    nonce: 9,
  });
  assert.equal(missing.isError, true);
  const errorBody = parse(missing) as { error: { code: string } };
  assert.equal(errorBody.error.code, "request_not_found");
});

test("rekey_get_health reports cluster and RPC reachability", async () => {
  const { mcp } = makeServer();
  const result = await callTool({ service: mcp.service, config: mcp.config }, "rekey_get_health", {});
  const body = parse(result) as { cluster: string; rpcReachable: boolean };
  assert.equal(body.cluster, "devnet");
  assert.equal(body.rpcReachable, true);
});

test("rekey_get_resilience_score returns a bounded score", async () => {
  const { mcp, state } = makeServer();
  installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B, GUARDIAN_C],
    threshold: 2,
    delaySeconds: 7 * 24 * 60 * 60,
    nextNonce: 0,
  });
  const result = await callTool({ service: mcp.service, config: mcp.config }, "rekey_get_resilience_score", {
    address: OWNER.toBase58(),
  });
  const body = parse(result) as { score: number; band: string };
  assert.ok(body.score >= 0 && body.score <= 100);
  assert.ok(body.band.length > 0);
});

test("rekey_get_rewards returns the reward list", async () => {
  const { mcp, state } = makeServer();
  installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A, GUARDIAN_B, GUARDIAN_C],
    threshold: 2,
    delaySeconds: 7 * 24 * 60 * 60,
    nextNonce: 0,
  });
  const result = await callTool({ service: mcp.service, config: mcp.config }, "rekey_get_rewards", {
    address: OWNER.toBase58(),
  });
  const body = parse(result) as { rewards: unknown[]; score: unknown };
  assert.ok(body.rewards.length > 0);
  assert.ok(body.score);
});

test("rekey_get_wallet_health combines wallet, request, score and advice", async () => {
  const { mcp, state } = makeServer();
  const { walletConfig } = installWallet(state, {
    initialOwner: OWNER,
    guardians: [GUARDIAN_A],
    threshold: 1,
    delaySeconds: 3600,
    nextNonce: 1,
  });
  installRequest(state, walletConfig, { nonce: 0, status: "Pending" });

  const result = await callTool({ service: mcp.service, config: mcp.config }, "rekey_get_wallet_health", {
    address: OWNER.toBase58(),
  });
  const body = parse(result) as {
    wallet: unknown;
    activeRequest: { nonce: number } | null;
    score: { score: number };
    recommendations: string[];
  };
  assert.ok(body.wallet);
  assert.equal(body.activeRequest?.nonce, 0);
  assert.ok(body.score.score >= 0);
  assert.ok(Array.isArray(body.recommendations));
});

test("an unknown tool returns unknown_tool", async () => {
  const { mcp } = makeServer();
  const result = await callTool({ service: mcp.service, config: mcp.config }, "rekey_delete_everything", {});
  assert.equal(result.isError, true);
  const body = parse(result) as { error: { code: string } };
  assert.equal(body.error.code, "unknown_tool");
});

test("a missing required argument returns invalid_argument", async () => {
  const { mcp } = makeServer();
  const result = await callTool({ service: mcp.service, config: mcp.config }, "rekey_get_wallet", {});
  assert.equal(result.isError, true);
  const body = parse(result) as { error: { code: string } };
  assert.equal(body.error.code, "invalid_argument");
});
