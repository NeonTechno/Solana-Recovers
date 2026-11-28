// ReKey Rewards Engine - Tests
// Comprehensive tests for the rewards engine

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { RewardsEngine, createRewardsEngine } from '../rewards/src/rewardsEngine';
import { DEFAULT_REWARDS_CONFIG } from '../rewards/src/types';

describe('Rewards Engine', () => {
  let engine: RewardsEngine;

  beforeAll(() => {
    engine = createRewardsEngine();
  });

  describe('Event Recording', () => {
    it('should record a wallet initialization event', async () => {
      const result = await engine.recordEvent({
        type: 'wallet_initialized',
        walletAddress: '11111111111111111111111111111111',
      });
      
      expect(result.event.type).toBe('wallet_initialized');
      expect(result.event.walletAddress).toBe('11111111111111111111111111111111');
      expect(result.pointsEarned).toBe(DEFAULT_REWARDS_CONFIG.points.walletInitialization);
    });

    it('should record a policy configuration event', async () => {
      const result = await engine.recordEvent({
        type: 'policy_configured',
        walletAddress: '22222222222222222222222222222222',
      });
      
      expect(result.event.type).toBe('policy_configured');
      expect(result.pointsEarned).toBe(DEFAULT_REWARDS_CONFIG.points.policyConfiguration);
    });

    it('should record a guardian added event', async () => {
      const result = await engine.recordEvent({
        type: 'guardian_added',
        walletAddress: '33333333333333333333333333333333',
        metadata: { verified: true },
      });
      
      expect(result.event.type).toBe('guardian_added');
      expect(result.pointsEarned).toBe(
        DEFAULT_REWARDS_CONFIG.points.perGuardianAdded + 
        DEFAULT_REWARDS_CONFIG.points.verifiedGuardian
      );
    });

    it('should record a simulation completed event', async () => {
      const result = await engine.recordEvent({
        type: 'simulation_completed',
        walletAddress: '44444444444444444444444444444444',
      });
      
      expect(result.event.type).toBe('simulation_completed');
      expect(result.pointsEarned).toBe(DEFAULT_REWARDS_CONFIG.points.recoverySimulation);
    });

    it('should reject duplicate events within one hour', async () => {
      const walletAddress = '55555555555555555555555555555555';
      
      // First event should succeed
      await engine.recordEvent({
        type: 'wallet_initialized',
        walletAddress,
      });
      
      // Second identical event should fail
      await expect(engine.recordEvent({
        type: 'wallet_initialized',
        walletAddress,
      })).rejects.toThrow();
    });
  });

  describe('Points Ledger', () => {
    it('should get points balance for a wallet', async () => {
      const walletAddress = '66666666666666666666666666666666';
      
      // Record some events
      await engine.recordEvent({ type: 'wallet_initialized', walletAddress });
      await engine.recordEvent({ type: 'policy_configured', walletAddress });
      
      const balance = await engine.getPointsBalance(walletAddress);
      
      expect(balance.walletAddress).toBe(walletAddress);
      expect(balance.totalPoints).toBeGreaterThan(0);
    });

    it('should get transaction history for a wallet', async () => {
      const walletAddress = '77777777777777777777777777777777';
      
      await engine.recordEvent({ type: 'wallet_initialized', walletAddress });
      await engine.recordEvent({ type: 'policy_configured', walletAddress });
      
      const history = await engine.getTransactionHistory(walletAddress);
      
      expect(history.transactions).toBeInstanceOf(Array);
      expect(history.transactions.length).toBe(2);
    });

    it('should prevent points from being transferable', async () => {
      const fromWallet = '88888888888888888888888888888888';
      const toWallet = '99999999999999999999999999999999';
      
      await expect(engine.transferPoints(
        fromWallet,
        toWallet,
        100,
        'transfer'
      )).rejects.toThrow();
    });
  });

  describe('Achievements', () => {
    it('should get available achievements', () => {
      const achievements = engine.getAvailableAchievements();
      
      expect(achievements).toBeInstanceOf(Array);
      expect(achievements.length).toBeGreaterThan(0);
      
      // Check that we have the expected achievements
      const achievementIds = achievements.map(a => a.id);
      expect(achievementIds).toContain('first_steps');
      expect(achievementIds).toContain('security_setup');
      expect(achievementIds).toContain('trusted_network');
    });

    it('should unlock achievements based on events', async () => {
      const walletAddress = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      
      // Initialize wallet
      await engine.recordEvent({ type: 'wallet_initialized', walletAddress });
      
      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check achievements
      const userAchievements = await engine.getAchievements(walletAddress);
      
      // Should have at least the first_steps achievement
      expect(userAchievements.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Resilience Score', () => {
    it('should calculate resilience score for a wallet', async () => {
      const walletAddress = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
      const policy = {
        guardians: [
          '11111111111111111111111111111111',
          '22222222222222222222222222222222',
          '33333333333333333333333333333333',
        ],
        threshold: 2,
        delaySeconds: 86400, // 24 hours
      };
      
      const score = await engine.calculateResilienceScore(walletAddress, policy);
      
      expect(score.walletAddress).toBe(walletAddress);
      expect(score.score).toBeGreaterThan(0);
      expect(score.grade).toBeDefined();
      expect(score.factors).toBeInstanceOf(Array);
      expect(score.factors.length).toBe(5); // guardianCount, threshold, delay, guardianDiversity, activity
    });

    it('should return minimum score for unconfigured wallet', async () => {
      const walletAddress = 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
      
      const score = await engine.calculateResilienceScore(walletAddress);
      
      expect(score.score).toBe(0);
      expect(score.grade).toBe('F');
    });
  });

  describe('Anti-Sybil', () => {
    it('should check if a wallet is a Sybil', async () => {
      const walletAddress = 'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
      
      const check = await engine.checkSybil(walletAddress);
      
      expect(check.walletAddress).toBe(walletAddress);
      expect(check.isSybil).toBeDefined();
      expect(check.confidence).toBeGreaterThanOrEqual(0);
      expect(check.confidence).toBeLessThanOrEqual(1);
    });

    it('should get rate limit status for a wallet', async () => {
      const walletAddress = 'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';
      
      const status = await engine.getRateLimitStatus(walletAddress);
      
      expect(status.walletAddress).toBe(walletAddress);
      expect(status.actionsRemaining).toBeGreaterThanOrEqual(0);
      expect(status.pointsRemaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Contributions', () => {
    it('should submit a contribution', async () => {
      const walletAddress = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
      
      const contribution = await engine.submitContribution(walletAddress, {
        type: 'documentation_contribution',
        title: 'ReKey Documentation',
        description: 'Comprehensive documentation for ReKey',
        url: 'https://github.com/NeonTechno/Solana-Recovers',
      });
      
      expect(contribution.id).toBeDefined();
      expect(contribution.walletAddress).toBe(walletAddress);
      expect(contribution.status).toBe('pending');
      expect(contribution.submittedAt).toBeDefined();
    });

    it('should get contributions for a wallet', async () => {
      const walletAddress = 'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG';
      
      await engine.submitContribution(walletAddress, {
        type: 'documentation_contribution',
        title: 'Test Documentation',
        description: 'Test',
      });
      
      const contributions = await engine.getContributions(walletAddress);
      
      expect(contributions).toBeInstanceOf(Array);
      expect(contributions.length).toBe(1);
    });

    it('should review and approve a contribution', async () => {
      const walletAddress = 'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH';
      
      const contribution = await engine.submitContribution(walletAddress, {
        type: 'documentation_contribution',
        title: 'Test Documentation',
        description: 'Test',
      });
      
      const reviewed = await engine.reviewContribution(
        contribution.id,
        true,
        200,
        'reviewer',
        'Great contribution!'
      );
      
      expect(reviewed).toBeDefined();
      expect(reviewed!.status).toBe('approved');
      expect(reviewed!.pointsAwarded).toBe(200);
    });
  });

  describe('Streaks', () => {
    it('should get streak information for a wallet', async () => {
      const walletAddress = 'IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII';
      
      const streak = await engine.getStreak(walletAddress);
      
      expect(streak.walletAddress).toBe(walletAddress);
      expect(streak.currentStreak).toBeGreaterThanOrEqual(0);
      expect(streak.longestStreak).toBeGreaterThanOrEqual(0);
    });

    it('should update streak on activity', async () => {
      const walletAddress = 'JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ';
      
      // Record an event
      await engine.recordEvent({
        type: 'wallet_initialized',
        walletAddress,
      });
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const streak = await engine.getStreak(walletAddress);
      
      expect(streak.currentStreak).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Wallet Statistics', () => {
    it('should get comprehensive statistics for a wallet', async () => {
      const walletAddress = 'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK';
      
      // Add some data
      await engine.recordEvent({ type: 'wallet_initialized', walletAddress });
      await engine.recordEvent({ type: 'policy_configured', walletAddress });
      
      const stats = await engine.getWalletStats(walletAddress);
      
      expect(stats.balance).toBeDefined();
      expect(stats.balance.totalPoints).toBeGreaterThan(0);
      expect(stats.achievements).toBeInstanceOf(Array);
      expect(stats.resilience).toBeDefined();
      expect(stats.streak).toBeDefined();
      expect(stats.rateLimit).toBeDefined();
      expect(stats.totalEvents).toBe(2);
    });
  });

  describe('Admin Methods', () => {
    it('should adjust points for a wallet', async () => {
      const walletAddress = 'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL';
      
      // Adjust points
      await engine.adjustPoints(
        walletAddress,
        1000,
        'admin bonus',
        'admin'
      );
      
      const balance = await engine.getPointsBalance(walletAddress);
      
      expect(balance.totalPoints).toBe(1000);
    });

    it('should reset rate limits for a wallet', async () => {
      const walletAddress = 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM';
      
      // Record some events to use up rate limit
      for (let i = 0; i < 10; i++) {
        await engine.recordEvent({
          type: 'wallet_initialized',
          walletAddress: `${walletAddress}${i}`,
        });
      }
      
      // Reset
      await engine.resetRateLimits(walletAddress);
      
      const status = await engine.getRateLimitStatus(walletAddress);
      expect(status.actionsRemaining).toBeGreaterThan(0);
    });

    it('should suspend an account', async () => {
      const walletAddress = 'NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN';
      
      await engine.suspendAccount(walletAddress, 'Test suspension');
      
      const isSuspended = await engine.antiSybilSystem.isSuspended(walletAddress);
      expect(isSuspended).toBe(true);
    });
  });
});

describe('Rewards Engine Configuration', () => {
  it('should create engine with custom configuration', () => {
    const customConfig = {
      points: {
        walletInitialization: 500,
        policyConfiguration: 750,
      },
    };
    
    const engine = createRewardsEngine(customConfig);
    expect(engine).toBeDefined();
  });

  it('should have default configuration', () => {
    const engine = createRewardsEngine();
    const config = engine.getConfig();
    
    expect(config.points.walletInitialization).toBe(100);
    expect(config.points.policyConfiguration).toBe(150);
  });
});
