// Frontend mirror of Vibe's shared/types.ts for the frozen v1.0.0 API contract.
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
  data: Record<string, string | number>;
}

export interface ResilienceScore {
  score: number;
  band: "critical" | "weak" | "fair" | "strong" | "resilient";
  factors: Array<{
    id: string;
    label: string;
    impact: number;
    detail: string;
  }>;
  computedAt: number;
}

export interface LifelineReward {
  id: string;
  title: string;
  description: string;
  progress: number;
  earned: boolean;
  points: number;
  requirement: string;
}

export interface AiAssistantReply {
  reply: string;
  degraded: boolean;
  provider?: string;
  model?: string;
  contextUsed: string[];
}

export type RecoveryAction = "initiate" | "approve" | "cancel" | "execute" | "expire";

export interface RecoveryPlanRequest {
  address: string;
  action: RecoveryAction;
  newOwner?: string;
  nonce?: number;
}

export interface RecoveryPlan {
  mode: Mode;
  action: RecoveryAction;
  programId: string;
  accounts: Record<string, string>;
  args: Record<string, unknown>;
  description: string;
  requiresSignatureFrom: string;
  warnings: string[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
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

export type ApiHealth = HealthResponse;

export interface RewardsResponse {
  score: ResilienceScore;
  rewards: LifelineReward[];
  streakDays: number;
}

export type AssistantIntent = "security_review" | "guardian_advice" | "recovery_help" | "freeform";