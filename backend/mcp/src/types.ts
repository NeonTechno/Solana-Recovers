// ReKey MCP Server Types
// Defines the TypeScript interfaces for the MCP server

import { z } from 'zod';

// ============================================================================
// MCP Server Configuration Types
// ============================================================================

export interface MCPServerConfig {
  name: string;
  version: string;
  description: string;
  transport: 'stdio' | 'http';
  port?: number;
  host?: string;
  
  // Security
  apiKey?: string;
  rateLimit?: RateLimitConfig;
  
  // Solana
  solanaRpcUrl: string;
  programId: string;
  
  // Logging
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  auditLogPath: string;
}

export interface RateLimitConfig {
  requestsPerWindow: number;
  windowSizeMs: number;
  maxWaitMs?: number;
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface AuthContext {
  userId?: string;
  sessionId: string;
  walletAddress?: string;
  isAuthenticated: boolean;
  permissions: Permission[];
  timestamp: number;
}

export type Permission = 
  | 'read:wallet'
  | 'read:policy'
  | 'read:guardians'
  | 'read:history'
  | 'write:recovery'
  | 'admin';

export interface SessionToken {
  token: string;
  userId: string;
  walletAddress: string;
  permissions: Permission[];
  expiresAt: number;
  createdAt: number;
}

// ============================================================================
// MCP Tool Input/Output Types
// ============================================================================

// Common types
export const WalletAddressSchema = z.string().length(44);
export type WalletAddress = z.infer<typeof WalletAddressSchema>;

export const TransactionSignatureSchema = z.string().length(88);
export type TransactionSignature = z.infer<typeof TransactionSignatureSchema>;

export const PubkeySchema = z.string().length(44);
export type Pubkey = z.infer<typeof PubkeySchema>;

// Wallet Status Types
export const WalletStatusSchema = z.object({
  walletAddress: WalletAddressSchema,
  isInitialized: z.boolean(),
  owner: PubkeySchema.optional(),
  vaultAddress: PubkeySchema.optional(),
  balanceLamports: z.number().optional(),
  balanceSol: z.number().optional(),
  lastUpdated: z.number(),
  network: z.enum(['mainnet', 'devnet', 'testnet', 'localnet']),
});
export type WalletStatus = z.infer<typeof WalletStatusSchema>;

// Recovery Policy Types
export const RecoveryPolicySchema = z.object({
  walletAddress: WalletAddressSchema,
  guardians: z.array(PubkeySchema),
  threshold: z.number().min(1).max(5),
  delaySeconds: z.number().min(60).max(2592000), // 60s to 30 days
  policyVersion: z.number(),
  initialOwner: PubkeySchema,
  currentOwner: PubkeySchema,
  nextNonce: z.number(),
});
export type RecoveryPolicy = z.infer<typeof RecoveryPolicySchema>;

// Guardian Types
export const GuardianInfoSchema = z.object({
  pubkey: PubkeySchema,
  label: z.string().optional(),
  isVerified: z.boolean(),
  verificationMethod: z.string().optional(),
  lastVerified: z.number().optional(),
});
export type GuardianInfo = z.infer<typeof GuardianInfoSchema>;

// Recovery History Types
export const RecoveryStatusEnum = z.enum([
  'pending',
  'approved', 
  'executed',
  'cancelled',
  'expired',
  'failed'
]);
export type RecoveryStatus = z.infer<typeof RecoveryStatusEnum>;

export const RecoveryRequestSchema = z.object({
  requestId: z.string(),
  walletAddress: WalletAddressSchema,
  newOwner: PubkeySchema,
  nonce: z.number(),
  policyVersion: z.number(),
  createdAt: z.number(),
  executeAfter: z.number(),
  expiresAt: z.number(),
  approvals: z.array(PubkeySchema),
  status: RecoveryStatusEnum,
  transactionSignature: TransactionSignatureSchema.optional(),
});
export type RecoveryRequest = z.infer<typeof RecoveryRequestSchema>;

export const RecoveryHistorySchema = z.object({
  walletAddress: WalletAddressSchema,
  requests: z.array(RecoveryRequestSchema),
  totalRequests: z.number(),
  successfulRecoveries: z.number(),
});
export type RecoveryHistory = z.infer<typeof RecoveryHistorySchema>;

// Recovery Readiness Types
export const RecoveryReadinessSchema = z.object({
  walletAddress: WalletAddressSchema,
  isReady: z.boolean(),
  requirements: z.array(z.object({
    id: z.string(),
    description: z.string(),
    isMet: z.boolean(),
    details: z.string().optional(),
  })),
  score: z.number().min(0).max(100),
  recommendations: z.array(z.string()),
});
export type RecoveryReadiness = z.infer<typeof RecoveryReadinessSchema>;

// Resilience Score Types
export const ResilienceScoreSchema = z.object({
  walletAddress: WalletAddressSchema,
  score: z.number().min(0).max(100),
  factors: z.object({
    guardianCount: z.number().min(0).max(1),
    threshold: z.number().min(0).max(1),
    delayConfig: z.number().min(0).max(1),
    guardianDiversity: z.number().min(0).max(1),
    policyActivity: z.number().min(0).max(1),
    simulationHistory: z.number().min(0).max(1),
  }),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  timestamp: z.number(),
});
export type ResilienceScore = z.infer<typeof ResilienceScoreSchema>;

// Lifeline Points Types
export const LifelinePointsSchema = z.object({
  walletAddress: WalletAddressSchema,
  totalPoints: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  achievements: z.array(z.object({
    id: z.string(),
    name: z.string(),
    points: z.number(),
    earnedAt: z.number(),
    description: z.string(),
  })),
  lastActivity: z.number(),
});
export type LifelinePoints = z.infer<typeof LifelinePointsSchema>;

// Simulation Types
export const SimulationRequestSchema = z.object({
  walletAddress: WalletAddressSchema,
  newOwner: PubkeySchema,
  guardiansToApprove: z.array(PubkeySchema),
});
export type SimulationRequest = z.infer<typeof SimulationRequestSchema>;

export const SimulationResultSchema = z.object({
  walletAddress: WalletAddressSchema,
  newOwner: PubkeySchema,
  thresholdMet: z.boolean(),
  approvalsNeeded: z.number(),
  approvalsReceived: z.number(),
  timelockStartsAt: z.number(),
  recoveryExecutableAt: z.number(),
  steps: z.array(z.object({
    step: z.number(),
    description: z.string(),
    status: z.enum(['pending', 'completed', 'skipped']),
    timestamp: z.number(),
  })),
  warnings: z.array(z.string()),
});
export type SimulationResult = z.infer<typeof SimulationResultSchema>;

// ============================================================================
// MCP Tool Schemas (for tool definitions)
// ============================================================================

// Read-only tools
export const GetWalletStatusInputSchema = z.object({
  walletAddress: WalletAddressSchema,
  network: z.enum(['mainnet', 'devnet', 'testnet', 'localnet']).default('devnet'),
});

export const GetRecoveryPolicyInputSchema = z.object({
  walletAddress: WalletAddressSchema,
});

export const ListGuardiansInputSchema = z.object({
  walletAddress: WalletAddressSchema,
});

export const GetRecoveryHistoryInputSchema = z.object({
  walletAddress: WalletAddressSchema,
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export const CheckRecoveryReadinessInputSchema = z.object({
  walletAddress: WalletAddressSchema,
});

export const SimulateRecoveryInputSchema = z.object({
  walletAddress: WalletAddressSchema,
  newOwner: PubkeySchema,
  guardians: z.array(PubkeySchema),
});

export const GetResilienceScoreInputSchema = z.object({
  walletAddress: WalletAddressSchema,
});

export const GetLifelinePointsInputSchema = z.object({
  walletAddress: WalletAddressSchema,
});

// Transaction proposal tools (require authorization)
export const CreateRecoveryRequestInputSchema = z.object({
  walletAddress: WalletAddressSchema,
  newOwner: PubkeySchema,
});

export const ApproveRecoveryInputSchema = z.object({
  walletAddress: WalletAddressSchema,
  requestId: z.string(),
  guardianPubkey: PubkeySchema,
});

export const CancelRecoveryInputSchema = z.object({
  walletAddress: WalletAddressSchema,
  requestId: z.string(),
});

export const ExecuteRecoveryInputSchema = z.object({
  walletAddress: WalletAddressSchema,
  requestId: z.string(),
});

// ============================================================================
// Error Types
// ============================================================================

export class MCPError extends Error {
  constructor(
    public readonly code: MCPErrorCode,
    message: string,
    public readonly details?: any,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export type MCPErrorCode = 
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'WALLET_NOT_INITIALIZED'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_SIGNATURE'
  | 'TRANSACTION_FAILED'
  | 'TIMELOCK_ACTIVE'
  | 'THRESHOLD_NOT_MET'
  | 'REQUEST_EXPIRED'
  | 'DUPLICATE_REQUEST'
  | 'INTERNAL_ERROR';

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
    retryable: z.boolean().optional(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================================================
// Audit Logging Types
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  action: string;
  tool: string;
  userId?: string;
  walletAddress?: string;
  requestId?: string;
  input?: any;
  output?: any;
  error?: string;
  ipAddress?: string;
  sessionId: string;
}

export interface AuditLogger {
  log(entry: AuditLogEntry): Promise<void>;
  query(filter: AuditLogFilter): Promise<AuditLogEntry[]>;
}

export interface AuditLogFilter {
  startTime?: number;
  endTime?: number;
  level?: 'info' | 'warn' | 'error';
  action?: string;
  tool?: string;
  userId?: string;
  walletAddress?: string;
  limit?: number;
}

// ============================================================================
// Resource Types (for MCP resources)
// ============================================================================

export interface MCPResource {
  type: 'resource';
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Generic Response Wrapper
// ============================================================================

export interface MCPResponse<T> {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
  warnings?: string[];
  timestamp: number;
  requestId: string;
}
