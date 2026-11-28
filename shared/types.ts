/**
 * ReKey shared types — the single source of truth for the API, the MCP Gateway
 * and the frontend.
 *
 * This file mirrors `docs/api-contracts.md` §0 v1.0.0 EXACTLY.
 * Vibe owns it; Junie reads it. Do not hand-edit from another agent's branch.
 *
 * Money is always integer lamports. Timestamps are always integer unix seconds.
 */

export type Cluster = "devnet" | "localnet" | "mainnet";
export type Mode = "live" | "simulated";

export type RecoveryStatus =
  | "Pending"
  | "Approved"
  | "Cancelled"
  | "Executed"
  | "Expired";

export interface Guardian {
  address: string;
  label?: string;
  /** true when this guardian has approved the request in question */
  approved?: boolean;
}

export interface WalletPolicy {
  guardians: Guardian[];
  threshold: number;
  delaySeconds: number;
  policyVersion: number;
  nextNonce: number;
}

export interface WalletSummary {
  walletConfig: string;
  vault: string;
  initialOwner: string;
  owner: string;
  policy: WalletPolicy;
  vaultBalanceLamports: number;
  /** program id this data was read from */
  programId: string;
  cluster: Cluster;
  mode: Mode;
}

export interface RecoveryRequestView {
  request: string;
  walletConfig: string;
  newOwner: string;
  nonce: number;
  policyVersion: number;
  createdAt: number;
  executeAfter: number;
  expiresAt: number;
  approvals: string[];
  threshold: number;
  status: RecoveryStatus;
  /** seconds until execute_after; negative once elapsed */
  secondsUntilExecutable: number;
  mode: Mode;
}

export interface ActivityEvent {
  signature: string;
  type:
    | "wallet_initialized"
    | "policy_updated"
    | "recovery_initiated"
    | "guardian_approved"
    | "recovery_executed"
    | "recovery_cancelled"
    | "recovery_expired"
    | "sol_withdrawn";
  blockTime: number | null;
  description: string;
  /** raw program event fields, already decoded */
  data: Record<string, string | number>;
}

export interface ResilienceScore {
  /** 0..100 */
  score: number;
  band: "critical" | "weak" | "fair" | "strong" | "resilient";
  factors: Array<{
    id: string;
    label: string;
    /** -1 (hurts) .. +1 (helps) */
    impact: number;
    detail: string;
  }>;
  /** deterministic; no AI required */
  computedAt: number;
}

export interface LifelineReward {
  id: string;
  title: string;
  description: string;
  /** 0..100 progress toward the reward */
  progress: number;
  earned: boolean;
  /** points awarded when earned */
  points: number;
  /** what the user must do, in product terms */
  requirement: string;
}

export interface AiAssistantReply {
  reply: string;
  /** true when the deterministic local fallback produced this */
  degraded: boolean;
  /** the provider actually used, when not degraded */
  provider?: string;
  model?: string;
  /** data the assistant was allowed to see */
  contextUsed: string[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export type RecoveryAction = "initiate" | "approve" | "cancel" | "execute" | "expire";

export interface RecoveryPlan {
  mode: Mode;
  action: RecoveryAction;
  programId: string;
  accounts: Record<string, string>;
  args: Record<string, unknown>;
  description: string;
  requiresSignatureFrom: string;
  /** advisory preview of what the program will enforce — never authorization */
  warnings: string[];
}

export interface HealthResponse {
  ok: boolean;
  cluster: Cluster;
  programId: string;
  rpcReachable: boolean;
  ai: { configured: boolean; reachable: boolean; model?: string };
  version: string;
  time: number;
}

export interface RewardsResponse {
  score: ResilienceScore;
  rewards: LifelineReward[];
  streakDays: number;
}
