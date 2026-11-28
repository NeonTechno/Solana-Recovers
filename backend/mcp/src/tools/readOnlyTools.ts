// ReKey MCP Server - Read-Only Tools
// Implements all read-only MCP tools for the ReKey protocol

import { z } from 'zod';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  MCPError,
  MCPErrorCode,
  WalletStatus,
  RecoveryPolicy,
  GuardianInfo,
  RecoveryHistory,
  RecoveryRequest,
  RecoveryReadiness,
  ResilienceScore,
  LifelinePoints,
  SimulationResult,
  WalletAddress,
  RecoveryStatus,
  GetWalletStatusInputSchema,
  GetRecoveryPolicyInputSchema,
  ListGuardiansInputSchema,
  GetRecoveryHistoryInputSchema,
  CheckRecoveryReadinessInputSchema,
  SimulateRecoveryInputSchema,
  GetResilienceScoreInputSchema,
  GetLifelinePointsInputSchema,
  SimulationRequestSchema,
} from '../types';
import { AuditLogger } from '../audit';
import { RateLimiter } from '../rateLimiter';
import { AuthContext } from '../types';

// ============================================================================
// Tool Context Interface
// ============================================================================

export interface ToolContext {
  connection: Connection;
  programId: string;
  auditLogger: AuditLogger;
  rateLimiter: RateLimiter;
  authContext: AuthContext;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate wallet address format
 */
function validateWalletAddress(address: string): PublicKey {
  try {
    return new PublicKey(address);
  } catch (e) {
    throw new MCPError(
      'INVALID_INPUT',
      `Invalid wallet address: ${address}`,
      { address, error: e instanceof Error ? e.message : String(e) }
    );
  }
}

/**
 * Get wallet SOL balance
 */
async function getWalletBalance(
  connection: Connection,
  walletAddress: string
): Promise<{ lamports: number; sol: number }> {
  const pubkey = validateWalletAddress(walletAddress);
  const lamports = await connection.getBalance(pubkey, 'confirmed');
  return {
    lamports,
    sol: lamports / 1_000_000_000, // Convert lamports to SOL
  };
}

/**
 * Calculate resilience score based on various factors
 */
function calculateResilienceScore(policy?: RecoveryPolicy): ResilienceScore {
  if (!policy) {
    return {
      walletAddress: '',
      score: 0,
      factors: {
        guardianCount: 0,
        threshold: 0,
        delayConfig: 0,
        guardianDiversity: 0,
        policyActivity: 0,
        simulationHistory: 0,
      },
      grade: 'F',
      timestamp: Date.now(),
    };
  }

  const { guardians, threshold, delaySeconds } = policy;
  const guardianCount = guardians.length;

  // Calculate factor scores (0-1)
  const guardianCountScore = Math.min(guardianCount / 5, 1); // Max 5 guardians
  const thresholdScore = threshold <= guardianCount ? threshold / guardianCount : 0;
  const delayScore = Math.min(Math.max(delaySeconds / 86400, 0), 1); // 1 day is ideal
  const guardianDiversityScore = guardianCount >= 3 ? 1 : guardianCount / 3;

  // Calculate overall score
  const rawScore = (
    guardianCountScore * 0.25 +
    thresholdScore * 0.2 +
    delayScore * 0.2 +
    guardianDiversityScore * 0.2 +
    0.15 // Base score for having a policy
  );

  const score = Math.round(rawScore * 100);

  // Assign grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';

  return {
    walletAddress: policy.walletAddress,
    score,
    factors: {
      guardianCount: guardianCountScore,
      threshold: thresholdScore,
      delayConfig: delayScore,
      guardianDiversity: guardianDiversityScore,
      policyActivity: 0,
      simulationHistory: 0,
    },
    grade,
    timestamp: Date.now(),
  };
}

/**
 * Check recovery readiness
 */
function checkRecoveryReadiness(policy?: RecoveryPolicy): RecoveryReadiness {
  if (!policy) {
    return {
      walletAddress: '',
      isReady: false,
      requirements: [
        {
          id: 'policy_configured',
          description: 'Recovery policy must be configured',
          isMet: false,
        },
        {
          id: 'guardians_set',
          description: 'At least one guardian must be configured',
          isMet: false,
        },
        {
          id: 'threshold_valid',
          description: 'Approval threshold must be valid',
          isMet: false,
        },
      ],
      score: 0,
      recommendations: [
        'Configure your recovery policy with trusted guardians',
        'Set a reasonable approval threshold',
        'Ensure your guardians are trusted and available',
      ],
    };
  }

  const { guardians, threshold } = policy;
  const isReady = guardians.length >= threshold && threshold > 0;

  const requirements = [
    {
      id: 'policy_configured',
      description: 'Recovery policy must be configured',
      isMet: true,
    },
    {
      id: 'guardians_set',
      description: `At least ${threshold} guardian(s) must be configured`,
      isMet: guardians.length >= threshold,
      details: `${guardians.length} of ${threshold} configured`,
    },
    {
      id: 'threshold_valid',
      description: 'Approval threshold must be valid',
      isMet: threshold > 0 && threshold <= guardians.length,
      details: `Threshold: ${threshold} of ${guardians.length}`,
    },
    {
      id: 'timelock_configured',
      description: 'Recovery timelock must be configured',
      isMet: policy.delaySeconds >= 60,
    },
  ];

  const score = Math.round(
    (requirements.filter(r => r.isMet).length / requirements.length) * 100
  );

  const recommendations: string[] = [];
  if (!requirements[1].isMet) {
    recommendations.push(
      `Configure at least ${threshold} guardians to meet your threshold requirement`
    );
  }
  if (!requirements[2].isMet) {
    recommendations.push(
      'Adjust your threshold to be between 1 and the number of guardians'
    );
  }

  return {
    walletAddress: policy.walletAddress,
    isReady,
    requirements,
    score,
    recommendations,
  };
}

// ============================================================================
// Simulated Data Store
// In production, this would query the Solana program state
// ============================================================================

interface WalletState {
  address: string;
  policy?: RecoveryPolicy;
  history: RecoveryRequest[];
  lifelinePoints: number;
  achievements: string[];
}

const simulatedWallets: Map<string, WalletState> = new Map();

function getWalletState(walletAddress: string): WalletState {
  // Initialize if not exists
  if (!simulatedWallets.has(walletAddress)) {
    simulatedWallets.set(walletAddress, {
      address: walletAddress,
      history: [],
      lifelinePoints: 0,
      achievements: [],
    });
  }
  return simulatedWallets.get(walletAddress)!;
}

function getSamplePolicy(walletAddress: string): RecoveryPolicy {
  // Generate deterministic sample data based on wallet address
  const hash = walletAddress.split('').reduce((a, b) => {
    return (a * 31 + b.charCodeAt(0)) % 1000000;
  }, 0);
  
  const guardians = [
    new PublicKey('Guardian1' + walletAddress.slice(0, 20)).toBase58(),
    new PublicKey('Guardian2' + walletAddress.slice(20, 40)).toBase58(),
    new PublicKey('Guardian3' + walletAddress.slice(10, 30)).toBase58(),
  ];
  
  return {
    walletAddress,
    guardians,
    threshold: 2,
    delaySeconds: 86400, // 24 hours
    policyVersion: 1,
    initialOwner: walletAddress,
    currentOwner: walletAddress,
    nextNonce: 0,
  };
}

// ============================================================================
// Read-Only Tools Implementation
// ============================================================================

export const readOnlyTools = {
  // Get wallet status
  get_wallet_status: {
    name: 'get_wallet_status',
    description: 'Get the current status of a wallet including balance and initialization state',
    inputSchema: GetWalletStatusInputSchema,
    handler: async (
      input: z.infer<typeof GetWalletStatusInputSchema>,
      context: ToolContext
    ): Promise<WalletStatus> => {
      const { walletAddress, network } = input;
      const { connection, auditLogger, authContext } = context;
      
      // Validate wallet address
      validateWalletAddress(walletAddress);
      
      // Get balance
      const { lamports, sol } = await getWalletBalance(connection, walletAddress);
      
      // Check if wallet is initialized in our system
      const walletState = getWalletState(walletAddress);
      const isInitialized = walletState.policy !== undefined;
      
      const result: WalletStatus = {
        walletAddress,
        isInitialized,
        balanceLamports: lamports,
        balanceSol: sol,
        lastUpdated: Date.now(),
        network,
      };
      
      // Add vault address if policy exists
      if (walletState.policy) {
        // Simulate vault derivation
        const vaultSeed = Buffer.from('vault', 'utf-8');
        const walletPubkey = new PublicKey(walletAddress);
        const vaultPubkey = PublicKey.findProgramAddressSync(
          [vaultSeed, walletPubkey.toBuffer()],
          new PublicKey(context.programId)
        )[0];
        result.vaultAddress = vaultPubkey.toBase58();
        result.owner = walletState.policy.currentOwner;
      }
      
      // Audit log
      await auditLogger.log({
        id: `wallet-status-${Date.now()}`,
        timestamp: Date.now(),
        level: 'info',
        action: 'get_wallet_status',
        tool: 'get_wallet_status',
        userId: authContext.userId,
        walletAddress,
        sessionId: authContext.sessionId,
        input: { walletAddress, network },
        output: { isInitialized, balanceLamports: lamports },
      });
      
      return result;
    },
  },

  // Get recovery policy
  get_recovery_policy: {
    name: 'get_recovery_policy',
    description: 'Get the current recovery policy for a wallet',
    inputSchema: GetRecoveryPolicyInputSchema,
    handler: async (
      input: z.infer<typeof GetRecoveryPolicyInputSchema>,
      context: ToolContext
    ): Promise<RecoveryPolicy> => {
      const { walletAddress } = input;
      const { auditLogger, authContext } = context;
      
      validateWalletAddress(walletAddress);
      
      const walletState = getWalletState(walletAddress);
      
      // Return sample policy if not configured, or use the stored one
      const policy = walletState.policy || getSamplePolicy(walletAddress);
      
      await auditLogger.log({
        id: `policy-get-${Date.now()}`,
        timestamp: Date.now(),
        level: 'info',
        action: 'get_recovery_policy',
        tool: 'get_recovery_policy',
        userId: authContext.userId,
        walletAddress,
        sessionId: authContext.sessionId,
        input: { walletAddress },
        output: { policyVersion: policy.policyVersion },
      });
      
      return policy;
    },
  },

  // List guardians
  list_guardians: {
    name: 'list_guardians',
    description: 'List all guardians for a wallet with their verification status',
    inputSchema: ListGuardiansInputSchema,
    handler: async (
      input: z.infer<typeof ListGuardiansInputSchema>,
      context: ToolContext
    ): Promise<{ guardians: GuardianInfo[] }> => {
      const { walletAddress } = input;
      const { auditLogger, authContext } = context;
      
      validateWalletAddress(walletAddress);
      
      const walletState = getWalletState(walletAddress);
      const policy = walletState.policy || getSamplePolicy(walletAddress);
      
      const guardians: GuardianInfo[] = policy.guardians.map((pubkey, index) => ({
        pubkey,
        label: `Guardian ${index + 1}`,
        isVerified: true, // In production, verify on-chain
        verificationMethod: 'on-chain',
        lastVerified: Date.now(),
      }));
      
      await auditLogger.log({
        id: `guardians-list-${Date.now()}`,
        timestamp: Date.now(),
        level: 'info',
        action: 'list_guardians',
        tool: 'list_guardians',
        userId: authContext.userId,
        walletAddress,
        sessionId: authContext.sessionId,
        input: { walletAddress },
        output: { guardianCount: guardians.length },
      });
      
      return { guardians };
    },
  },

  // Get recovery history
  get_recovery_history: {
    name: 'get_recovery_history',
    description: 'Get the recovery request history for a wallet',
    inputSchema: GetRecoveryHistoryInputSchema,
    handler: async (
      input: z.infer<typeof GetRecoveryHistoryInputSchema>,
      context: ToolContext
    ): Promise<RecoveryHistory> => {
      const { walletAddress, limit, offset } = input;
      const { auditLogger, authContext } = context;
      
      validateWalletAddress(walletAddress);
      
      const walletState = getWalletState(walletAddress);
      const requests = walletState.history.slice(offset, offset + limit);
      
      const successfulRecoveries = requests.filter(
        r => r.status === 'executed'
      ).length;
      
      const result: RecoveryHistory = {
        walletAddress,
        requests,
        totalRequests: walletState.history.length,
        successfulRecoveries,
      };
      
      await auditLogger.log({
        id: `history-get-${Date.now()}`,
        timestamp: Date.now(),
        level: 'info',
        action: 'get_recovery_history',
        tool: 'get_recovery_history',
        userId: authContext.userId,
        walletAddress,
        sessionId: authContext.sessionId,
        input: { walletAddress, limit, offset },
        output: { requestCount: requests.length, totalRequests: walletState.history.length },
      });
      
      return result;
    },
  },

  // Check recovery readiness
  check_recovery_readiness: {
    name: 'check_recovery_readiness',
    description: 'Check if a wallet is ready for recovery and what requirements need to be met',
    inputSchema: CheckRecoveryReadinessInputSchema,
    handler: async (
      input: z.infer<typeof CheckRecoveryReadinessInputSchema>,
      context: ToolContext
    ): Promise<RecoveryReadiness> => {
      const { walletAddress } = input;
      const { auditLogger, authContext } = context;
      
      validateWalletAddress(walletAddress);
      
      const walletState = getWalletState(walletAddress);
      const policy = walletState.policy || getSamplePolicy(walletAddress);
      
      const readiness = checkRecoveryReadiness(policy);
      
      await auditLogger.log({
        id: `readiness-check-${Date.now()}`,
        timestamp: Date.now(),
        level: 'info',
        action: 'check_recovery_readiness',
        tool: 'check_recovery_readiness',
        userId: authContext.userId,
        walletAddress,
        sessionId: authContext.sessionId,
        input: { walletAddress },
        output: { isReady: readiness.isReady, score: readiness.score },
      });
      
      return readiness;
    },
  },

  // Simulate recovery
  simulate_recovery: {
    name: 'simulate_recovery',
    description: 'Simulate a recovery request to understand the flow without creating on-chain state',
    inputSchema: SimulateRecoveryInputSchema,
    handler: async (
      input: z.infer<typeof SimulateRecoveryInputSchema>,
      context: ToolContext
    ): Promise<SimulationResult> => {
      const { walletAddress, newOwner, guardians } = input;
      const { auditLogger, authContext } = context;
      
      validateWalletAddress(walletAddress);
      validateWalletAddress(newOwner);
      guardians.forEach(g => validateWalletAddress(g));
      
      const walletState = getWalletState(walletAddress);
      const policy = walletState.policy || getSamplePolicy(walletAddress);
      
      const now = Date.now();
      const approvalsNeeded = policy.threshold;
      const approvalsReceived = Math.min(guardians.length, approvalsNeeded);
      const thresholdMet = approvalsReceived >= approvalsNeeded;
      const timelockStartsAt = now / 1000; // Convert to seconds
      const recoveryExecutableAt = timelockStartsAt + policy.delaySeconds;
      
      const warnings: string[] = [];
      if (!thresholdMet) {
        warnings.push(
          `Threshold not met: ${approvalsReceived} of ${approvalsNeeded} approvals required`
        );
      }
      
      if (guardians.some(g => g === newOwner)) {
        warnings.push('Warning: New owner is also a guardian');
      }
      
      const steps = [
        {
          step: 1,
          description: 'Recovery request initiated',
          status: 'completed' as const,
          timestamp: now,
        },
        {
          step: 2,
          description: `Guardian approvals (${approvalsReceived}/${approvalsNeeded})`,
          status: thresholdMet ? 'completed' : 'pending' as const,
          timestamp: now,
        },
        {
          step: 3,
          description: `Timelock period (${policy.delaySeconds / 86400} days)`,
          status: thresholdMet ? 'pending' : 'skipped' as const,
          timestamp: now,
        },
        {
          step: 4,
          description: 'Recovery execution',
          status: thresholdMet ? 'pending' : 'skipped' as const,
          timestamp: now,
        },
      ];
      
      const result: SimulationResult = {
        walletAddress,
        newOwner,
        thresholdMet,
        approvalsNeeded,
        approvalsReceived,
        timelockStartsAt,
        recoveryExecutableAt,
        steps,
        warnings,
      };
      
      await auditLogger.log({
        id: `simulation-${Date.now()}`,
        timestamp: Date.now(),
        level: 'info',
        action: 'simulate_recovery',
        tool: 'simulate_recovery',
        userId: authContext.userId,
        walletAddress,
        sessionId: authContext.sessionId,
        input: { walletAddress, newOwner, guardians: guardians.length },
        output: { thresholdMet, warnings: warnings.length },
      });
      
      return result;
    },
  },

  // Get resilience score
  get_resilience_score: {
    name: 'get_resilience_score',
    description: 'Calculate the resilience score for a wallet based on its recovery configuration',
    inputSchema: GetResilienceScoreInputSchema,
    handler: async (
      input: z.infer<typeof GetResilienceScoreInputSchema>,
      context: ToolContext
    ): Promise<ResilienceScore> => {
      const { walletAddress } = input;
      const { auditLogger, authContext } = context;
      
      validateWalletAddress(walletAddress);
      
      const walletState = getWalletState(walletAddress);
      const policy = walletState.policy || getSamplePolicy(walletAddress);
      
      const score = calculateResilienceScore(policy);
      
      await auditLogger.log({
        id: `resilience-get-${Date.now()}`,
        timestamp: Date.now(),
        level: 'info',
        action: 'get_resilience_score',
        tool: 'get_resilience_score',
        userId: authContext.userId,
        walletAddress,
        sessionId: authContext.sessionId,
        input: { walletAddress },
        output: { score: score.score, grade: score.grade },
      });
      
      return score;
    },
  },

  // Get lifeline points
  get_lifeline_points: {
    name: 'get_lifeline_points',
    description: 'Get the current lifeline points balance and achievements for a wallet',
    inputSchema: GetLifelinePointsInputSchema,
    handler: async (
      input: z.infer<typeof GetLifelinePointsInputSchema>,
      context: ToolContext
    ): Promise<LifelinePoints> => {
      const { walletAddress } = input;
      const { auditLogger, authContext } = context;
      
      validateWalletAddress(walletAddress);
      
      const walletState = getWalletState(walletAddress);
      
      // Sample achievements
      const achievements = [
        {
          id: 'wallet_init',
          name: 'Wallet Initialized',
          points: 100,
          earnedAt: Date.now() - 86400000,
          description: 'Successfully initialized your ReKey wallet',
        },
        {
          id: 'policy_configured',
          name: 'Recovery Policy Configured',
          points: 150,
          earnedAt: Date.now() - 43200000,
          description: 'Configured guardian policy with threshold',
        },
      ];
      
      // Sample points calculation
      const totalPoints = achievements.reduce((sum, a) => sum + a.points, 0);
      const currentStreak = 2;
      const longestStreak = 5;
      
      const result: LifelinePoints = {
        walletAddress,
        totalPoints,
        currentStreak,
        longestStreak,
        achievements: achievements as any[], // Type assertion for demo
        lastActivity: Date.now(),
      };
      
      await auditLogger.log({
        id: `points-get-${Date.now()}`,
        timestamp: Date.now(),
        level: 'info',
        action: 'get_lifeline_points',
        tool: 'get_lifeline_points',
        userId: authContext.userId,
        walletAddress,
        sessionId: authContext.sessionId,
        input: { walletAddress },
        output: { totalPoints, achievementCount: achievements.length },
      });
      
      return result;
    },
  },
};

// ============================================================================
// Export all tools
// ============================================================================

export type ReadOnlyTool = typeof readOnlyTools[keyof typeof readOnlyTools];
export type ReadOnlyToolNames = keyof typeof readOnlyTools;
