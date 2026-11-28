/**
 * ReKey application service layer.
 *
 * Wraps the Solana read layer and turns raw chain state into the shared view
 * types. Everything here is READ-ONLY: it prepares data and instruction plans,
 * it never signs and never submits.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import type {
  ActivityEvent,
  RecoveryAction,
  RecoveryPlan,
  RecoveryRequestView,
  ResilienceScore,
  WalletSummary,
} from "../../shared/types.ts";
import {
  PROGRAM_ID,
  decodeWalletConfig,
  deriveRecoveryRequestPda,
  deriveVaultPda,
  deriveWalletConfigPdaSync,
  readRecoveryRequest,
  readWalletConfig,
  resolveCluster,
  type DecodedRecoveryRequest,
  type DecodedWalletConfig,
} from "../solana/read.ts";
import {
  computeLifelineRewards,
  computeResilienceScore,
  type ScoreInput,
} from "../rewards/engine.ts";

export const REQUEST_GRACE_SECONDS = 7 * 24 * 60 * 60;

export class RekeyError extends Error {
  // Explicit fields instead of TypeScript parameter properties: Node's
  // --experimental-strip-types cannot erase parameter-property syntax.
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "RekeyError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface WalletBundle {
  summary: WalletSummary;
  config: DecodedWalletConfig;
  walletConfigPda: PublicKey;
  vaultPda: PublicKey;
  requests: RecoveryRequestView[];
}

export function toWalletSummary(
  config: DecodedWalletConfig,
  walletConfigPda: PublicKey,
  vaultPda: PublicKey,
  vaultBalanceLamports: number,
): WalletSummary {
  return {
    walletConfig: walletConfigPda.toBase58(),
    vault: vaultPda.toBase58(),
    initialOwner: config.initialOwner.toBase58(),
    owner: config.owner.toBase58(),
    policy: {
      guardians: config.guardians.map((g) => ({ address: g.toBase58() })),
      threshold: config.threshold,
      delaySeconds: config.delaySeconds,
      policyVersion: config.policyVersion,
      nextNonce: config.nextNonce,
    },
    vaultBalanceLamports,
    programId: PROGRAM_ID.toBase58(),
    cluster: resolveCluster(),
    mode: "live",
  };
}

export function toRequestView(
  request: DecodedRecoveryRequest,
  threshold: number,
  now: number,
): RecoveryRequestView {
  return {
    request: deriveRecoveryRequestPda(request.walletConfig, request.nonce)[0].toBase58(),
    walletConfig: request.walletConfig.toBase58(),
    newOwner: request.newOwner.toBase58(),
    nonce: request.nonce,
    policyVersion: request.policyVersion,
    createdAt: request.createdAt,
    executeAfter: request.executeAfter,
    expiresAt: request.expiresAt,
    approvals: request.approvals.map((a) => a.toBase58()),
    threshold,
    status: request.status,
    secondsUntilExecutable: request.executeAfter - now,
    mode: "live",
  };
}

export class RekeyService {
  // Explicit field: Node's --experimental-strip-types cannot erase
  // TypeScript parameter-property syntax.
  private readonly connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async loadWallet(address: string): Promise<WalletBundle> {
    let owner: PublicKey;
    try {
      owner = new PublicKey(address);
    } catch {
      throw new RekeyError("invalid_address", "Not a valid Solana address.", 400);
    }

    const config = await readWalletConfig(this.connection, owner);
    if (!config) {
      throw new RekeyError(
        "wallet_not_found",
        "No ReKey wallet is configured for this address.",
        404,
      );
    }

    const [walletConfigPda] = deriveWalletConfigPdaSync(config.initialOwner);
    const [vaultPda] = deriveVaultPda(walletConfigPda);
    const vaultBalanceLamports = await this.connection
      .getBalance(vaultPda, "confirmed")
      .catch(() => 0);

    const now = Math.floor(Date.now() / 1000);
    const requests = await this.loadRequests(config, walletConfigPda, now);

    return {
      summary: toWalletSummary(config, walletConfigPda, vaultPda, vaultBalanceLamports),
      config,
      walletConfigPda,
      vaultPda,
      requests,
    };
  }

  private async loadRequests(
    config: DecodedWalletConfig,
    walletConfigPda: PublicKey,
    now: number,
  ): Promise<RecoveryRequestView[]> {
    const views: RecoveryRequestView[] = [];
    // nextNonce is the count of requests created so far; nonce values are 0..nextNonce-1.
    const count = Math.min(config.nextNonce, 64);
    for (let nonce = 0; nonce < count; nonce++) {
      const request = await readRecoveryRequest(this.connection, walletConfigPda, nonce);
      if (!request) continue;
      views.push(toRequestView(request, config.threshold, now));
    }
    return views.reverse();
  }

  scoreInput(bundle: WalletBundle): ScoreInput {
    const now = Math.floor(Date.now() / 1000);
    const active = bundle.requests.find(
      (r) => r.status === "Pending" || r.status === "Approved",
    );
    return {
      policy: bundle.summary.policy,
      hasActiveRequest: Boolean(active),
      vaultEverFunded: bundle.summary.vaultBalanceLamports > 0,
      policyUpdatedAt: 0,
      now,
    };
  }

  score(bundle: WalletBundle): ResilienceScore {
    return computeResilienceScore(this.scoreInput(bundle));
  }

  rewards(bundle: WalletBundle, streakDays = 0) {
    return computeLifelineRewards(this.scoreInput(bundle), streakDays);
  }

  /**
   * Builds an UNSIGNED instruction plan. The caller (the frontend) hands this to
   * the wallet adapter. This method never signs and never submits.
   */
  async buildPlan(
    address: string,
    action: RecoveryAction,
    args: { newOwner?: string; nonce?: number },
  ): Promise<RecoveryPlan> {
    const bundle = await this.loadWallet(address);
    const { config, walletConfigPda } = bundle;
    const now = Math.floor(Date.now() / 1000);
    const warnings: string[] = [];

    const base = {
      mode: "live" as const,
      action,
      programId: PROGRAM_ID.toBase58(),
    };

    switch (action) {
      case "initiate": {
        if (!args.newOwner) {
          throw new RekeyError(
            "missing_argument",
            "newOwner is required to initiate a recovery.",
            400,
          );
        }
        let newOwner: PublicKey;
        try {
          newOwner = new PublicKey(args.newOwner);
        } catch {
          throw new RekeyError("invalid_address", "newOwner is not a valid address.", 400);
        }
        if (newOwner.equals(config.owner)) {
          throw new RekeyError("same_owner", "The new owner matches the current owner.", 409);
        }
        if (newOwner.equals(config.owner)) {
          throw new RekeyError("same_owner", "The new owner matches the current owner.", 409);
        }
        const requestPda = deriveRecoveryRequestPda(walletConfigPda, config.nextNonce)[0];
        warnings.push(
          `The request will be bound to policy version ${config.policyVersion}. Changing the policy invalidates it.`,
        );
        warnings.push(
          `Recovery will not be executable until ${config.delaySeconds} seconds after creation.`,
        );
        return {
          ...base,
          accounts: {
            walletConfig: walletConfigPda.toBase58(),
            recoveryRequest: requestPda.toBase58(),
            initiator: address,
          },
          args: { newOwner: newOwner.toBase58() },
          description: `Guardian initiates a recovery request to ${newOwner.toBase58()}`,
          requiresSignatureFrom: address,
          warnings,
        };
      }

      case "approve": {
        const nonce = args.nonce;
        if (nonce === undefined || !Number.isInteger(nonce)) {
          throw new RekeyError("missing_argument", "nonce is required.", 400);
        }
        const request = bundle.requests.find((r) => r.nonce === nonce);
        if (!request) {
          throw new RekeyError("request_not_found", "No such recovery request.", 404);
        }
        if (request.status !== "Pending") {
          throw new RekeyError(
            "invalid_state",
            `This request is ${request.status} and can no longer be approved.`,
            409,
          );
        }
        if (request.policyVersion !== config.policyVersion) {
          throw new RekeyError(
            "stale_policy",
            "This request was created under an older guardian policy.",
            409,
          );
        }
        if (request.approvals.includes(address)) {
          throw new RekeyError(
            "duplicate_approval",
            "This guardian has already approved the request.",
            409,
          );
        }
        if (request.approvals.length >= config.threshold) {
          warnings.push("The approval threshold has already been reached.");
        }
        return {
          ...base,
          accounts: {
            walletConfig: walletConfigPda.toBase58(),
            recoveryRequest: request.request,
            guardian: address,
          },
          args: { nonce },
          description: `Guardian approves recovery request #${nonce}`,
          requiresSignatureFrom: address,
          warnings,
        };
      }

      case "cancel": {
        const nonce = args.nonce;
        if (nonce === undefined || !Number.isInteger(nonce)) {
          throw new RekeyError("missing_argument", "nonce is required.", 400);
        }
        const request = bundle.requests.find((r) => r.nonce === nonce);
        if (!request) {
          throw new RekeyError("request_not_found", "No such recovery request.", 404);
        }
        if (request.status !== "Pending" && request.status !== "Approved") {
          throw new RekeyError(
            "invalid_state",
            `This request is ${request.status} and can no longer be cancelled.`,
            409,
          );
        }
        if (now >= request.executeAfter) {
          throw new RekeyError(
            "timelock_elapsed",
            "The timelock has elapsed; cancellation is no longer available.",
            409,
          );
        }
        if (config.owner.toBase58() !== address) {
          throw new RekeyError(
            "unauthorized",
            "Only the current wallet owner can cancel a recovery request.",
            409,
          );
        }
        return {
          ...base,
          accounts: {
            walletConfig: walletConfigPda.toBase58(),
            recoveryRequest: request.request,
            owner: address,
          },
          args: { nonce },
          description: `Owner cancels recovery request #${nonce}`,
          requiresSignatureFrom: address,
          warnings,
        };
      }

      case "execute": {
        const nonce = args.nonce;
        if (nonce === undefined || !Number.isInteger(nonce)) {
          throw new RekeyError("missing_argument", "nonce is required.", 400);
        }
        const request = bundle.requests.find((r) => r.nonce === nonce);
        if (!request) {
          throw new RekeyError("request_not_found", "No such recovery request.", 404);
        }
        if (request.status !== "Approved") {
          throw new RekeyError(
            "threshold_not_reached",
            `This request is ${request.status}; it cannot be executed.`,
            409,
          );
        }
        if (request.policyVersion !== config.policyVersion) {
          throw new RekeyError(
            "stale_policy",
            "This request was created under an older guardian policy.",
            409,
          );
        }
        if (now < request.executeAfter) {
          warnings.push(
            `The timelock is still active for another ${request.executeAfter - now} seconds. The program will reject this transaction until it elapses.`,
          );
        }
        return {
          ...base,
          accounts: {
            walletConfig: walletConfigPda.toBase58(),
            recoveryRequest: request.request,
          },
          args: { nonce },
          description: `Execute recovery request #${nonce}, changing the owner to ${request.newOwner}`,
          requiresSignatureFrom: "any account (permissionless once approved and unlocked)",
          warnings,
        };
      }

      case "expire": {
        const nonce = args.nonce;
        if (nonce === undefined || !Number.isInteger(nonce)) {
          throw new RekeyError("missing_argument", "nonce is required.", 400);
        }
        const request = bundle.requests.find((r) => r.nonce === nonce);
        if (!request) {
          throw new RekeyError("request_not_found", "No such recovery request.", 404);
        }
        if (request.status !== "Pending" && request.status !== "Approved") {
          throw new RekeyError(
            "invalid_state",
            `This request is ${request.status} and is already final.`,
            409,
          );
        }
        if (now <= request.expiresAt) {
          throw new RekeyError(
            "not_expired",
            "This request has not expired yet.",
            409,
          );
        }
        return {
          ...base,
          accounts: {
            walletConfig: walletConfigPda.toBase58(),
            recoveryRequest: request.request,
          },
          args: { nonce },
          description: `Mark recovery request #${nonce} as expired`,
          requiresSignatureFrom: "any account (permissionless)",
          warnings,
        };
      }

      default:
        throw new RekeyError("unknown_action", "Unknown recovery action.", 400);
    }
  }

  /**
   * Activity is reconstructed from the transaction history of the wallet's PDAs
   * and decoded from program logs. Read-only.
   */
  async activity(address: string, limit = 50): Promise<ActivityEvent[]> {
    const bundle = await this.loadWallet(address);
    const max = Math.min(Math.max(limit, 1), 100);
    const signatures: string[] = [];

    for (const pda of [bundle.walletConfigPda, bundle.vaultPda]) {
      const history = await this.connection
        .getSignaturesForAddress(pda, { limit: max })
        .catch(() => []);
      for (const entry of history) {
        if (!signatures.includes(entry.signature)) signatures.push(entry.signature);
      }
    }

    for (const request of bundle.requests) {
      const history = await this.connection
        .getSignaturesForAddress(new PublicKey(request.request), { limit: max })
        .catch(() => []);
      for (const entry of history) {
        if (!signatures.includes(entry.signature)) signatures.push(entry.signature);
      }
    }

    const events: ActivityEvent[] = [];
    for (const signature of signatures.slice(0, max)) {
      const parsed = await this.parseTransaction(signature);
      if (parsed) events.push(parsed);
    }
    events.sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));
    return events;
  }

  private async parseTransaction(signature: string): Promise<ActivityEvent | null> {
    const tx = await this.connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    }).catch(() => null);
    if (!tx) return null;

    const logs = tx.meta?.logMessages ?? [];
    const blockTime = tx.blockTime ?? null;

    for (const log of logs) {
      if (!log.startsWith("Program data:")) continue;
      const match = /Program data: (.*)/.exec(log);
      if (!match) continue;
      const base64 = match[1];
      // Anchor event: 8-byte discriminator + 1-byte event index + fields.
      // Without the IDL we decode the well-known field layout by inspecting the
      // event name that Anchor prints in the "Program log:" line above.
      const name = detectEventName(logs);
      if (!name) continue;
      const type = EVENT_TYPES[name];
      if (!type) continue;
      return {
        signature,
        type,
        blockTime,
        description: describeEvent(name, base64),
        data: { raw: base64.slice(0, 64) },
      };
    }
    return null;
  }
}

const EVENT_NAMES = [
  "WalletInitialized",
  "RecoveryPolicyUpdated",
  "RecoveryInitiated",
  "GuardianApproved",
  "RecoveryCancelled",
  "RecoveryExecuted",
  "SolWithdrawn",
] as const;

const EVENT_TYPES: Record<string, ActivityEvent["type"]> = {
  WalletInitialized: "wallet_initialized",
  RecoveryPolicyUpdated: "policy_updated",
  RecoveryInitiated: "recovery_initiated",
  GuardianApproved: "guardian_approved",
  RecoveryCancelled: "recovery_cancelled",
  RecoveryExecuted: "recovery_executed",
  SolWithdrawn: "sol_withdrawn",
};

function detectEventName(logs: string[]): string | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    for (const name of EVENT_NAMES) {
      if (logs[i].includes(name)) return name;
    }
  }
  return null;
}

function describeEvent(name: string, base64: string): string {
  switch (name) {
    case "WalletInitialized":
      return "Wallet configuration created";
    case "RecoveryPolicyUpdated":
      return "Guardian policy updated";
    case "RecoveryInitiated":
      return "Recovery request initiated";
    case "GuardianApproved":
      return "Guardian approved a recovery request";
    case "RecoveryCancelled":
      return "Recovery request cancelled by the owner";
    case "RecoveryExecuted":
      return "Recovery executed — wallet owner changed";
    case "SolWithdrawn":
      return "SOL withdrawn from the vault";
    default:
      return base64.slice(0, 24);
  }
}
