// ReKey Lifeline Rewards - Resilience Calculator
// Calculates resilience scores based on wallet configuration

import {
  RewardsConfig,
  ResilienceScore,
  ResilienceFactor,
} from './types';

// ============================================================================
// Resilience Calculator Class
// ============================================================================

interface ResilienceConfig {
  baseScore: number;
  maxScore: number;
  factors: {
    guardianCount: { weight: number; max: number };
    threshold: { weight: number; max: number };
    delay: { weight: number; max: number };
    guardianDiversity: { weight: number; max: number };
    activity: { weight: number; max: number };
  };
}

export class ResilienceCalculator {
  private config: ResilienceConfig;
  private history: Map<string, ResilienceScore[]>;

  constructor(resilienceConfig: ResilienceConfig) {
    this.config = resilienceConfig;
    this.history = new Map();
  }

  // ============================================================================
  // Score Calculation
  // ============================================================================

  /**
   * Calculate resilience score for a wallet
   */
  async calculate(
    walletAddress: string,
    policy?: {
      guardians: string[];
      threshold: number;
      delaySeconds: number;
    }
  ): Promise<ResilienceScore> {
    // If no policy, return minimum score
    if (!policy) {
      return {
        walletAddress,
        score: this.config.baseScore,
        grade: 'F',
        factors: [],
        lastCalculated: Date.now(),
        history: this.history.get(walletAddress) || [],
      };
    }

    const guardianCount = policy.guardians.length;
    const threshold = policy.threshold;
    const delaySeconds = policy.delaySeconds;

    // Calculate factor scores (0-1)
    const guardianCountScore = this.calculateGuardianCountScore(guardianCount);
    const thresholdScore = this.calculateThresholdScore(threshold, guardianCount);
    const delayScore = this.calculateDelayScore(delaySeconds);
    const diversityScore = this.calculateDiversityScore(policy.guardians);
    const activityScore = 0; // Placeholder - would query activity history

    // Calculate weighted scores
    const factors: ResilienceFactor[] = [
      {
        name: 'guardianCount',
        score: guardianCountScore,
        weight: this.config.factors.guardianCount.weight,
        description: `Guardian count score: ${guardianCount} guardians`,
      },
      {
        name: 'threshold',
        score: thresholdScore,
        weight: this.config.factors.threshold.weight,
        description: `Threshold score: ${threshold} of ${guardianCount}`,
      },
      {
        name: 'delay',
        score: delayScore,
        weight: this.config.factors.delay.weight,
        description: `Delay score: ${delaySeconds / 86400} days`,
      },
      {
        name: 'guardianDiversity',
        score: diversityScore,
        weight: this.config.factors.guardianDiversity.weight,
        description: 'Guardian diversity score',
      },
      {
        name: 'activity',
        score: activityScore,
        weight: this.config.factors.activity.weight,
        description: 'Activity score',
      },
    ];

    // Calculate overall score
    const weightedSum = factors.reduce(
      (sum, factor) => sum + factor.score * factor.weight,
      0
    );
    const score = this.config.baseScore + weightedSum * this.config.maxScore;
    const finalScore = Math.min(Math.max(score, 0), this.config.maxScore);

    // Assign grade
    const grade = this.scoreToGrade(finalScore);

    // Create score object
    const result: ResilienceScore = {
      walletAddress,
      score: Math.round(finalScore),
      grade,
      factors,
      lastCalculated: Date.now(),
      history: [],
    };

    // Store in history
    if (!this.history.has(walletAddress)) {
      this.history.set(walletAddress, []);
    }
    const walletHistory = this.history.get(walletAddress)!;
    walletHistory.push(result);
    
    // Keep only last 30 scores
    if (walletHistory.length > 30) {
      walletHistory.shift();
    }

    result.history = walletHistory;

    return result;
  }

  /**
   * Calculate guardian count score
   */
  private calculateGuardianCountScore(count: number): number {
    // Max 5 guardians
    return Math.min(count / 5, 1);
  }

  /**
   * Calculate threshold score
   */
  private calculateThresholdScore(threshold: number, guardianCount: number): number {
    if (guardianCount === 0) return 0;
    
    // Optimal threshold is around 2/3 of guardians
    const optimal = guardianCount * 0.67;
    const distance = Math.abs(threshold - optimal);
    const maxDistance = Math.max(optimal, guardianCount - optimal);
    
    if (maxDistance === 0) return 1;
    
    return 1 - (distance / maxDistance);
  }

  /**
   * Calculate delay score
   */
  private calculateDelayScore(delaySeconds: number): number {
    // Optimal delay is 3-7 days
    const optimalMin = 3 * 86400; // 3 days
    const optimalMax = 7 * 86400; // 7 days
    
    if (delaySeconds <= optimalMin) {
      return delaySeconds / optimalMin;
    } else if (delaySeconds >= optimalMax) {
      return 1 - ((delaySeconds - optimalMax) / optimalMax);
    } else {
      return 1;
    }
  }

  /**
   * Calculate guardian diversity score
   */
  private calculateDiversityScore(guardians: string[]): number {
    // For demo, assume good diversity if multiple guardians
    if (guardians.length >= 3) return 1;
    if (guardians.length >= 2) return 0.7;
    if (guardians.length >= 1) return 0.3;
    return 0;
  }

  /**
   * Convert score to grade
   */
  private scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  // ============================================================================
  // History Methods
  // ============================================================================

  /**
   * Get resilience score history for a wallet
   */
  getHistory(walletAddress: string): ResilienceScore[] {
    return this.history.get(walletAddress) || [];
  }

  /**
   * Get latest resilience score for a wallet
   */
  getLatest(walletAddress: string): ResilienceScore | null {
    const history = this.getHistory(walletAddress);
    if (history.length === 0) return null;
    return history[history.length - 1];
  }

  // ============================================================================
  // Data Export/Import
  // ============================================================================

  exportData(): Map<string, ResilienceScore[]> {
    return this.history;
  }

  importData(data: Map<string, ResilienceScore[]>): void {
    this.history = new Map(data);
  }
}
