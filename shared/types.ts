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

/**
 * The instructions the Anchor program exposes.
 *
 * AR-03: the contract previously omitted `initialize_wallet`,
 * `update_recovery_policy` and `withdraw_sol`, which made three real program
 * instructions unreachable through the API and the MCP Gateway.
 */
export type RecoveryAction =
  | "initialize_wallet"
  | "update_recovery_policy"
  | "initiate"
  | "approve"
  | "cancel"
  | "execute"
  | "expire"
  | "withdraw_sol";

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

export interface RecoveryPlan {
  mode: Mode;
  action: RecoveryAction;
  programId: string;
  accounts: Record<string, string>;
  args: Record<string, unknown>;
  description: string;
  /** the public key that must sign this transaction */
  requiresSignatureFrom: string;
  /**
   * Always true. A 200 from the plan endpoint means "this action is
   * well-formed", NEVER "this action will succeed". The on-chain program
   * independently re-evaluates every rule at execution time.
   */
  advisoryOnly: true;
  /** advisory preview of what the program will enforce — never authorization */
  warnings: string[];
  /** alias of `warnings`, added so the advisory nature is explicit */
  advisoryWarnings?: string[];
}

export interface HealthResponse {
  ok: boolean;
  cluster: Cluster;
  programId: string;
  rpcReachable: boolean;
  /** true when the program account exists and is executable on the target cluster */
  programDeployed: boolean;
  ai: { configured: boolean; reachable: boolean; model?: string };
  version: string;
  time: number;
}

/**
 * Identity resolution for a wallet.
 *
 * AR-02: a wallet is looked up by its INITIAL OWNER (the PDA seed), but the
 * party acting on it may be the current owner or a guardian. This endpoint
 * tells a client which role an address plays.
 */
export interface WalletIdentity {
  initialOwner: string;
  currentOwner: string;
  isInitialOwner: boolean;
  isCurrentOwner: boolean;
  isGuardian: boolean;
  guardianIndex: number | null;
}

export interface RewardsResponse {
  score: ResilienceScore;
  rewards: LifelineReward[];
  streakDays: number;
}
