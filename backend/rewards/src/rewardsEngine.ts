// ReKey Lifeline Rewards - Main Engine
// Implements the verifiable rewards system with points ledger

import crypto from 'crypto';
import { z } from 'zod';
import {
  RewardsConfig,
  DEFAULT_REWARDS_CONFIG,
  EventType,
  RewardsEvent,
  CreateEventInput,
  EventSchema,
  PointsEntry,
  PointsBalance,
  TransactionHistory,
  UserAchievement,
  ResilienceScore,
  AntiSybilCheck,
  RateLimitStatus,
  VerificationRequest,
  Contribution,
  ActivityStreak,
  AchievementConfig,
  RewardsError,
  RewardsErrorCode,
} from './types';
import { PointsLedger } from './pointsLedger';
import { AchievementManager } from './achievementManager';
import { ResilienceCalculator } from './resilienceCalculator';
import { AntiSybilSystem } from './antiSybil';
import { VerificationSystem } from './verification';

// ============================================================================
// Rewards Engine Class
// ============================================================================

export class RewardsEngine {
  private config: RewardsConfig;
  private pointsLedger: PointsLedger;
  private achievementManager: AchievementManager;
  private resilienceCalculator: ResilienceCalculator;
  private antiSybilSystem: AntiSybilSystem;
  private verificationSystem: VerificationSystem;
  
  // Event store
  private events: Map<string, RewardsEvent[]>;
  
  // Contribution store
  private contributions: Map<string, Contribution[]>;
  
  // Streak tracker
  private streaks: Map<string, ActivityStreak>;

  constructor(config: Partial<RewardsConfig> = {}) {
    this.config = { ...DEFAULT_REWARDS_CONFIG, ...config };
    this.pointsLedger = new PointsLedger(this.config);
    this.achievementManager = new AchievementManager(this.config.achievements);
    this.resilienceCalculator = new ResilienceCalculator(this.config.resilience);
    this.antiSybilSystem = new AntiSybilSystem(this.config.antiSybil);
    this.verificationSystem = new VerificationSystem();
    
    this.events = new Map();
    this.contributions = new Map();
    this.streaks = new Map();
  }

  // ============================================================================
  // Event Recording
  // ============================================================================

  /**
   * Record a new event for a wallet
   * This is the main entry point for earning points
   */
  async recordEvent(input: CreateEventInput): Promise<{ event: RewardsEvent; pointsEarned: number }> {
    // Validate input
    const validatedInput = EventSchema.parse(input);
    
    const walletAddress = validatedInput.walletAddress;
    const now = Date.now();
    
    // Check anti-Sybil
    const sybilCheck = await this.antiSybilSystem.check(walletAddress);
    if (sybilCheck.isSybil) {
      throw new RewardsError(
        'SYBIL_DETECTED',
        'Sybil detection triggered',
        { confidence: sybilCheck.confidence, reasons: sybilCheck.reasons }
      );
    }
    
    // Check rate limits
    const rateLimit = await this.antiSybilSystem.checkRateLimit(walletAddress);
    if (rateLimit.actionsRemaining <= 0) {
      throw new RewardsError(
        'RATE_LIMITED',
        'Rate limit exceeded',
        { resetAt: rateLimit.resetAt }
      );
    }
    
    // Check if this event is a duplicate
    const recentEvents = this.events.get(walletAddress) || [];
    const duplicateCheck = recentEvents.find(e => 
      e.type === validatedInput.type &&
      e.timestamp > now - 3600000 && // Within last hour
      JSON.stringify(e.metadata) === JSON.stringify(validatedInput.metadata)
    );
    
    if (duplicateCheck) {
      throw new RewardsError(
        'DUPLICATE_EVENT',
        'Duplicate event detected',
        { duplicateEventId: duplicateCheck.id }
      );
    }
    
    // Create event
    const event: RewardsEvent = {
      id: this.generateId(),
      type: validatedInput.type,
      walletAddress,
      timestamp: now,
      metadata: validatedInput.metadata || {},
      processed: false,
    };
    
    // Calculate points for this event
    const pointsEarned = this.calculateEventPoints(event);
    event.points = pointsEarned;
    
    // Store event
    if (!this.events.has(walletAddress)) {
      this.events.set(walletAddress, []);
    }
    this.events.get(walletAddress)!.push(event);
    
    // Update rate limit
    await this.antiSybilSystem.recordAction(walletAddress, pointsEarned);
    
    // Process event (async, don't wait)
    this.processEvent(event).catch(err => {
      console.error('Failed to process event:', err);
    });
    
    return { event, pointsEarned };
  }

  /**
   * Process an event to update points, achievements, streaks, etc.
   */
  private async processEvent(event: RewardsEvent): Promise<void> {
    const { walletAddress, type, timestamp } = event;
    
    // Update points ledger
    if (event.points && event.points > 0) {
      await this.pointsLedger.earn(
        walletAddress,
        event.points,
        event.type,
        event.id,
        `Points for ${type}`
      );
    }
    
    // Update achievements
    await this.achievementManager.checkForAchievements(walletAddress, event);
    
    // Update streak
    await this.updateStreak(walletAddress, timestamp);
    
    // Mark as processed
    event.processed = true;
  }

  /**
   * Calculate points for an event
   */
  private calculateEventPoints(event: RewardsEvent): number {
    const { type, metadata } = event;
    const { points } = this.config;
    
    switch (type) {
      case 'wallet_initialized':
        return points.walletInitialization;
      case 'policy_configured':
        return points.policyConfiguration;
      case 'guardian_added':
        return points.perGuardianAdded + (points.verifiedGuardian * (metadata?.verified ? 1 : 0));
      case 'guardian_verified':
        return points.verifiedGuardian;
      case 'simulation_completed':
        return points.recoverySimulation;
      case 'education_completed':
        return points.securityEducation;
      case 'security_contribution':
        return points.documentationContribution; // Same as documentation for now
      case 'documentation_contribution':
        return points.documentationContribution;
      case 'integration_contribution':
        return points.integrationContribution;
      case 'daily_activity':
        return points.dailyActivity;
      default:
        return 0;
    }
  }

  // ============================================================================
  // Points Ledger
  // ============================================================================

  /**
   * Get points balance for a wallet
   */
  async getPointsBalance(walletAddress: string): Promise<PointsBalance> {
    return this.pointsLedger.getBalance(walletAddress);
  }

  /**
   * Get transaction history for a wallet
   */
  async getTransactionHistory(
    walletAddress: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TransactionHistory> {
    return this.pointsLedger.getHistory(walletAddress, limit, offset);
  }

  /**
   * Transfer points between wallets (if enabled)
   * Note: Points are non-transferable by default
   */
  async transferPoints(
    fromWallet: string,
    toWallet: string,
    amount: number,
    reason: string
  ): Promise<PointsEntry> {
    // Points are non-transferable
    throw new RewardsError(
      'INVALID_OPERATION',
      'Points are non-transferable'
    );
  }

  // ============================================================================
  // Achievements
  // ============================================================================

  /**
   * Get achievements for a wallet
   */
  async getAchievements(walletAddress: string): Promise<UserAchievement[]> {
    return this.achievementManager.getUserAchievements(walletAddress);
  }

  /**
   * Get all available achievements
   */
  getAvailableAchievements(): AchievementConfig[] {
    return this.achievementManager.getAvailableAchievements();
  }

  // ============================================================================
  // Resilience Score
  // ============================================================================

  /**
   * Calculate resilience score for a wallet
   */
  async calculateResilienceScore(
    walletAddress: string,
    policy?: {
      guardians: string[];
      threshold: number;
      delaySeconds: number;
    }
  ): Promise<ResilienceScore> {
    return this.resilienceCalculator.calculate(walletAddress, policy);
  }

  /**
   * Get resilience score history for a wallet
   */
  async getResilienceHistory(walletAddress: string): Promise<ResilienceScore[]> {
    return this.resilienceCalculator.getHistory(walletAddress);
  }

  // ============================================================================
  // Anti-Sybil
  // ============================================================================

  /**
   * Check if a wallet is a Sybil
   */
  async checkSybil(walletAddress: string): Promise<AntiSybilCheck> {
    return this.antiSybilSystem.check(walletAddress);
  }

  /**
   * Get rate limit status for a wallet
   */
  async getRateLimitStatus(walletAddress: string): Promise<RateLimitStatus> {
    return this.antiSybilSystem.checkRateLimit(walletAddress);
  }

  // ============================================================================
  // Verification
  // ============================================================================

  /**
   * Submit a verification request
   */
  async submitVerification(
    walletAddress: string,
    verificationType: 'guardian' | 'contribution' | 'identity',
    data: Record<string, any>
  ): Promise<VerificationRequest> {
    return this.verificationSystem.submitRequest(walletAddress, verificationType, data);
  }

  /**
   * Get verification status
   */
  async getVerificationStatus(requestId: string): Promise<VerificationRequest> {
    return this.verificationSystem.getRequest(requestId);
  }

  /**
   * Review and approve/reject a verification request
   */
  async reviewVerification(
    requestId: string,
    approved: boolean,
    reviewer: string,
    notes?: string
  ): Promise<VerificationRequest> {
    return this.verificationSystem.reviewRequest(requestId, approved, reviewer, notes);
  }

  // ============================================================================
  // Contributions
  // ============================================================================

  /**
   * Submit a contribution
   */
  async submitContribution(
    walletAddress: string,
    contribution: Omit<Contribution, 'id' | 'submittedAt' | 'status'>
  ): Promise<Contribution> {
    const newContribution: Contribution = {
      ...contribution,
      id: this.generateId(),
      walletAddress,
      submittedAt: Date.now(),
      status: 'pending',
    };
    
    if (!this.contributions.has(walletAddress)) {
      this.contributions.set(walletAddress, []);
    }
    this.contributions.get(walletAddress)!.push(newContribution);
    
    // Record contribution event
    await this.recordEvent({
      type: 'documentation_contribution',
      walletAddress,
      metadata: { contributionId: newContribution.id },
    });
    
    return newContribution;
  }

  /**
   * Get contributions for a wallet
   */
  async getContributions(walletAddress: string): Promise<Contribution[]> {
    return this.contributions.get(walletAddress) || [];
  }

  /**
   * Review and approve/reject a contribution
   */
  async reviewContribution(
    contributionId: string,
    approved: boolean,
    pointsAwarded: number,
    reviewer: string,
    feedback?: string
  ): Promise<Contribution | null> {
    // Find contribution
    for (const [walletAddress, contributions] of this.contributions.entries()) {
      const contribution = contributions.find(c => c.id === contributionId);
      if (contribution) {
        contribution.status = approved ? 'approved' : 'rejected';
        contribution.reviewedAt = Date.now();
        contribution.reviewedBy = reviewer;
        contribution.feedback = feedback;
        
        if (approved) {
          contribution.pointsAwarded = pointsAwarded;
          // Award points
          await this.pointsLedger.earn(
            walletAddress,
            pointsAwarded,
            'contribution_approved',
            contributionId,
            `Points for approved contribution: ${contribution.title}`
          );
          
          // Record achievement
          await this.recordEvent({
            type: 'documentation_contribution',
            walletAddress,
            metadata: { contributionId, points: pointsAwarded },
          });
        }
        
        return contribution;
      }
    }
    
    return null;
  }

  // ============================================================================
  // Streaks
  // ============================================================================

  /**
   * Get streak information for a wallet
   */
  async getStreak(walletAddress: string): Promise<ActivityStreak> {
    return this.streaks.get(walletAddress) || {
      walletAddress,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: 0,
      streakStartDate: 0,
    };
  }

  /**
   * Update streak based on activity
   */
  private async updateStreak(walletAddress: string, activityTimestamp: number): Promise<void> {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    let streak = this.streaks.get(walletAddress);
    
    if (!streak) {
      streak = {
        walletAddress,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: activityTimestamp,
        streakStartDate: activityTimestamp,
      };
      this.streaks.set(walletAddress, streak);
      return;
    }
    
    // Check if activity is within 24 hours of last activity
    const timeSinceLast = activityTimestamp - streak.lastActivityDate;
    
    if (timeSinceLast <= oneDay * 1.5) { // Allow up to 36 hours for timezone issues
      // Continue streak
      streak.currentStreak++;
      if (streak.currentStreak > streak.longestStreak) {
        streak.longestStreak = streak.currentStreak;
      }
      streak.lastActivityDate = activityTimestamp;
      
      // Check for streak achievements
      await this.achievementManager.checkForStreak(walletAddress, streak.currentStreak);
      
      // Award streak bonus if applicable
      if (streak.currentStreak % 7 === 0) {
        // Weekly streak bonus
        await this.pointsLedger.earn(
          walletAddress,
          this.config.points.streakBonus,
          'streak_bonus',
          `${streak.currentStreak}-day-streak`,
          `Weekly streak bonus for ${streak.currentStreak} days`
        );
      }
    } else {
      // Reset streak
      streak.currentStreak = 1;
      streak.streakStartDate = activityTimestamp;
      streak.lastActivityDate = activityTimestamp;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Get statistics for a wallet
   */
  async getWalletStats(walletAddress: string): Promise<{
    balance: PointsBalance;
    achievements: UserAchievement[];
    resilience: ResilienceScore;
    streak: ActivityStreak;
    rateLimit: RateLimitStatus;
    totalEvents: number;
    totalContributions: number;
  }> {
    const [
      balance,
      achievements,
      resilience,
      streak,
      rateLimit,
    ] = await Promise.all([
      this.getPointsBalance(walletAddress),
      this.getAchievements(walletAddress),
      this.calculateResilienceScore(walletAddress),
      this.getStreak(walletAddress),
      this.getRateLimitStatus(walletAddress),
    ]);
    
    const events = this.events.get(walletAddress) || [];
    const contributions = this.contributions.get(walletAddress) || [];
    
    return {
      balance,
      achievements,
      resilience,
      streak,
      rateLimit,
      totalEvents: events.length,
      totalContributions: contributions.length,
    };
  }

  // ============================================================================
  // Admin Methods
  // ============================================================================

  /**
   * Adjust points for a wallet (admin only)
   */
  async adjustPoints(
    walletAddress: string,
    amount: number,
    reason: string,
    adminId: string
  ): Promise<PointsEntry> {
    // In production, verify admin permissions
    return this.pointsLedger.createEntry(walletAddress, amount, reason, adminId);
  }

  /**
   * Reset rate limits for a wallet (admin only)
   */
  async resetRateLimits(walletAddress: string): Promise<void> {
    await this.antiSybilSystem.resetRateLimit(walletAddress);
  }

  /**
   * Suspend an account (admin only)
   */
  async suspendAccount(walletAddress: string, reason: string): Promise<void> {
    await this.antiSybilSystem.suspendAccount(walletAddress, reason);
  }

  // ============================================================================
  // Export/Import for Persistence
  // ============================================================================

  /**
   * Export all data for persistence
   */
  exportData(): {
    events: Map<string, RewardsEvent[]>;
    pointsLedger: any;
    achievements: any;
    resilience: any;
    antiSybil: any;
    contributions: Map<string, Contribution[]>;
    streaks: Map<string, ActivityStreak>;
  } {
    return {
      events: this.events,
      pointsLedger: this.pointsLedger.exportData(),
      achievements: this.achievementManager.exportData(),
      resilience: this.resilienceCalculator.exportData(),
      antiSybil: this.antiSybilSystem.exportData(),
      contributions: this.contributions,
      streaks: this.streaks,
    };
  }

  /**
   * Import data from export
   */
  importData(data: any): void {
    this.events = new Map(Object.entries(data.events));
    this.contributions = new Map(Object.entries(data.contributions));
    this.streaks = new Map(Object.entries(data.streaks));
    this.pointsLedger.importData(data.pointsLedger);
    this.achievementManager.importData(data.achievements);
    this.resilienceCalculator.importData(data.resilience);
    this.antiSybilSystem.importData(data.antiSybil);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createRewardsEngine(config: Partial<RewardsConfig> = {}): RewardsEngine {
  return new RewardsEngine(config);
}
