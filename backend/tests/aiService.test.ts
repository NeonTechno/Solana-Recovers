// ReKey AI Service - Tests
// Comprehensive tests for the AI service

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { ReKeyAIService, createAIService } from '../ai/src/aiService';

describe('AI Service', () => {
  let aiService: ReKeyAIService;

  beforeAll(() => {
    // Mock environment variables for AI providers
    process.env.NVIDIA_API_KEY = 'test-nvidia-key';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    
    aiService = createAIService();
  });

  describe('Provider Management', () => {
    it('should list available providers', () => {
      const providers = aiService.listProviders();
      
      expect(providers).toBeInstanceOf(Array);
      // NVIDIA should be available with the test key
      expect(providers).toContain('nvidia');
    });

    it('should get the current provider', () => {
      const provider = aiService.getProvider();
      
      expect(provider).toBeDefined();
      expect(provider.name).toBeDefined();
    });

    it('should select a different provider', () => {
      aiService.selectProvider('nvidia');
      const provider = aiService.getProvider();
      
      expect(provider.name).toBe('nvidia');
    });
  });

  describe('Model Management', () => {
    it('should list available models', async () => {
      const models = await aiService.listModels();
      
      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBeGreaterThan(0);
      
      // Check that we have some expected models
      const modelIds = models.map(m => m.id);
      expect(modelIds).toContain('nvidia/mistral-large-4-1t-a52b');
    });
  });

  describe('Policy Explanation', () => {
    it('should explain a recovery policy', async () => {
      const request = {
        walletAddress: '11111111111111111111111111111111',
        policy: {
          guardians: [
            '22222222222222222222222222222222',
            '33333333333333333333333333333333',
            '44444444444444444444444444444444',
          ],
          threshold: 2,
          delaySeconds: 86400, // 24 hours
        },
      };
      
      const response = await aiService.explainPolicy(request);
      
      expect(response.walletAddress).toBe(request.walletAddress);
      expect(response.summary).toBeDefined();
      expect(response.guardianExplanation).toBeDefined();
      expect(response.thresholdExplanation).toBeDefined();
      expect(response.timelockExplanation).toBeDefined();
      expect(response.securityImplications).toBeInstanceOf(Array);
      expect(response.recommendations).toBeInstanceOf(Array);
    });

    it('should explain policy in different languages', async () => {
      const request = {
        walletAddress: '11111111111111111111111111111111',
        policy: {
          guardians: ['22222222222222222222222222222222'],
          threshold: 1,
          delaySeconds: 86400,
        },
        userLanguage: 'Spanish',
      };
      
      const response = await aiService.explainPolicy(request);
      
      expect(response.summary).toBeDefined();
    });
  });

  describe('Readiness Assessment', () => {
    it('should assess recovery readiness', async () => {
      const request = {
        walletAddress: '11111111111111111111111111111111',
        policy: {
          guardians: [
            '22222222222222222222222222222222',
            '33333333333333333333333333333333',
            '44444444444444444444444444444444',
          ],
          threshold: 2,
          delaySeconds: 86400,
        },
        walletBalance: 10,
        guardianVerifiedStatus: {
          '22222222222222222222222222222222': true,
          '33333333333333333333333333333333': true,
          '44444444444444444444444444444444': false,
        },
      };
      
      const response = await aiService.assessReadiness(request);
      
      expect(response.walletAddress).toBe(request.walletAddress);
      expect(response.overallScore).toBeGreaterThanOrEqual(0);
      expect(response.overallScore).toBeLessThanOrEqual(100);
      expect(response.isReady).toBeDefined();
      expect(response.requirements).toBeInstanceOf(Array);
      expect(response.recommendations).toBeInstanceOf(Array);
    });

    it('should identify low readiness configuration', async () => {
      const request = {
        walletAddress: '11111111111111111111111111111111',
        policy: {
          guardians: [],
          threshold: 0,
          delaySeconds: 0,
        },
      };
      
      const response = await aiService.assessReadiness(request);
      
      expect(response.isReady).toBe(false);
      expect(response.overallScore).toBeLessThan(80);
    });
  });

  describe('Threshold Explanation', () => {
    it('should explain guardian threshold', async () => {
      const request = {
        walletAddress: '11111111111111111111111111111111',
        threshold: 2,
        guardianCount: 3,
        guardianLabels: ['Guardian Alpha', 'Guardian Beta', 'Guardian Gamma'],
      };
      
      const response = await aiService.explainThreshold(request);
      
      expect(response.walletAddress).toBe(request.walletAddress);
      expect(response.threshold).toBe(request.threshold);
      expect(response.guardianCount).toBe(request.guardianCount);
      expect(response.explanation).toBeDefined();
      expect(response.examples).toBeInstanceOf(Array);
      expect(response.math).toBeDefined();
      expect(response.implications).toBeInstanceOf(Array);
    });
  });

  describe('Security Recommendations', () => {
    it('should recommend security improvements', async () => {
      const request = {
        walletAddress: '11111111111111111111111111111111',
        currentConfig: {
          guardians: ['22222222222222222222222222222222'],
          threshold: 1,
          delaySeconds: 60,
        },
        preferences: {
          securityLevel: 'high',
          convenience: 'medium',
        },
      };
      
      const response = await aiService.recommendSecurity(request);
      
      expect(response.walletAddress).toBe(request.walletAddress);
      expect(response.recommendations).toBeInstanceOf(Array);
      expect(response.recommendations.length).toBeGreaterThan(0);
      
      // Should recommend more guardians for high security
      const guardianRecs = response.recommendations.filter(
        r => r.category === 'guardians'
      );
      expect(guardianRecs.length).toBeGreaterThan(0);
    });

    it('should adapt recommendations to preferences', async () => {
      const highSecurityRequest = {
        walletAddress: '11111111111111111111111111111111',
        currentConfig: {
          guardians: ['22222222222222222222222222222222'],
          threshold: 1,
          delaySeconds: 60,
        },
        preferences: {
          securityLevel: 'high',
          convenience: 'low',
        },
      };
      
      const lowSecurityRequest = {
        ...highSecurityRequest,
        preferences: {
          securityLevel: 'low',
          convenience: 'high',
        },
      };
      
      const highSecResponse = await aiService.recommendSecurity(highSecurityRequest);
      const lowSecResponse = await aiService.recommendSecurity(lowSecurityRequest);
      
      // High security should have more recommendations
      expect(highSecResponse.recommendations.length).toBeGreaterThanOrEqual(
        lowSecResponse.recommendations.length
      );
    });
  });

  describe('Recovery Simulation Guide', () => {
    it('should guide through recovery simulation', async () => {
      const request = {
        walletAddress: '11111111111111111111111111111111',
        newOwner: '55555555555555555555555555555555',
        guardians: [
          '22222222222222222222222222222222',
          '33333333333333333333333333333333',
          '44444444444444444444444444444444',
        ],
        threshold: 2,
        delaySeconds: 86400,
      };
      
      const response = await aiService.guideSimulation(request);
      
      expect(response.walletAddress).toBe(request.walletAddress);
      expect(response.steps).toBeInstanceOf(Array);
      expect(response.steps.length).toBe(5); // Request, Approvals, Threshold, Timelock, Execute
      expect(response.timeline).toBeDefined();
      expect(response.checkpoints).toBeInstanceOf(Array);
      expect(response.warnings).toBeInstanceOf(Array);
    });

    it('should warn about low threshold', async () => {
      const request = {
        walletAddress: '11111111111111111111111111111111',
        newOwner: '55555555555555555555555555555555',
        guardians: [
          '22222222222222222222222222222222',
          '33333333333333333333333333333333',
        ],
        threshold: 1,
        delaySeconds: 86400,
      };
      
      const response = await aiService.guideSimulation(request);
      
      expect(response.warnings).toContain('Warning: Threshold of 1 means any single guardian can trigger recovery');
    });
  });

  describe('Rewards Explanation', () => {
    it('should explain rewards and points', async () => {
      const request = {
        walletAddress: '11111111111111111111111111111111',
        points: 1500,
        achievements: [
          { id: 'first_steps', name: 'First Steps', points: 100, earnedAt: Date.now() },
          { id: 'security_setup', name: 'Security Setup', points: 150, earnedAt: Date.now() },
        ],
        eligibleActions: ['complete_simulation', 'verify_guardian'],
      };
      
      const response = await aiService.explainRewards(request);
      
      expect(response.walletAddress).toBe(request.walletAddress);
      expect(response.currentPoints).toBe(request.points);
      expect(response.achievementsSummary).toBeDefined();
      expect(response.pointsBreakdown).toBeInstanceOf(Array);
      expect(response.eligibleActions).toBeInstanceOf(Array);
    });

    it('should show next milestone', async () => {
      const request = {
        walletAddress: '11111111111111111111111111111111',
        points: 100,
        achievements: [],
      };
      
      const response = await aiService.explainRewards(request);
      
      expect(response.nextMilestone).toBeDefined();
      expect(response.nextMilestone!.pointsNeeded).toBeGreaterThan(0);
    });
  });

  describe('General Questions', () => {
    it('should answer general questions', async () => {
      const request = {
        question: 'How does ReKey wallet recovery work?',
        context: {
          walletAddress: '11111111111111111111111111111111',
        },
      };
      
      const response = await aiService.answerQuestion(request);
      
      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(0);
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.sources).toBeInstanceOf(Array);
      expect(response.followUpQuestions).toBeInstanceOf(Array);
    });

    it('should answer questions about recovery', async () => {
      const request = {
        question: 'Can I cancel a recovery request?',
      };
      
      const response = await aiService.answerQuestion(request);
      
      expect(response.answer).toContain('cancel');
    });

    it('should generate follow-up questions', async () => {
      const request = {
        question: 'What is a guardian?',
      };
      
      const response = await aiService.answerQuestion(request);
      
      expect(response.followUpQuestions.length).toBeGreaterThan(0);
      expect(response.followUpQuestions.some(q => q.toLowerCase().includes('guardian'))).toBe(true);
    });
  });

  describe('Health Checks', () => {
    it('should check provider health', async () => {
      const health = await aiService.healthCheck();
      
      expect(health).toBeInstanceOf(Object);
      expect(health.nvidia).toBeDefined();
      expect(health.mistral).toBeDefined();
      
      // With test API keys, providers should be healthy or degraded
      Object.values(health).forEach(h => {
        expect(['healthy', 'degraded', 'unhealthy']).toContain(h.status);
        expect(h.lastChecked).toBeDefined();
      });
    });
  });
});

describe('AI Service with Different Providers', () => {
  it('should use NVIDIA provider by default', () => {
    const service = createAIService();
    const provider = service.getProvider();
    
    expect(provider.name).toBe('nvidia');
  });

  it('should allow selecting Mistral provider', () => {
    const service = createAIService();
    service.selectProvider('mistral');
    const provider = service.getProvider();
    
    expect(provider.name).toBe('mistral');
  });
});
