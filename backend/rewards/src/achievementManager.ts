// ReKey Lifeline Rewards - Achievement Manager
// Manages achievement tracking and unlocking

import {
  AchievementConfig,
  UserAchievement,
  RewardsEvent,
  RewardsError,
  RewardsErrorCode,
} from './types';

// ============================================================================
// Achievement Manager Class
// ============================================================================

export class AchievementManager {
  private achievements: Map<string, AchievementConfig>;
  private userAchievements: Map<string, UserAchievement[]>;
  private achievementIds: Set<string>;

  constructor(achievementConfigs: AchievementConfig[] = []) {
    this.achievements = new Map();
    this.userAchievements = new Map();
    this.achievementIds = new Set();
    
    // Load achievements
    for (const config of achievementConfigs) {
      this.achievements.set(config.id, config);
      this.achievementIds.add(config.id);
    }
  }

  // ============================================================================
  // Achievement Checking
  // ============================================================================

  /**
   * Check for achievements based on a new event
   */
  async checkForAchievements(
    walletAddress: string,
    event: RewardsEvent
  ): Promise<UserAchievement[]> {
    const unlocked: UserAchievement[] = [];
    const existing = this.userAchievements.get(walletAddress) || [];
    const existingIds = new Set(existing.map(a => a.achievementId));
    
    for (const [id, config] of this.achievements.entries()) {
      // Skip if already unlocked
      if (existingIds.has(id)) continue;
      
      // Check criteria
      const isMet = await this.checkCriteria(walletAddress, config.criteria, event);
      
      if (isMet) {
        const achievement: UserAchievement = {
          id: `ach-${walletAddress}-${id}-${Date.now()}`,
          achievementId: id,
          walletAddress,
          earnedAt: Date.now(),
          points: config.points,
          criteriaMet: this.getCriteriaInfo(config.criteria),
        };
        
        // Add to user's achievements
        if (!this.userAchievements.has(walletAddress)) {
          this.userAchievements.set(walletAddress, []);
        }
        this.userAchievements.get(walletAddress)!.push(achievement);
        
        unlocked.push(achievement);
        existingIds.add(id);
      }
    }
    
    return unlocked;
  }

  /**
   * Check streak achievements
   */
  async checkForStreak(
    walletAddress: string,
    currentStreak: number
  ): Promise<UserAchievement[]> {
    const unlocked: UserAchievement[] = [];
    const existing = this.userAchievements.get(walletAddress) || [];
    const existingIds = new Set(existing.map(a => a.achievementId));
    
    for (const [id, config] of this.achievements.entries()) {
      // Skip if already unlocked or not a streak achievement
      if (existingIds.has(id) || config.criteria.type !== 'streak') continue;
      
      // Check if streak meets criteria
      if (currentStreak >= config.criteria.days) {
        const achievement: UserAchievement = {
          id: `ach-${walletAddress}-${id}-${Date.now()}`,
          achievementId: id,
          walletAddress,
          earnedAt: Date.now(),
          points: config.points,
          criteriaMet: { streakDays: currentStreak },
        };
        
        // Add to user's achievements
        this.userAchievements.get(walletAddress)!.push(achievement);
        
        unlocked.push(achievement);
        existingIds.add(id);
      }
    }
    
    return unlocked;
  }

  /**
   * Check if criteria are met
   */
  private async checkCriteria(
    walletAddress: string,
    criteria: any,
    event?: RewardsEvent
  ): Promise<boolean> {
    switch (criteria.type) {
      case 'event':
        return this.checkEventCriteria(criteria, event);
      case 'threshold':
        return this.checkThresholdCriteria(walletAddress, criteria);
      case 'streak':
        return this.checkStreakCriteria(walletAddress, criteria);
      case 'combined':
        return this.checkCombinedCriteria(walletAddress, criteria, event);
      default:
        return false;
    }
  }

  private checkEventCriteria(
    criteria: { type: 'event'; eventType: string },
    event?: RewardsEvent
  ): boolean {
    if (!event) return false;
    return event.type === criteria.eventType;
  }

  private async checkThresholdCriteria(
    walletAddress: string,
    criteria: { type: 'threshold'; metric: string; threshold: number; comparison: string }
  ): boolean {
    // Get event history for this wallet
    // This is a simplified implementation
    // In production, query actual wallet state
    
    // For demo, we'll check based on event history
    // This would be replaced with actual queries in production
    
    return false; // Placeholder
  }

  private async checkStreakCriteria(
    walletAddress: string,
    criteria: { type: 'streak'; days: number }
  ): boolean {
    // This would query the streak tracker
    // For now, return false as it's checked separately
    return false;
  }

  private async checkCombinedCriteria(
    walletAddress: string,
    criteria: { type: 'combined'; criteria: any[]; operator: 'AND' | 'OR' },
    event?: RewardsEvent
  ): Promise<boolean> {
    const results = await Promise.all(
      criteria.criteria.map(c => this.checkCriteria(walletAddress, c, event))
    );
    
    if (criteria.operator === 'AND') {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  }

  /**
   * Get criteria information for display
   */
  private getCriteriaInfo(criteria: any): Record<string, any> {
    switch (criteria.type) {
      case 'event':
        return { type: 'event', eventType: criteria.eventType };
      case 'threshold':
        return {
          type: 'threshold',
          metric: criteria.metric,
          threshold: criteria.threshold,
          comparison: criteria.comparison,
        };
      case 'streak':
        return { type: 'streak', days: criteria.days };
      case 'combined':
        return {
          type: 'combined',
          operator: criteria.operator,
          criteria: criteria.criteria.map(this.getCriteriaInfo),
        };
      default:
        return {};
    }
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Get achievements for a user
   */
  getUserAchievements(walletAddress: string): UserAchievement[] {
    return this.userAchievements.get(walletAddress) || [];
  }

  /**
   * Get a specific achievement for a user
   */
  getUserAchievement(
    walletAddress: string,
    achievementId: string
  ): UserAchievement | null {
    const achievements = this.getUserAchievements(walletAddress);
    return achievements.find(a => a.achievementId === achievementId) || null;
  }

  /**
   * Get all available achievements
   */
  getAvailableAchievements(): AchievementConfig[] {
    return Array.from(this.achievements.values());
  }

  /**
   * Get achievement by ID
   */
  getAchievementById(id: string): AchievementConfig | null {
    return this.achievements.get(id) || null;
  }

  // ============================================================================
  // Data Export/Import
  // ============================================================================

  exportData(): {
    achievements: Map<string, AchievementConfig>;
    userAchievements: Map<string, UserAchievement[]>;
  } {
    return {
      achievements: this.achievements,
      userAchievements: this.userAchievements,
    };
  }

  importData(data: {
    achievements: Map<string, AchievementConfig>;
    userAchievements: Map<string, UserAchievement[]>;
  }): void {
    this.achievements = new Map(data.achievements);
    this.userAchievements = new Map(data.userAchievements);
    
    // Update achievement IDs
    for (const config of this.achievements.values()) {
      this.achievementIds.add(config.id);
    }
  }
}
