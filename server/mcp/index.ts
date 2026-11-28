/**
 * ReKey MCP Gateway.
 *
 * Transport: stdio. Implements the official MCP TypeScript SDK.
 *
 * SECURITY: every tool is READ-ONLY. There is deliberately no tool that signs,
 * submits, approves, cancels or executes anything. An AI agent can inspect a
 * wallet's recovery posture; it cannot change it.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { RecoveryRequestView, WalletSummary } from "../../shared/types.ts";
import { loadConfig, type ServerConfig } from "../config.ts";
import { createConnection } from "../solana/read.ts";
import { RekeyError, RekeyService } from "../services/rekey.ts";

export const TOOLS = [
  {
    name: "rekey_get_wallet",
    description:
      "Read a ReKey wallet's configuration, guardian policy and vault balance. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Base58 Solana address of the wallet's initial owner.",
        },
      },
      required: ["address"],
    },
  },
  {
    name: "rekey_get_recovery_request",
    description:
      "Read one recovery request by nonce, including approvals, timelock and expiry. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Base58 Solana address of the initial owner." },
        nonce: { type: "integer", description: "Recovery request nonce." },
      },
      required: ["address", "nonce"],
    },
  },
  {
    name: "rekey_list_guardians",
    description: "List the guardians, threshold, delay and policy version of a ReKey wallet.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Base58 Solana address of the initial owner." },
      },
      required: ["address"],
    },
  },
  {
    name: "rekey_get_activity",
    description: "List recent on-chain recovery events for a ReKey wallet. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Base58 Solana address of the initial owner." },
        limit: { type: "integer", description: "Maximum events (default 50, max 100)." },
      },
      required: ["address"],
    },
  },
  {
    name: "rekey_get_health",
    description: "Report service health: cluster, program id, RPC reachability and AI configuration.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "rekey_get_resilience_score",
    description:
      "Compute the deterministic resilience score (0-100) and its contributing factors.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Base58 Solana address of the initial owner." },
      },
      required: ["address"],
    },
  },
  {
    name: "rekey_get_rewards",
    description: "List the Lifeline Rewards for a wallet along with its resilience score.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Base58 Solana address of the initial owner." },
      },
      required: ["address"],
    },
  },
  {
    name: "rekey_get_wallet_health",
    description:
      "Combined agent-friendly summary: wallet, policy, active request, score and recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Base58 Solana address of the initial owner." },
      },
      required: ["address"],
    },
  },
] as const;

export interface McpOptions {
  config?: ServerConfig;
  connection?: Connection;
}

export function createMcpServer(options: McpOptions = {}): {
  server: Server;
  service: RekeyService;
  config: ServerConfig;
} {
  const config = options.config ?? loadConfig();
  const connection = options.connection ?? createConnection();
  const service = new RekeyService(connection);

  const server = new Server(
    { name: "rekey-mcp-gateway", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    try {
      const result = await dispatch(name, args, service, config);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      if (error instanceof RekeyError) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: { code: error.code, message: error.message } }),
            },
          ],
        };
      }
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: { code: "unexpected_error", message: String(error) },
            }),
          },
        ],
      };
    }
  });

  return { server, service, config };
}

export async function dispatch(
  name: string,
  args: Record<string, unknown>,
  service: RekeyService,
  config: ServerConfig,
): Promise<unknown> {
  switch (name) {
    case "rekey_get_wallet": {
      const address = requireString(args, "address");
      const bundle = await service.loadWallet(address);
      return bundle.summary;
    }

    case "rekey_get_recovery_request": {
      const address = requireString(args, "address");
      const nonce = requireInteger(args, "nonce");
      const bundle = await service.loadWallet(address);
      const found = bundle.requests.find((r) => r.nonce === nonce);
      if (!found) {
        throw new RekeyError("request_not_found", "No such recovery request.", 404);
      }
      return found;
    }

    case "rekey_list_guardians": {
      const address = requireString(args, "address");
      const bundle = await service.loadWallet(address);
      return {
        guardians: bundle.summary.policy.guardians,
        threshold: bundle.summary.policy.threshold,
        delaySeconds: bundle.summary.policy.delaySeconds,
        policyVersion: bundle.summary.policy.policyVersion,
      };
    }

    case "rekey_get_activity": {
      const address = requireString(args, "address");
      const limit = args.limit === undefined ? 50 : requireInteger(args, "limit");
      return { events: await service.activity(address, limit) };
    }

    case "rekey_get_health": {
      let rpcReachable = false;
      try {
        await service["connection"].getSlot("confirmed");
        rpcReachable = true;
      } catch {
        rpcReachable = false;
      }
      return {
        ok: true,
        cluster: config.cluster,
        programId: config.programId,
        rpcReachable,
        aiConfigured: config.ai.configured,
        version: "1.0.0",
      };
    }

    case "rekey_get_resilience_score": {
      const address = requireString(args, "address");
      const bundle = await service.loadWallet(address);
      return service.score(bundle);
    }

    case "rekey_get_rewards": {
      const address = requireString(args, "address");
      const bundle = await service.loadWallet(address);
      return {
        score: service.score(bundle),
        rewards: service.rewards(bundle),
        streakDays: 0,
      };
    }

    case "rekey_get_wallet_health": {
      const address = requireString(args, "address");
      const bundle = await service.loadWallet(address);
      const score = service.score(bundle);
      const active = bundle.requests.find(
        (r) => r.status === "Pending" || r.status === "Approved",
      );
      return {
        wallet: bundle.summary,
        policy: bundle.summary.policy,
        activeRequest: active ?? null,
        score,
        recommendations: score.factors
          .filter((factor) => factor.impact < 0)
          .map((factor) => factor.detail),
      };
    }

    default:
      throw new RekeyError("unknown_tool", `Unknown tool: ${name}`, 404);
  }
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new RekeyError("invalid_argument", `${key} is required.`, 400);
  }
  if (key === "address") {
    try {
      new PublicKey(value);
    } catch {
      throw new RekeyError("invalid_address", "Not a valid Solana address.", 400);
    }
  }
  return value;
}

function requireInteger(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new RekeyError("invalid_argument", `${key} must be an integer.`, 400);
  }
  return value;
}

/** Starts the MCP server over stdio. */
export async function startMcp(): Promise<void> {
  const { server } = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isEntrypoint = process.argv[1]?.includes("server/mcp/index");
if (isEntrypoint) {
  startMcp().catch((error) => {
    process.stderr.write(`ReKey MCP Gateway failed: ${String(error)}\n`);
    process.exit(1);
  });
}
