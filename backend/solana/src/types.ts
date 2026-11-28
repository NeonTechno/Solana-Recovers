// ReKey Solana - Type Definitions
// TypeScript types that mirror the Anchor program

import { PublicKey, Transaction, TransactionSignature } from '@solana/web3.js';
import { z } from 'zod';

// ============================================================================
// Program Configuration Types
// ============================================================================

export interface ReKeyProgramConfig {
  programId: string;
  rpcUrl: string;
  commitment: 'confirmed' | 'finalized' | 'processed';
  maxRetries: number;
  timeoutMs: number;
}

// ============================================================================
// Account Types (mirroring Anchor program accounts)
// ============================================================================

export const MAX_GUARDIANS = 5;

// Wallet Configuration Account
export interface WalletConfig {
  pubkey: PublicKey;
  initialOwner: PublicKey;
  owner: PublicKey;
  guardians: PublicKey[];
  threshold: number; // u8
  delaySeconds: number; // i64
  nextNonce: number; // u64
  policyVersion: number; // u64
  bump: number; // u8
}

// Vault Account
export interface Vault {
  pubkey: PublicKey;
  walletConfig: PublicKey;
  bump: number; // u8
}

// Recovery Request Account
export type RecoveryStatus = 
  | 'pending'
  | 'approved'
  | 'cancelled'
  | 'executed'
  | 'expired';

export interface RecoveryRequest {
  pubkey: PublicKey;
  walletConfig: PublicKey;
  newOwner: PublicKey;
  nonce: number; // u64
  policyVersion: number; // u64
  createdAt: number; // i64
  executeAfter: number; // i64
  expiresAt: number; // i64
  approvals: PublicKey[];
  status: RecoveryStatus;
  bump: number; // u8
}

// ============================================================================
// Instruction Types
// ============================================================================

export interface InitializeWalletParams {
  guardians: PublicKey[];
  threshold: number;
  delaySeconds: number;
}

export interface InitializeWalletResult {
  walletConfig: PublicKey;
  vault: PublicKey;
  transactionSignature: TransactionSignature;
}

export interface UpdateRecoveryPolicyParams {
  guardians: PublicKey[];
  threshold: number;
  delaySeconds: number;
}

export interface UpdateRecoveryPolicyResult {
  policyVersion: number;
  transactionSignature: TransactionSignature;
}

export interface InitiateRecoveryParams {
  newOwner: PublicKey;
}

export interface InitiateRecoveryResult {
  recoveryRequest: PublicKey;
  nonce: number;
  executeAfter: number;
  transactionSignature: TransactionSignature;
}

export interface ApproveRecoveryParams {
  recoveryRequest: PublicKey;
}

export interface ApproveRecoveryResult {
  approvalCount: number;
  threshold: number;
  transactionSignature: TransactionSignature;
}

export interface ExecuteRecoveryResult {
  previousOwner: PublicKey;
  newOwner: PublicKey;
  transactionSignature: TransactionSignature;
}

export interface CancelRecoveryResult {
  transactionSignature: TransactionSignature;
}

export interface WithdrawSolParams {
  amount: number; // lamports
  recipient: PublicKey;
}

export interface WithdrawSolResult {
  transactionSignature: TransactionSignature;
}

// ============================================================================
// Event Types (mirroring Anchor program events)
// ============================================================================

export interface WalletInitializedEvent {
  wallet: PublicKey;
  owner: PublicKey;
  vault: PublicKey;
}

export interface RecoveryPolicyUpdatedEvent {
  wallet: PublicKey;
  policyVersion: number;
  threshold: number;
  guardianCount: number;
  delaySeconds: number;
}

export interface RecoveryInitiatedEvent {
  wallet: PublicKey;
  request: PublicKey;
  newOwner: PublicKey;
  nonce: number;
  executeAfter: number;
}

export interface GuardianApprovedEvent {
  wallet: PublicKey;
  request: PublicKey;
  guardian: PublicKey;
  approvalCount: number;
  threshold: number;
}

export interface RecoveryCancelledEvent {
  wallet: PublicKey;
  request: PublicKey;
  cancelledBy: PublicKey;
}

export interface RecoveryExecutedEvent {
  wallet: PublicKey;
  request: PublicKey;
  previousOwner: PublicKey;
  newOwner: PublicKey;
  nonce: number;
}

export interface SolWithdrawnEvent {
  wallet: PublicKey;
  recipient: PublicKey;
  amount: number; // lamports
}

export type ReKeyEvent = 
  | { type: 'wallet_initialized'; data: WalletInitializedEvent }
  | { type: 'policy_updated'; data: RecoveryPolicyUpdatedEvent }
  | { type: 'recovery_initiated'; data: RecoveryInitiatedEvent }
  | { type: 'guardian_approved'; data: GuardianApprovedEvent }
  | { type: 'recovery_cancelled'; data: RecoveryCancelledEvent }
  | { type: 'recovery_executed'; data: RecoveryExecutedEvent }
  | { type: 'sol_withdrawn'; data: SolWithdrawnEvent };

// ============================================================================
// Transaction Types
// ============================================================================

export interface SignedTransaction {
  transaction: Transaction;
  signature: TransactionSignature;
}

export interface TransactionRequest {
  instruction: string;
  params: Record<string, any>;
  signers: PublicKey[];
}

export interface TransactionResult {
  success: boolean;
  signature?: TransactionSignature;
  error?: string;
  blockhash?: string;
  slot?: number;
}

// ============================================================================
// Client Types
// ============================================================================

export interface ReKeyClient {
  // Core methods
  initializeWallet(params: InitializeWalletParams): Promise<InitializeWalletResult>;
  updateRecoveryPolicy(params: UpdateRecoveryPolicyParams): Promise<UpdateRecoveryPolicyResult>;
  initiateRecovery(params: InitiateRecoveryParams): Promise<InitiateRecoveryResult>;
  approveRecovery(params: ApproveRecoveryParams): Promise<ApproveRecoveryResult>;
  executeRecovery(recoveryRequest: PublicKey): Promise<ExecuteRecoveryResult>;
  cancelRecovery(recoveryRequest: PublicKey): Promise<CancelRecoveryResult>;
  withdrawSol(params: WithdrawSolParams): Promise<WithdrawSolResult>;
  
  // Read-only methods
  getWalletConfig(wallet: PublicKey): Promise<WalletConfig | null>;
  getVault(walletConfig: PublicKey): Promise<Vault | null>;
  getRecoveryRequest(walletConfig: PublicKey, nonce: number): Promise<RecoveryRequest | null>;
  getAllRecoveryRequests(walletConfig: PublicKey): Promise<RecoveryRequest[]>;
  
  // Account derivation
  findWalletConfigPDA(owner: PublicKey): Promise<PublicKey>;
  findVaultPDA(walletConfig: PublicKey): Promise<PublicKey>;
  findRecoveryRequestPDA(walletConfig: PublicKey, nonce: number): Promise<PublicKey>;
  
  // Event listening
  onEvent(callback: (event: ReKeyEvent) => void): () => void;
  
  // Verification
  verifyTransaction(signature: TransactionSignature): Promise<TransactionResult>;
  verifyAccountState(account: PublicKey, expected: any): Promise<boolean>;
  
  // Health check
  healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message?: string }>;
}

// ============================================================================
// Error Types
// ============================================================================

export class ReKeyError extends Error {
  constructor(
    public readonly code: ReKeyErrorCode,
    message: string,
    public readonly details?: any,
    public readonly transactionSignature?: TransactionSignature
  ) {
    super(message);
    this.name = 'ReKeyError';
  }
}

export type ReKeyErrorCode = 
  | 'PROGRAM_NOT_FOUND'
  | 'ACCOUNT_NOT_FOUND'
  | 'INVALID_PARAMETERS'
  | 'TRANSACTION_FAILED'
  | 'SIGNATURE_FAILED'
  | 'INSUFFICIENT_FUNDS'
  | 'RPC_ERROR'
  | 'TIMEOUT'
  | 'INVALID_OWNER'
  | 'UNAUTHORIZED'
  | 'INVALID_SIGNATURE'
  | 'ACCOUNT_ALREADY_EXISTS'
  | 'RECOVERY_NOT_FOUND'
  | 'INVALID_RECOVERY_STATE'
  | 'THRESHOLD_NOT_MET'
  | 'TIMELOCK_ACTIVE'
  | 'RECOVERY_EXPIRED'
  | 'DUPLICATE_APPROVAL';

// ============================================================================
// Input Validation Schemas
// ============================================================================

export const PublicKeySchema = z.custom<PublicKey>(
  val => val instanceof PublicKey,
  'Invalid PublicKey'
);

fromZodPublicKey(pubkeyString: string): PublicKey {
  return new PublicKey(pubkeyString);
}

export const InitializeWalletParamsSchema = z.object({
  guardians: z.array(PublicKeySchema).min(1).max(MAX_GUARDIANS),
  threshold: z.number().min(1).max(MAX_GUARDIANS),
  delaySeconds: z.number().min(60).max(2592000), // 60s to 30 days
});

export const UpdateRecoveryPolicyParamsSchema = z.object({
  guardians: z.array(PublicKeySchema).min(1).max(MAX_GUARDIANS),
  threshold: z.number().min(1).max(MAX_GUARDIANS),
  delaySeconds: z.number().min(60).max(2592000),
});

export const InitiateRecoveryParamsSchema = z.object({
  newOwner: PublicKeySchema,
});

// ============================================================================
// Query Types
// ============================================================================

export interface WalletQuery {
  pubkey: PublicKey;
  owner: PublicKey;
  vault: PublicKey;
  balanceLamports: number;
  balanceSol: number;
  config: WalletConfig | null;
  recoveryRequests: RecoveryRequest[];
  guardianCount: number;
  threshold: number;
  delaySeconds: number;
}

export interface RecoveryQuery {
  request: RecoveryRequest;
  walletConfig: WalletConfig;
  guardianApprovals: PublicKey[];
  timeRemaining: number; // seconds
  canExecute: boolean;
  canCancel: boolean;
}

// ============================================================================
// Constant Values from Program
// ============================================================================

export const PROGRAM_CONSTANTS = {
  MAX_GUARDIANS,
  MIN_DELAY_SECONDS: 60,
  MAX_DELAY_SECONDS: 2592000, // 30 days
  REQUEST_GRACE_SECONDS: 604800, // 7 days
};
