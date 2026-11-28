/**
 * ReKey application API.
 *
 * READ-ONLY by design. There is no endpoint that signs or submits a transaction.
 * `POST /api/recovery/plan` prepares an unsigned instruction plan that the
 * frontend hands to the user's own wallet adapter.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { Connection } from "@solana/web3.js";
import type { ApiErrorBody, RecoveryAction } from "../shared/types.ts";
import { API_VERSION, assertMainnetBlocked, loadConfig, type ServerConfig } from "./config.ts";
import { createConnection } from "./solana/read.ts";
import { RekeyError, RekeyService } from "./services/rekey.ts";
import { callProvider, localAssessment, toReply, type AiIntent } from "./ai/assistant.ts";

export interface BuildOptions {
  config?: ServerConfig;
  connection?: Connection;
}

export async function buildServer(options: BuildOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  assertMainnetBlocked(config);

  const connection = options.connection ?? createConnection();
  const service = new RekeyService(connection);
  const app = Fastify({ logger: false });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-ReKey-API-Version", API_VERSION);
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof RekeyError) {
      const body: ApiErrorBody = {
        error: { code: error.code, message: error.message, details: error.details },
      };
      return reply.status(error.status).send(body);
    }
    const validation = error as { statusCode?: number; validation?: unknown };
    if (validation?.validation) {
      const body: ApiErrorBody = {
        error: { code: "invalid_request", message: "The request body is invalid." },
      };
      return reply.status(400).send(body);
    }
    request.log.error(error);
    const body: ApiErrorBody = {
      error: { code: "internal_error", message: "Unexpected server error." },
    };
    return reply.status(500).send(body);
  });

  // ---------------------------------------------------------------- health
  app.get("/api/health", async () => {
    let rpcReachable = false;
    try {
      await connection.getSlot("confirmed");
      rpcReachable = true;
    } catch {
      rpcReachable = false;
    }

    let aiReachable = false;
    if (config.ai.configured) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${config.ai.baseUrl.replace(/\/$/, "")}/models`, {
          headers: { Authorization: `Bearer ${config.ai.apiKey}` },
          signal: controller.signal,
        });
        clearTimeout(timer);
        aiReachable = response.ok;
      } catch {
        aiReachable = false;
      }
    }

    return {
      ok: true,
      cluster: config.cluster,
      programId: config.programId,
      rpcReachable,
      ai: {
        configured: config.ai.configured,
        reachable: aiReachable,
        model: config.ai.configured ? config.ai.model : undefined,
      },
      version: API_VERSION,
      time: Math.floor(Date.now() / 1000),
    };
  });

  // ---------------------------------------------------------------- wallet
  app.get<{ Params: { address: string } }>("/api/wallet/:address", async (request, reply) => {
    const bundle = await service.loadWallet(request.params.address);
    return reply.send(bundle.summary);
  });

  app.get<{ Params: { address: string } }>(
    "/api/wallet/:address/recovery/requests",
    async (request, reply) => {
      const bundle = await service.loadWallet(request.params.address);
      return reply.send({ requests: bundle.requests });
    },
  );

  app.get<{ Params: { address: string; nonce: string } }>(
    "/api/wallet/:address/recovery/requests/:nonce",
    async (request, reply) => {
      const nonce = Number(request.params.nonce);
      if (!Number.isInteger(nonce)) {
        throw new RekeyError("invalid_nonce", "nonce must be an integer.", 400);
      }
      const bundle = await service.loadWallet(request.params.address);
      const found = bundle.requests.find((r) => r.nonce === nonce);
      if (!found) {
        throw new RekeyError("request_not_found", "No such recovery request.", 404);
      }
      return reply.send(found);
    },
  );

  app.get<{ Params: { address: string }; Querystring: { limit?: string } }>(
    "/api/wallet/:address/activity",
    async (request, reply) => {
      const limit = request.query.limit ? Number(request.query.limit) : 50;
      const events = await service.activity(request.params.address, limit);
      return reply.send({ events });
    },
  );

  app.get<{ Params: { address: string } }>(
    "/api/wallet/:address/rewards",
    async (request, reply) => {
      const bundle = await service.loadWallet(request.params.address);
      return reply.send({
        score: service.score(bundle),
        rewards: service.rewards(bundle),
        streakDays: 0,
      });
    },
  );

  app.get<{ Params: { address: string } }>(
    "/api/wallet/:address/score",
    async (request, reply) => {
      const bundle = await service.loadWallet(request.params.address);
      return reply.send(service.score(bundle));
    },
  );

  // ------------------------------------------------------------------- AI
  app.post("/api/ai/assist", async (request, reply) => {
    const body = request.body as {
      address?: string;
      question?: string;
      intent?: string;
    } | null;

    if (!body || typeof body.address !== "string" || body.address.length === 0) {
      throw new RekeyError("invalid_request", "address is required.", 400);
    }

    const intent = normalizeIntent(body.intent);
    const question = typeof body.question === "string" ? body.question.slice(0, 2000) : "";

    let bundle;
    try {
      bundle = await service.loadWallet(body.address);
    } catch (error) {
      if (error instanceof RekeyError && error.status === 404) {
        throw new RekeyError(
          "wallet_not_found",
          "No ReKey wallet is configured for this address.",
          404,
        );
      }
      throw error;
    }

    const score = service.score(bundle);
    const active = bundle.requests.find(
      (r) => r.status === "Pending" || r.status === "Approved",
    );

    const context = {
      address: body.address,
      owner: bundle.summary.owner,
      guardianCount: bundle.summary.policy.guardians.length,
      threshold: bundle.summary.policy.threshold,
      delaySeconds: bundle.summary.policy.delaySeconds,
      policyVersion: bundle.summary.policy.policyVersion,
      hasActiveRequest: Boolean(active),
      activeRequestSummary: active
        ? `nonce ${active.nonce}, status ${active.status}, unlocks at ${active.executeAfter}`
        : undefined,
      score,
      vaultBalanceLamports: bundle.summary.vaultBalanceLamports,
    };

    const outcome = await callProvider(
      {
        baseUrl: config.ai.baseUrl,
        apiKey: config.ai.apiKey,
        model: config.ai.model,
        timeoutMs: 20_000,
      },
      intent,
      question,
      context,
    );

    return reply.send(toReply(outcome));
  });

  // ------------------------------------------------------------ recovery plan
  app.post("/api/recovery/plan", async (request, reply) => {
    const body = request.body as {
      address?: string;
      action?: string;
      newOwner?: string;
      nonce?: number;
    } | null;

    if (!body || typeof body.address !== "string") {
      throw new RekeyError("invalid_request", "address is required.", 400);
    }
    const action = normalizeAction(body.action);
    const plan = await service.buildPlan(body.address, action, {
      newOwner: body.newOwner,
      nonce: body.nonce,
    });
    return reply.send(plan);
  });

  return app;
}

function normalizeIntent(value: unknown): AiIntent {
  if (
    value === "security_review" ||
    value === "guardian_advice" ||
    value === "recovery_help" ||
    value === "freeform"
  ) {
    return value;
  }
  return "freeform";
}

function normalizeAction(value: unknown): RecoveryAction {
  if (
    value === "initiate" ||
    value === "approve" ||
    value === "cancel" ||
    value === "execute" ||
    value === "expire"
  ) {
    return value;
  }
  throw new RekeyError("unknown_action", "Unknown recovery action.", 400);
}

/** Entry point for `npm run server`. */
export async function start(): Promise<void> {
  const config = loadConfig();
  const app = await buildServer({ config });
  await app.listen({ port: config.port, host: "0.0.0.0" });
  process.stdout.write(
    `ReKey API listening on http://localhost:${config.port} (cluster=${config.cluster}, program=${config.programId})\n`,
  );
}

const isEntrypoint = process.argv[1]?.includes("server/index");
if (isEntrypoint) {
  start().catch((error) => {
    process.stderr.write(`ReKey API failed to start: ${String(error)}\n`);
    process.exit(1);
  });
}
