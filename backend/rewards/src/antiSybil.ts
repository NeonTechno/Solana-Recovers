// ReKey Lifeline Rewards - Anti-Sybil System
// Implements Sybil detection and rate limiting

import {
  RewardsConfig,
  AntiSybilCheck,
  RateLimitStatus,
  RewardsError,
  RewardsErrorCode,
} from './types';

// ============================================================================
// Anti-Sybil System Class
// ============================================================================

interface AntiSybilConfig {
  maxPointsPerWallet: number;
  rateLimits: {
    actionsPerHour: number;
    pointsPerHour: number;
  };
  verificationRequired: boolean;
}

interface RateLimitState {
  actions: Array<{ timestamp: number; points: number }>;
  suspended: boolean;
  suspendedAt?: number;
  suspendedReason?: string;
  suspendedBy?: string;
}

export class AntiSybilSystem {
  private config: AntiSybilConfig;
  private rateLimits: Map<string, RateLimitState>;
  private oneHour = 60 * 60 * 1000;

  constructor(config: AntiSybilConfig) {
    this.config = config;
    this.rateLimits = new Map();
  }

  // ============================================================================
  // Sybil Detection
  // ============================================================================

  /**
   * Check if a wallet is a Sybil
   */
  async check(walletAddress: string): Promise<AntiSybilCheck> {
    const reasons: string[] = [];
    let confidence = 0;
    
    // Check 1: Wallet address pattern (simplified)
    // In production, use more sophisticated analysis
    const addressAnalysis = this.analyzeAddress(walletAddress);
    if (addressAnalysis.isSuspicious) {
      reasons.push(addressAnalysis.reason);
      confidence += addressAnalysis.confidence;
    }
    
    // Check 2: Rate limit violations
    const rateLimit = await this.checkRateLimit(walletAddress);
    if (rateLimit.actionsRemaining <= 0) {
      reasons.push('Exceeded action rate limit');
      confidence += 0.3;
    }
    
    // Check 3: Suspended accounts
    const state = this.rateLimits.get(walletAddress);
    if (state?.suspended) {
      reasons.push(`Account suspended: ${state.suspendedReason}`);
      confidence += 0.5;
    }
    
    // Normalize confidence
    confidence = Math.min(confidence, 1);
    
    const isSybil = confidence > 0.7; // Threshold
    
    return {
      walletAddress,
      isSybil,
      confidence,
      reasons,
      evidence: {
        addressAnalysis,
        rateLimit,
        suspended: state?.suspended || false,
      },
      checkedAt: Date.now(),
    };
  }

  /**
   * Analyze wallet address for suspicious patterns
   */
  private analyzeAddress(walletAddress: string): {
    isSuspicious: boolean;
    reason: string;
    confidence: number;
  } {
    // In production, implement actual analysis
    // For demo, assume most addresses are legitimate
    
    // Check for sequential addresses (simplified)
    // This is a placeholder
    return {
      isSuspicious: false,
      reason: '',
      confidence: 0,
    };
  }

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  /**
   * Check rate limit status for a wallet
   */
  async checkRateLimit(walletAddress: string): Promise<RateLimitStatus> {
    const state = this.rateLimits.get(walletAddress);
    const now = Date.now();
    
    // Get actions within the last hour
    const recentActions = state?.actions.filter(
      a => now - a.timestamp < this.oneHour
    ) || [];
    
    // Count actions and points
    const actionCount = recentActions.length;
    const pointsCount = recentActions.reduce((sum, a) => sum + a.points, 0);
    
    // Calculate remaining
    const actionsRemaining = Math.max(
      0,
      this.config.rateLimits.actionsPerHour - actionCount
    );
    const pointsRemaining = Math.max(
      0,
      this.config.rateLimits.pointsPerHour - pointsCount
    );
    
    // Calculate reset time
    const oldestAction = recentActions.length > 0 
      ? recentActions.reduce((min, a) => Math.min(min, a.timestamp), now)
      : now;
    const resetAt = oldestAction + this.oneHour;
    
    return {
      walletAddress,
      actionsRemaining,
      pointsRemaining,
      resetAt,
    };
  }

  /**
   * Record an action for rate limiting
   */
  async recordAction(walletAddress: string, pointsEarned: number): Promise<void> {
    if (!this.rateLimits.has(walletAddress)) {
      this.rateLimits.set(walletAddress, {
        actions: [],
        suspended: false,
      });
    }
    
    const state = this.rateLimits.get(walletAddress)!;
    
    // Add action
    state.actions.push({
      timestamp: Date.now(),
      points: pointsEarned,
    });
    
    // Clean up old actions
    const now = Date.now();
    state.actions = state.actions.filter(
      a => now - a.timestamp < this.oneHour * 2
    ); // Keep 2 hours for analysis
  }

  /**
   * Reset rate limit for a wallet
   */
  async resetRateLimit(walletAddress: string): Promise<void> {
    if (this.rateLimits.has(walletAddress)) {
      this.rateLimits.get(walletAddress)!.actions = [];
    }
  }

  // ============================================================================
  // Account Management
  // ============================================================================

  /**
   * Suspend an account
   */
  async suspendAccount(
    walletAddress: string,
    reason: string,
    suspendedBy?: string
  ): Promise<void> {
    if (!this.rateLimits.has(walletAddress)) {
      this.rateLimits.set(walletAddress, {
        actions: [],
        suspended: true,
        suspendedAt: Date.now(),
        suspendedReason: reason,
        suspendedBy,
      });
    } else {
      const state = this.rateLimits.get(walletAddress)!;
      state.suspended = true;
      state.suspendedAt = Date.now();
      state.suspendedReason = reason;
      state.suspendedBy = suspendedBy;
    }
  }

  /**
   * Unsuspend an account
   */
  async unsuspendAccount(walletAddress: string): Promise<void> {
    const state = this.rateLimits.get(walletAddress);
    if (state) {
      state.suspended = false;
      state.suspendedAt = undefined;
      state.suspendedReason = undefined;
      state.suspendedBy = undefined;
    }
  }

  /**
   * Check if account is suspended
   */
  async isSuspended(walletAddress: string): Promise<boolean> {
    const state = this.rateLimits.get(walletAddress);
    return state?.suspended || false;
  }

  // ============================================================================
  // Data Export/Import
  // ============================================================================

  exportData(): Map<string, RateLimitState> {
    return this.rateLimits;
  }

  importData(data: Map<string, RateLimitState>): void {
    this.rateLimits = new Map(data);
  }
}
