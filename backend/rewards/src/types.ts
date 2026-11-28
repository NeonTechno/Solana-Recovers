// ReKey Lifeline Rewards - Types

import { z } from 'zod';
import { PublicKey } from '@solana/web3.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface RewardsConfig {
  // Points configuration
  points: {
    walletInitialization: number;
    policyConfiguration: number;
    perGuardianAdded: number;
    recoverySimulation: number;
    securityEducation: number;
    documentationContribution: number;
    integrationContribution: number;
    verifiedGuardian: number;
    streakBonus: number;
    dailyActivity: number;
  };
  
  // Anti-Sybil configuration
  antiSybil: {
    maxPointsPerWallet: number;
    rateLimits: {
      actionsPerHour: number;
      pointsPerHour: number;
    };
    verificationRequired: boolean;
  };
  
  // Achievement configuration
  achievements: AchievementConfig[];
  
  // Resilience score configuration
  resilience: {
    baseScore: number;
    maxScore: number;
    factors: {
      guardianCount: { weight: number; max: number };
      threshold: { weight: number; max: number };
      delay: { weight: number; max: number };
      guardianDiversity: { weight: number; max: number };
      activity: { weight: number; max: number };
    };
  };
  
  // Storage configuration
  storage: {
    type: 'memory' | 'file' | 'database';
    path?: string;
  };
}

export const DEFAULT_REWARDS_CONFIG: RewardsConfig = {
  points: {
    walletInitialization: 100,
    policyConfiguration: 150,
    perGuardianAdded: 50,
    recoverySimulation: 25,
    securityEducation: 100,
    documentationContribution: 200,
    integrationContribution: 300,
    verifiedGuardian: 30,
    streakBonus: 10,
    dailyActivity: 5,
  },
  antiSybil: {
    maxPointsPerWallet: 10000,
    rateLimits: {
      actionsPerHour: 10,
      pointsPerHour: 500,
    },
    verificationRequired: true,
  },
  achievements: [
    {
      id: 'first_steps',
      name: 'First Steps',
      description: 'Initialize your ReKey wallet',
      points: 100,
      criteria: {
        type: 'event',
        eventType: 'wallet_initialized',
      },
    },
    {
      id: 'security_setup',
      name: 'Security Setup',
      description: 'Configure your recovery policy',
      points: 150,
      criteria: {
        type: 'event',
        eventType: 'policy_configured',
      },
    },
    {
      id: 'trusted_network',
      name: 'Trusted Network',
      description: 'Add 3 trusted guardians',
      points: 100,
      criteria: {
        type: 'threshold',
        metric: 'guardian_count',
        threshold: 3,
        comparison: '>=',
      },
    },
    {
      id: 'tested_recovery',
      name: 'Tested Recovery',
      description: 'Complete a recovery simulation',
      points: 50,
      criteria: {
        type: 'event',
        eventType: 'simulation_completed',
      },
    },
    {
      id: 'security_educated',
      name: 'Security Educated',
      description: 'Complete security education',
      points: 100,
      criteria: {
        type: 'event',
        eventType: 'education_completed',
      },
    },
    {
      id: 'verified_contributor',
      name: 'Verified Contributor',
      description: 'Make a verified security contribution',
      points: 200,
      criteria: {
        type: 'event',
        eventType: 'security_contribution_verified',
      },
    },
    {
      id: 'documentation_helper',
      name: 'Documentation Helper',
      description: 'Contribute approved documentation',
      points: 200,
      criteria: {
        type: 'event',
        eventType: 'documentation_approved',
      },
    },
    {
      id: 'integration_builder',
      name: 'Integration Builder',
      description: 'Build an approved integration',
      points: 300,
      criteria: {
        type: 'event',
        eventType: 'integration_approved',
      },
    },
    {
      id: 'streak_7_days',
      name: 'Weekly Streak',
      description: '7-day activity streak',
      points: 50,
      criteria: {
        type: 'streak',
        days: 7,
      },
    },
    {
      id: 'streak_30_days',
      name: 'Monthly Streak',
      description: '30-day activity streak',
      points: 200,
      criteria: {
        type: 'streak',
        days: 30,
      },
    },
  ],
  resilience: {
    baseScore: 0,
    maxScore: 100,
    factors: {
      guardianCount: { weight: 0.25, max: 1 },
      threshold: { weight: 0.20, max: 1 },
      delay: { weight: 0.20, max: 1 },
      guardianDiversity: { weight: 0.15, max: 1 },
      activity: { weight: 0.20, max: 1 },
    },
  },
  storage: {
    type: 'memory',
  },
};

// ============================================================================
// Event Types
// ============================================================================

export type EventType = 
  | 'wallet_initialized'
  | 'policy_configured'
  | 'guardian_added'
  | 'guardian_removed'
  | 'guardian_verified'
  | 'simulation_started'
  | 'simulation_completed'
  | 'education_started'
  | 'education_completed'
  | 'security_contribution'
  | 'documentation_contribution'
  | 'integration_contribution'
  | 'daily_activity';

export interface RewardsEvent {
  id: string;
  type: EventType;
  walletAddress: string;
  timestamp: number;
  metadata?: Record<string, any>;
  points?: number;
  processed: boolean;
}

export const EventSchema = z.object({
  type: z.enum([
    'wallet_initialized',
    'policy_configured',
    'guardian_added',
    'guardian_removed',
    'guardian_verified',
    'simulation_started',
    'simulation_completed',
    'education_started',
    'education_completed',
    'security_contribution',
    'documentation_contribution',
    'integration_contribution',
    'daily_activity',
  ]),
  walletAddress: z.string(),
  metadata: z.record(z.any()).optional(),
});

export type CreateEventInput = z.infer<typeof EventSchema>;

// ============================================================================
// Points and Ledger Types
// ============================================================================

export interface PointsEntry {
  id: string;
  walletAddress: string;
  amount: number; // Can be positive or negative
  type: 'earn' | 'spend' | 'bonus' | 'penalty';
  source: string;
  timestamp: number;
  transactionId?: string;
  description: string;
}

export interface PointsBalance {
  walletAddress: string;
  totalPoints: number;
  availablePoints: number;
  lockedPoints: number;
  lastUpdated: number;
}

export interface TransactionHistory {
  walletAddress: string;
  transactions: PointsEntry[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Achievement Types
// ============================================================================

export interface AchievementConfig {
  id: string;
  name: string;
  description: string;
  points: number;
  criteria: AchievementCriteria;
}

export type AchievementCriteria = 
  | { type: 'event'; eventType: EventType }
  | { type: 'threshold'; metric: string; threshold: number; comparison: '>=' | '<=' | '>' | '<' | '==' }
  | { type: 'streak'; days: number }
  | { type: 'combined'; criteria: AchievementCriteria[]; operator: 'AND' | 'OR' };

export interface UserAchievement {
  id: string;
  achievementId: string;
  walletAddress: string;
  earnedAt: number;
  points: number;
  criteriaMet?: Record<string, any>;
}

// ============================================================================
// Resilience Score Types
// ============================================================================

export interface ResilienceFactor {
  name: string;
  score: number; // 0-1
  weight: number;
  description: string;
}

export interface ResilienceScore {
  walletAddress: string;
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: ResilienceFactor[];
  lastCalculated: number;
  history: ResilienceScore[];
}

// ============================================================================
// Anti-Sybil Types
// ============================================================================

export interface AntiSybilCheck {
  walletAddress: string;
  isSybil: boolean;
  confidence: number; // 0-1
  reasons: string[];
  evidence: Record<string, any>;
  checkedAt: number;
}

export interface RateLimitStatus {
  walletAddress: string;
  actionsRemaining: number;
  pointsRemaining: number;
  resetAt: number;
}

// ============================================================================
// Verification Types
// ============================================================================

export interface VerificationRequest {
  id: string;
  walletAddress: string;
  type: 'guardian' | 'contribution' | 'identity';
  data: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  submittedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  notes?: string;
}

export interface VerificationProof {
  id: string;
  walletAddress: string;
  verificationType: string;
  proofData: string; // Could be signature, hash, etc.
  verifiedAt: number;
  expiresAt?: number;
}

// ============================================================================
// Contribution Types
// ============================================================================

export type ContributionType = 
  | 'security_report'
  | 'code_contribution'
  | 'documentation'
  | 'tutorial'
  | 'translation'
  | 'community_support';

export interface Contribution {
  id: string;
  walletAddress: string;
  type: ContributionType;
  title: string;
  description: string;
  url?: string;
  submittedAt: number;
  status: 'pending' | 'reviewed' | 'approved' | 'rejected';
  pointsAwarded?: number;
  reviewedAt?: number;
  reviewedBy?: string;
  feedback?: string;
}

// ============================================================================
// Streak Types
// ============================================================================

export interface ActivityStreak {
  walletAddress: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: number;
  streakStartDate: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface RewardsResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  warnings?: string[];
  timestamp: number;
}

// ============================================================================
// Error Types
// ============================================================================

export class RewardsError extends Error {
  constructor(
    public readonly code: RewardsErrorCode,
    message: string,
    public readonly details?: any,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'RewardsError';
  }
}

export type RewardsErrorCode = 
  | 'INVALID_INPUT'
  | 'WALLET_NOT_FOUND'
  | 'DUPLICATE_EVENT'
  | 'RATE_LIMITED'
  | 'SYBIL_DETECTED'
  | 'VERIFICATION_REQUIRED'
  | 'ACCOUNT_SUSPENDED'
  | 'INSUFFICIENT_POINTS'
  | 'ACHIEVEMENT_ALREADY_EARNED'
  | 'INTERNAL_ERROR';

// ============================================================================
// Export Types
// ============================================================================

export type { PublicKey };
