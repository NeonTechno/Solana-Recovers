/**
 * AI security assistant adapter.
 *
 * Design rules (docs/api-contracts.md, decision D-005):
 *  - The assistant is ADVISORY. It never authorizes a recovery.
 *  - It receives only redacted, structured wallet context.
 *  - Every failure mode degrades to a deterministic local assessment and returns
 *    HTTP 200 with `degraded: true`. The service never 5xx because of the AI.
 *
 * Failure modes handled explicitly:
 *   missing key | invalid key | unreachable | 429 rate-limited | 5xx |
 *   malformed response | schema-invalid response
 */

import type { AiAssistantReply, ResilienceScore } from "../../shared/types.ts";

export type AiIntent =
  | "security_review"
  | "guardian_advice"
  | "recovery_help"
  | "freeform";

export interface AssistantContext {
  address: string;
  owner: string;
  guardianCount: number;
  threshold: number;
  delaySeconds: number;
  policyVersion: number;
  hasActiveRequest: boolean;
  activeRequestSummary?: string;
  score: ResilienceScore;
  vaultBalanceLamports: number;
}

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export type AiFailureReason =
  | "missing_key"
  | "invalid_key"
  | "unreachable"
  | "rate_limited"
  | "provider_error"
  | "malformed_response"
  | "schema_invalid";

export interface AiOutcome {
  reply: string;
  degraded: boolean;
  provider?: string;
  model?: string;
  contextUsed: string[];
  reason?: AiFailureReason;
}

const CONTEXT_FIELDS_USED = [
  "guardianCount",
  "threshold",
  "delaySeconds",
  "policyVersion",
  "hasActiveRequest",
  "score",
  "vaultBalanceLamports",
];

export function buildPrompt(
  intent: AiIntent,
  question: string,
  context: AssistantContext,
): { system: string; user: string } {
  const system = [
    "You are the ReKey wallet security assistant.",
    "ReKey is a non-custodial Solana social-recovery application.",
    "You are ADVISORY ONLY. You cannot authorize, approve, execute, cancel or sign",
    "any recovery. Only the on-chain Anchor program decides whether a recovery is",
    "authorized. Never tell the user that a recovery is approved or authorized.",
    "Never ask for, request, or handle seed phrases, private keys or signing material.",
    "Be concise, practical and specific. Prefer short numbered actions.",
    "If the wallet looks well protected, say so plainly.",
  ].join(" ");

  const facts = [
    `Wallet owner: ${context.owner}`,
    `Guardians configured: ${context.guardianCount}`,
    `Approval threshold: ${context.threshold} of ${context.guardianCount}`,
    `Recovery delay: ${context.delaySeconds} seconds`,
    `Policy version: ${context.policyVersion}`,
    `Active recovery request: ${context.hasActiveRequest ? "yes" : "no"}`,
    context.activeRequestSummary
      ? `Active request: ${context.activeRequestSummary}`
      : null,
    `Resilience score: ${context.score.score}/100 (${context.score.band})`,
    `Vault balance: ${context.vaultBalanceLamports} lamports`,
  ]
    .filter(Boolean)
    .join("\n");

  const user = [
    `Intent: ${intent}`,
    `User question: ${question || "(no specific question - give a general security review)"}`,
    "",
    "Verified on-chain facts:",
    facts,
    "",
    "Give a short, concrete security assessment and the next best actions.",
  ].join("\n");

  return { system, user };
}

/**
 * Calls the provider. Returns an AiOutcome. Never throws.
 */
export async function callProvider(
  config: AiConfig,
  intent: AiIntent,
  question: string,
  context: AssistantContext,
): Promise<AiOutcome> {
  const contextUsed = [...CONTEXT_FIELDS_USED];

  if (!config.apiKey || config.apiKey.trim().length === 0) {
    return {
      reply: localAssessment(intent, context),
      degraded: true,
      contextUsed,
      reason: "missing_key",
    };
  }

  const { system, user } = buildPrompt(intent, question, context);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: 700,
      }),
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return {
        reply: localAssessment(intent, context),
        degraded: true,
        contextUsed,
        reason: "invalid_key",
      };
    }
    if (response.status === 429) {
      return {
        reply: localAssessment(intent, context),
        degraded: true,
        contextUsed,
        reason: "rate_limited",
      };
    }
    if (!response.ok) {
      return {
        reply: localAssessment(intent, context),
        degraded: true,
        contextUsed,
        reason: "provider_error",
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        reply: localAssessment(intent, context),
        degraded: true,
        contextUsed,
        reason: "malformed_response",
      };
    }

    const content = extractContent(payload);
    if (content === null) {
      return {
        reply: localAssessment(intent, context),
        degraded: true,
        contextUsed,
        reason: "schema_invalid",
      };
    }

    return {
      reply: content,
      degraded: false,
      provider: config.baseUrl,
      model: config.model,
      contextUsed,
    };
  } catch (error) {
    const reason: AiFailureReason =
      error instanceof Error && error.name === "AbortError"
        ? "unreachable"
        : "unreachable";
    return {
      reply: localAssessment(intent, context),
      degraded: true,
      contextUsed,
      reason,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function extractContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as { message?: { content?: unknown }; text?: unknown };
  const content = first?.message?.content ?? first?.text;
  if (typeof content !== "string") return null;
  const trimmed = content.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

/**
 * Deterministic local assessment — used whenever the AI provider is unavailable.
 * It is derived entirely from the same on-chain facts the provider would receive.
 */
export function localAssessment(intent: AiIntent, context: AssistantContext): string {
  const lines: string[] = [];
  lines.push(
    "Offline security assessment (AI provider unavailable — this is a deterministic local analysis).",
  );
  lines.push("");

  const { score, band } = context.score;
  lines.push(`Resilience score: ${score}/100 (${band}).`);

  if (context.hasActiveRequest) {
    lines.push(
      "1. ACTION: A recovery request is currently active. Open the Recovery tab and confirm you recognise it. If you did not request it, cancel it — you can cancel any time before the timelock elapses.",
    );
  } else {
    lines.push(
      "1. No recovery request is active. Nothing is trying to change your wallet owner right now.",
    );
  }

  if (context.guardianCount === 0) {
    lines.push(
      "2. ACTION: You have no guardians. Without at least one, nobody can help you recover access.",
    );
  } else if (context.guardianCount === 1) {
    lines.push(
      "2. ACTION: You have one guardian. If that key is lost, recovery is impossible. Add at least two more.",
    );
  } else {
    lines.push(
      `2. You have ${context.guardianCount} guardians requiring ${context.threshold} approval(s).`,
    );
  }

  if (context.delaySeconds < 86_400) {
    lines.push(
      "3. ACTION: Your recovery delay is under a day. A longer delay (7 days is a good target) gives you time to cancel a malicious request.",
    );
  } else {
    lines.push(
      `3. Your recovery delay is ${Math.round(context.delaySeconds / 86_400)} day(s), which gives you a cancellation window.`,
    );
  }

  if (context.vaultBalanceLamports === 0) {
    lines.push(
      "4. ACTION: Your vault holds no SOL. Fund it with a small amount so you can verify the recovery path works.",
    );
  }

  lines.push(
    "5. Safety note: I can only advise. Only the on-chain ReKey program authorises a recovery, and every action still requires an explicit signature in your own wallet.",
  );

  if (intent === "guardian_advice") {
    lines.push(
      "",
      "Guardian advice: choose people or devices you would still trust in two years, spread them across different devices or locations, and never make your wallet owner a guardian.",
    );
  }
  if (intent === "recovery_help") {
    lines.push(
      "",
      "Recovery help: a guardian initiates the request, your guardians approve it until the threshold is met, then the timelock must elapse before anyone can execute it. You can cancel until the timelock elapses.",
    );
  }

  return lines.join("\n");
}

export function toReply(outcome: AiOutcome): AiAssistantReply {
  return {
    reply: outcome.reply,
    degraded: outcome.degraded,
    provider: outcome.provider,
    model: outcome.model,
    contextUsed: outcome.contextUsed,
  };
}
