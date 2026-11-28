// ReKey AI - Main AI Service
// Provides provider abstraction and ReKey-specific AI features

import {
  AIService,
  AIProvider,
  ProviderName,
  ModelConfig,
  ChatRequest,
  ChatResponse,
  StreamingChatResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  PolicyExplanationRequest,
  PolicyExplanationResponse,
  ReadinessAssessmentRequest,
  ReadinessAssessmentResponse,
  GuardianThresholdExplanationRequest,
  GuardianThresholdExplanationResponse,
  SecurityRecommendationRequest,
  SecurityRecommendationResponse,
  RecoverySimulationGuideRequest,
  RecoverySimulationGuideResponse,
  RewardsExplanationRequest,
  RewardsExplanationResponse,
  GeneralQuestionRequest,
  GeneralQuestionResponse,
  ProviderHealth,
  AIError,
  AIErrorCode,
  AIConfig,
  AIConfigSchema,
} from './types';
import { NVIDIAProvider, createNVIDIAProvider } from './providers/nvidiaProvider';
import { MistralProvider, createMistralProvider } from './providers/mistralProvider';
import { z } from 'zod';

// ============================================================================
// AI Service Configuration
// ============================================================================

interface ServiceConfig {
  defaultProvider?: ProviderName;
  providers?: Partial<Record<ProviderName, any>>;
  fallbackProviders?: ProviderName[];
  timeout?: number;
  maxRetries?: number;
}

const DEFAULT_SERVICE_CONFIG: ServiceConfig = {
  defaultProvider: 'nvidia',
  fallbackProviders: ['nvidia', 'mistral'],
  timeout: 60000,
  maxRetries: 3,
};

// ============================================================================
// AI Service Implementation
// ============================================================================

export class ReKeyAIService implements AIService {
  private config: ServiceConfig;
  private providers: Map<ProviderName, AIProvider>;
  private activeProvider: AIProvider | null = null;

  constructor(config: Partial<ServiceConfig> = {}) {
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config };
    this.providers = new Map();
    
    // Initialize providers
    this.initializeProviders();
    
    // Set active provider
    this.setActiveProvider(this.config.defaultProvider!);
  }

  private initializeProviders(): void {
    // Initialize NVIDIA provider
    this.providers.set('nvidia', createNVIDIAProvider());
    
    // Initialize Mistral provider
    this.providers.set('mistral', createMistralProvider());
    
    // Initialize Minimax provider (placeholder)
    // this.providers.set('minimax', createMinimaxProvider());
  }

  private setActiveProvider(providerName: ProviderName): void {
    const provider = this.providers.get(providerName);
    if (provider && provider.isAvailable()) {
      this.activeProvider = provider;
    } else if (this.config.fallbackProviders) {
      // Try fallback providers
      for (const fallbackName of this.config.fallbackProviders) {
        const fallbackProvider = this.providers.get(fallbackName);
        if (fallbackProvider && fallbackProvider.isAvailable()) {
          this.activeProvider = fallbackProvider;
          break;
        }
      }
    }
  }

  getProvider(): AIProvider {
    if (!this.activeProvider) {
      throw new AIError(
        'PROVIDER_UNAVAILABLE',
        'No AI provider is configured and available'
      );
    }
    return this.activeProvider;
  }

  listProviders(): ProviderName[] {
    return Array.from(this.providers.keys()).filter(name => {
      const provider = this.providers.get(name);
      return provider && provider.isAvailable();
    });
  }

  selectProvider(providerName: ProviderName): void {
    this.setActiveProvider(providerName);
  }

  // ============================================================================
  // Core AI Methods
  // ============================================================================

  async listModels(): Promise<ModelConfig[]> {
    return this.getProvider().listModels();
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.executeWithFallback('chat', request);
  }

  async *streamChat(request: ChatRequest): AsyncIterable<StreamingChatResponse> {
    yield* this.getProvider().streamChat(request);
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return this.executeWithFallback('embed', request);
  }

  private async executeWithFallback<T>(
    method: 'chat' | 'embed',
    request: ChatRequest | EmbeddingRequest
  ): Promise<T> {
    const providersToTry = [
      this.activeProvider,
      ...this.config.fallbackProviders?.map(name => this.providers.get(name)).filter(Boolean) || [],
    ];

    let lastError: Error | undefined;

    for (const provider of providersToTry) {
      if (!provider || !provider.isAvailable()) continue;

      try {
        if (method === 'chat') {
          return await provider.chat(request as ChatRequest) as unknown as T;
        } else {
          return await provider.embed(request as EmbeddingRequest) as unknown as T;
        }
      } catch (error) {
        lastError = error as Error;
        // Continue to next provider
      }
    }

    throw lastError || new AIError('PROVIDER_UNAVAILABLE', 'All providers failed');
  }

  // ============================================================================
  // ReKey-Specific AI Features
  // ============================================================================

  async explainPolicy(
    request: PolicyExplanationRequest
  ): Promise<PolicyExplanationResponse> {
    const { walletAddress, policy, userLanguage = 'English' } = request;

    // Build system prompt for policy explanation
    const systemPrompt = `You are a helpful assistant that explains Solana wallet recovery policies.
    You are accurate, clear, and provide actionable information.
    Always explain in terms of security and what the user needs to know.
    `;

    const userPrompt = `Please explain my recovery policy:
    - Guardians (${policy.guardians.length}): ${policy.guardians.join(', ')}
    - Threshold: ${policy.threshold} of ${policy.guardians.length}
    - Timelock delay: ${policy.delaySeconds / 86400} days
    
    Please provide:
    1. A brief summary of my policy
    2. Explanation of what my guardians do
    3. What the threshold means
    4. What the timelock means
    5. Security implications
    6. Any recommendations
    
    Respond in ${userLanguage}.`;

    const response = await this.chat({
      model: 'nvidia/mistral-large-4-1t-a52b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    // Parse the response (in production, use structured output)
    return this.parsePolicyExplanation(response, walletAddress, policy);
  }

  private parsePolicyExplanation(
    response: ChatResponse,
    walletAddress: string,
    policy: PolicyExplanationRequest['policy']
  ): PolicyExplanationResponse {
    // This is a simplified parser
    // In production, use structured output from the AI
    const content = response.content;

    return {
      walletAddress,
      summary: content.split('\n\n')[0] || content.substring(0, 200),
      guardianExplanation: 'Your guardians are trusted contacts who can approve recovery requests. They do not have spending authority over your wallet.',
      thresholdExplanation: `Your threshold of ${policy.threshold} means that ${policy.threshold} out of ${policy.guardians.length} guardians must approve any recovery request before it can proceed.`,
      timelockExplanation: `Your timelock of ${policy.delaySeconds / 86400} days means there is a waiting period after threshold is reached before recovery can be executed. This gives you time to cancel if unauthorized.`,
      securityImplications: [
        `With ${policy.guardians.length} guardians and threshold of ${policy.threshold}, you have ${'good' if policy.guardians.length >= 3 else 'moderate'} redundancy.`,
        `The timelock provides protection against rushed recovery attempts.`,
        'Guardians cannot spend your funds; they can only approve ownership changes.',
      ],
      recommendations: [
        `Ensure all ${policy.guardians.length} guardians are trustworthy and available.`,
        `Consider adding more guardians if you want higher redundancy.`,
        `Review your timelock period regularly.`,
      ],
      usage: response.usage,
    };
  }

  async assessReadiness(
    request: ReadinessAssessmentRequest
  ): Promise<ReadinessAssessmentResponse> {
    const { walletAddress, policy, walletBalance, guardianVerifiedStatus } = request;

    // Build system prompt for readiness assessment
    const systemPrompt = `You are a security assistant evaluating wallet recovery readiness.
    Analyze the configuration and provide an objective assessment.
    Be thorough and provide specific recommendations.
    `;

    const guardianStatus = guardianVerifiedStatus 
      ? Object.entries(guardianVerifiedStatus).map(([g, v]) => 
          `${g}: ${v ? 'verified' : 'not verified'}`
        ).join('\n')
      : 'Verification status unknown';

    const userPrompt = `Evaluate my recovery readiness:
    Wallet: ${walletAddress}
    Balance: ${walletBalance || 'unknown'} SOL
    
    Policy:
    - Guardians: ${policy.guardians.length} (${guardianStatus})
    - Threshold: ${policy.threshold} of ${policy.guardians.length}
    - Timelock: ${policy.delaySeconds / 86400} days
    
    Please provide:
    1. Overall score (0-100)
    2. Whether I'm ready for recovery
    3. List of requirements and whether they are met
    4. Specific recommendations with priority
    5. Any risks I should be aware of
    
    Be specific and actionable.`;

    const response = await this.chat({
      model: 'nvidia/mistral-large-4-1t-a52b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2048,
    });

    // Parse the response
    return this.parseReadinessAssessment(response, request);
  }

  private parseReadinessAssessment(
    response: ChatResponse,
    request: ReadinessAssessmentRequest
  ): ReadinessAssessmentResponse {
    const { policy } = request;
    const hasEnoughGuardians = policy.guardians.length >= policy.threshold;
    const hasValidThreshold = policy.threshold > 0 && policy.threshold <= policy.guardians.length;
    const hasTimelock = policy.delaySeconds >= 60;
    const hasGuardians = policy.guardians.length > 0;

    const requirements = [
      {
        id: 'guardians_configured',
        name: 'Guardians Configured',
        description: 'At least one guardian must be configured',
        isMet: hasGuardians,
        weight: 0.3,
      },
      {
        id: 'threshold_valid',
        name: 'Valid Threshold',
        description: 'Threshold must be between 1 and number of guardians',
        isMet: hasValidThreshold,
        weight: 0.3,
      },
      {
        id: 'enough_guardians',
        name: 'Enough Guardians',
        description: `At least ${policy.threshold} guardians configured`,
        isMet: hasEnoughGuardians,
        weight: 0.25,
      },
      {
        id: 'timelock_configured',
        name: 'Timelock Configured',
        description: 'Recovery timelock must be configured (minimum 60 seconds)',
        isMet: hasTimelock,
        weight: 0.15,
      },
    ];

    const metScore = requirements
      .filter(r => r.isMet)
      .reduce((sum, r) => sum + r.weight, 0);
    
    const overallScore = Math.round(metScore * 100);
    const isReady = overallScore >= 80;

    const recommendations = [];
    if (!hasGuardians) {
      recommendations.push({
        priority: 'high',
        action: 'Configure guardians',
        description: 'You must add at least one guardian to enable recovery',
        impact: 'Without guardians, recovery is impossible',
      });
    }
    if (!hasValidThreshold) {
      recommendations.push({
        priority: 'high',
        action: 'Set valid threshold',
        description: 'Threshold must be between 1 and your number of guardians',
        impact: 'Invalid threshold prevents recovery',
      });
    }
    if (!hasEnoughGuardians) {
      recommendations.push({
        priority: 'high',
        action: `Add ${policy.threshold - policy.guardians.length} more guardian(s)`,
        description: `You need at least ${policy.threshold} guardians to meet your threshold`,
        impact: 'Cannot reach approval threshold with current configuration',
      });
    }
    if (!hasTimelock) {
      recommendations.push({
        priority: 'medium',
        action: 'Set recovery timelock',
        description: 'A timelock provides protection against unauthorized recovery',
        impact: 'Without timelock, recovery executes immediately upon threshold',
      });
    }

    const risks = [];
    if (policy.guardians.length < 3) {
      risks.push('Low redundancy: consider adding more guardians');
    }
    if (policy.delaySeconds < 86400) {
      risks.push('Short timelock: consider increasing to at least 24 hours');
    }

    return {
      walletAddress: request.walletAddress,
      overallScore,
      isReady,
      requirements: requirements as any, // Type assertion for demo
      recommendations: recommendations as any,
      risks,
      usage: response.usage,
    };
  }

  async explainThreshold(
    request: GuardianThresholdExplanationRequest
  ): Promise<GuardianThresholdExplanationResponse> {
    const { walletAddress, threshold, guardianCount, guardianLabels } = request;

    const systemPrompt = `You are an assistant that explains threshold concepts clearly.
    Use simple, concrete examples. Avoid jargon.
    `;

    const guardianList = guardianLabels?.join(', ') || 
      `Guardian 1, Guardian 2, ..., Guardian ${guardianCount}`;

    const userPrompt = `Explain the threshold concept for my wallet:
    - Threshold: ${threshold} of ${guardianCount}
    - Guardians: ${guardianList}
    
    Please provide:
    1. A clear explanation of what this means
    2. Concrete examples of how it works
    3. The mathematics behind it
    4. Security implications
    
    Use simple language.`;

    const response = await this.chat({
      model: 'nvidia/mistral-large-4-1t-a52b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1536,
    });

    return {
      walletAddress,
      threshold,
      guardianCount,
      explanation: `With a threshold of ${threshold} of ${guardianCount}, you need approval from at least ${threshold} out of your ${guardianCount} guardians for a recovery request to proceed. This prevents any single guardian from triggering a recovery.`,
      examples: [
        `If any ${threshold} of your guardians approve a recovery request, it meets the threshold.`,
        `If fewer than ${threshold} guardians approve, the request cannot proceed.`,
        `All ${guardianCount} guardians approving would exceed the threshold.`,
      ],
      math: `${threshold}/${guardianCount} = ${Math.round((threshold / guardianCount) * 100)}% approval required`,
      implications: [
        `Higher threshold = more security but harder to reach`,
        `Lower threshold = easier recovery but less security`,
        `Threshold of ${threshold} balances security and practicality`,
      ],
      usage: response.usage,
    };
  }

  async recommendSecurity(
    request: SecurityRecommendationRequest
  ): Promise<SecurityRecommendationResponse> {
    const { walletAddress, currentConfig, preferences } = request;
    const securityLevel = preferences?.securityLevel || 'medium';
    const convenience = preferences?.convenience || 'medium';

    const recommendations: SecurityRecommendationResponse['recommendations'] = [];

    // Guardian recommendations
    if (currentConfig.guardians.length < 3) {
      recommendations.push({
        category: 'guardians',
        action: `Add ${3 - currentConfig.guardians.length} more guardian(s)`,
        description: 'More guardians provide better redundancy and security',
        priority: 'high',
        currentValue: currentConfig.guardians.length,
        recommendedValue: 3,
        impact: 'Reduces risk of single point of failure',
      });
    }

    // Threshold recommendations
    const idealThreshold = Math.max(
      2,
      Math.ceil(currentConfig.guardians.length * 0.6)
    );
    if (currentConfig.threshold < idealThreshold) {
      recommendations.push({
        category: 'threshold',
        action: `Increase threshold to ${idealThreshold}`,
        description: `Current threshold of ${currentConfig.threshold} may be too low for ${currentConfig.guardians.length} guardians`,
        priority: 'medium',
        currentValue: currentConfig.threshold,
        recommendedValue: idealThreshold,
        impact: 'Improves security by requiring more approvals',
      });
    } else if (currentConfig.threshold > idealThreshold && convenience === 'high') {
      recommendations.push({
        category: 'threshold',
        action: `Consider decreasing threshold to ${idealThreshold}`,
        description: `Current threshold may be too high, making recovery difficult`,
        priority: 'low',
        currentValue: currentConfig.threshold,
        recommendedValue: idealThreshold,
        impact: 'Makes recovery easier but slightly less secure',
      });
    }

    // Timelock recommendations
    const idealDelay = securityLevel === 'high' ? 7 : 
                      securityLevel === 'medium' ? 3 : 1;
    const idealDelaySeconds = idealDelay * 86400;
    
    if (currentConfig.delaySeconds < idealDelaySeconds) {
      recommendations.push({
        category: 'timelock',
        action: `Increase timelock to ${idealDelay} day(s)`,
        description: `Current timelock of ${currentConfig.delaySeconds / 86400} day(s) may be too short`,
        priority: 'medium',
        currentValue: `${currentConfig.delaySeconds / 86400} days`,
        recommendedValue: `${idealDelay} days`,
        impact: 'Gives you more time to cancel unauthorized recovery attempts',
      });
    }

    // Guardian diversity
    // In production, analyze guardian addresses for diversity

    // Monitoring recommendation
    recommendations.push({
      category: 'monitoring',
      action: 'Regularly review your recovery configuration',
      description: 'Review your guardians and policy settings periodically',
      priority: 'medium',
      impact: 'Ensures your recovery setup remains appropriate for your needs',
    });

    return {
      walletAddress,
      recommendations: recommendations as any,
      rationale: `These recommendations are based on your ${securityLevel} security level and ${convenience} convenience preference. They aim to balance security with practical recovery capability.`,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }

  async guideSimulation(
    request: RecoverySimulationGuideRequest
  ): Promise<RecoverySimulationGuideResponse> {
    const { walletAddress, newOwner, guardians, threshold, delaySeconds } = request;

    const steps = [
      {
        step: 1,
        title: 'Request Initiation',
        description: 'A guardian initiates a recovery request specifying the new owner address',
        actor: 'Any guardian',
        required: true,
        estimatedTime: '1 minute',
      },
      {
        step: 2,
        title: 'Guardian Approvals',
        description: `Collect approvals from ${threshold} out of ${guardians.length} guardians`,
        actor: 'Guardians',
        required: true,
        estimatedTime: 'Minutes to hours (depends on guardian availability)',
      },
      {
        step: 3,
        title: 'Threshold Reached',
        description: `Once ${threshold} approvals are collected, the threshold is met`,
        actor: 'System',
        required: true,
        estimatedTime: 'Instant',
      },
      {
        step: 4,
        title: 'Timelock Period',
        description: `Wait for ${delaySeconds / 86400} day(s) before execution is possible`,
        actor: 'System',
        required: true,
        estimatedTime: `${delaySeconds / 86400} day(s)`,
      },
      {
        step: 5,
        title: 'Recovery Execution',
        description: 'After timelock elapses, anyone can execute the recovery to transfer ownership',
        actor: 'Anyone',
        required: true,
        estimatedTime: '1 minute',
      },
    ];

    const timeline = {
      totalEstimatedTime: `${Math.round(delaySeconds / 86400) + 1} day(s)`,
      criticalPath: ['Request Initiation', 'Guardian Approvals', 'Timelock Period', 'Recovery Execution'],
      dependencies: [
        { step: 2, dependsOn: [1] },
        { step: 3, dependsOn: [2] },
        { step: 4, dependsOn: [3] },
        { step: 5, dependsOn: [4] },
      ],
    };

    const checkpoints = [
      {
        id: 'request_created',
        description: 'Recovery request is created and nonce is assigned',
        verificationMethod: 'Check on-chain state for request with matching nonce',
      },
      {
        id: 'threshold_met',
        description: `At least ${threshold} guardian approvals collected`,
        verificationMethod: 'Check approval count in request state',
      },
      {
        id: 'timelock_started',
        description: 'Timelock period has begun',
        verificationMethod: 'Check execute_after timestamp',
      },
      {
        id: 'timelock_elapsed',
        description: 'Timelock period has elapsed',
        verificationMethod: 'Compare current time with execute_after',
      },
      {
        id: 'owner_changed',
        description: 'Wallet ownership has been transferred to new owner',
        verificationMethod: 'Verify wallet config owner field',
      },
    ];

    const warnings = [];
    if (threshold === 1) {
      warnings.push('Warning: Threshold of 1 means any single guardian can trigger recovery');
    }
    if (delaySeconds < 86400) {
      warnings.push('Warning: Short timelock reduces time to cancel unauthorized requests');
    }
    if (guardians.some(g => g === newOwner)) {
      warnings.push('Warning: New owner is also a guardian - this may create conflicts');
    }

    return {
      walletAddress,
      steps: steps as any,
      timeline: timeline as any,
      checkpoints: checkpoints as any,
      warnings,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }

  async explainRewards(
    request: RewardsExplanationRequest
  ): Promise<RewardsExplanationResponse> {
    const { walletAddress, points, achievements, eligibleActions } = request;

    const achievementsSummary = achievements.length > 0
      ? `${achievements.length} achievement(s) earned, totaling ${achievements.reduce((sum, a) => sum + a.points, 0)} points`
      : 'No achievements earned yet';

    const pointsBreakdown = [
      {
        category: 'Wallet Setup',
        points: achievements.filter(a => a.id.includes('init') || a.id.includes('setup')).reduce((sum, a) => sum + a.points, 0),
        description: 'Points for initializing and configuring your ReKey wallet',
      },
      {
        category: 'Security Configuration',
        points: achievements.filter(a => a.id.includes('policy') || a.id.includes('guardian')).reduce((sum, a) => sum + a.points, 0),
        description: 'Points for setting up recovery policy and guardians',
      },
      {
        category: 'Education',
        points: achievements.filter(a => a.id.includes('education') || a.id.includes('simulation')).reduce((sum, a) => sum + a.points, 0),
        description: 'Points for completing security education and simulations',
      },
      {
        category: 'Contributions',
        points: achievements.filter(a => a.id.includes('contribution')).reduce((sum, a) => sum + a.points, 0),
        description: 'Points for contributing to the ReKey ecosystem',
      },
    ];

    const eligibleActionsList = eligibleActions?.map(action => {
      const actionPoints = this.getActionPoints(action);
      return {
        action,
        points: actionPoints,
        description: this.getActionDescription(action),
        requirements: this.getActionRequirements(action),
      };
    }) || [];

    const nextMilestone = this.getNextMilestone(points);

    return {
      walletAddress,
      currentPoints: points,
      achievementsSummary,
      pointsBreakdown: pointsBreakdown as any,
      eligibleActions: eligibleActionsList as any,
      nextMilestone: nextMilestone as any,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }

  private getActionPoints(action: string): number {
    const actionPoints: Record<string, number> = {
      'complete_simulation': 50,
      'verify_guardian': 30,
      'update_policy': 20,
      'security_education': 100,
      'documentation_contribution': 200,
      'integration_contribution': 300,
    };
    return actionPoints[action] || 10;
  }

  private getActionDescription(action: string): string {
    const descriptions: Record<string, string> = {
      'complete_simulation': 'Complete a recovery simulation',
      'verify_guardian': 'Verify a guardian identity',
      'update_policy': 'Update your recovery policy',
      'security_education': 'Complete security education module',
      'documentation_contribution': 'Contribute documentation or tutorials',
      'integration_contribution': 'Build or improve integrations',
    };
    return descriptions[action] || 'Complete action';
  }

  private getActionRequirements(action: string): string[] {
    const requirements: Record<string, string[]> = {
      'complete_simulation': ['Wallet must be initialized', 'Policy must be configured'],
      'verify_guardian': ['Guardian must be added to policy', 'Guardian must confirm identity'],
      'update_policy': ['Wallet must be initialized', 'Must be wallet owner'],
      'security_education': [],
      'documentation_contribution': ['Contribution must be approved by ReKey team'],
      'integration_contribution': ['Integration must be functional and approved'],
    };
    return requirements[action] || [];
  }

  private getNextMilestone(points: number): { pointsNeeded: number; reward: string; description: string } | undefined {
    const milestones = [
      { threshold: 100, reward: 'Bronze Badge', description: 'Basic recovery setup' },
      { threshold: 250, reward: 'Silver Badge', description: 'Intermediate security' },
      { threshold: 500, reward: 'Gold Badge', description: 'Advanced security practitioner' },
      { threshold: 1000, reward: 'Platinum Badge', description: 'Security expert' },
    ];

    for (const milestone of milestones) {
      if (points < milestone.threshold) {
        return {
          pointsNeeded: milestone.threshold - points,
          reward: milestone.reward,
          description: milestone.description,
        };
      }
    }

    return undefined;
  }

  async answerQuestion(
    request: GeneralQuestionRequest
  ): Promise<GeneralQuestionResponse> {
    const { question, context } = request;

    const systemPrompt = `You are a helpful assistant for ReKey, a Solana wallet recovery protocol.
    Answer questions accurately based on the provided context.
    If you don't know the answer, say so.
    Always prioritize security and correct information.
    
    Important guidelines:
    - Never claim an on-chain operation succeeded without transaction confirmation
    - Never expose private keys or sensitive information
    - Explain recovery concepts clearly
    - Be conservative with security advice
    `;

    const contextStr = context ? `Context: ${JSON.stringify(context, null, 2)}` : '';

    const userPrompt = `${contextStr}
    
    Question: ${question}
    
    Please provide:
    1. A direct answer
    2. Explanation or reasoning
    3. Sources or references
    4. Follow-up questions that would help clarify`;

    const response = await this.chat({
      model: 'nvidia/mistral-large-4-1t-a52b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    return {
      answer: response.content,
      confidence: 0.9, // Placeholder - in production, use confidence scoring
      sources: ['ReKey documentation', 'Solana program knowledge'],
      followUpQuestions: this.generateFollowUpQuestions(question),
      usage: response.usage,
    };
  }

  private generateFollowUpQuestions(question: string): string[] {
    const lowerQuestion = question.toLowerCase();
    const followUps: string[] = [];

    if (lowerQuestion.includes('guardian')) {
      followUps.push('How do I add or remove a guardian?');
      followUps.push('What happens if a guardian loses their wallet?');
    }
    if (lowerQuestion.includes('threshold')) {
      followUps.push('How do I change my threshold setting?');
      followUps.push('What is the recommended threshold for my setup?');
    }
    if (lowerQuestion.includes('timelock') || lowerQuestion.includes('delay')) {
      followUps.push('How do I change my timelock period?');
      followUps.push('What is a good timelock duration?');
    }
    if (lowerQuestion.includes('recovery')) {
      followUps.push('Can I cancel a recovery request?');
      followUps.push('What happens to my funds during recovery?');
    }
    if (lowerQuestion.includes('points') || lowerQuestion.includes('rewards')) {
      followUps.push('How do I earn more points?');
      followUps.push('What can I do with my points?');
    }

    return followUps.length > 0 
      ? followUps.slice(0, 3)
      : ['Do you have any other questions about ReKey?'];
  }

  // ============================================================================
  // Health and Status
  // ============================================================================

  async healthCheck(): Promise<Record<ProviderName, ProviderHealth>> {
    const results: Record<ProviderName, ProviderHealth> = {};

    for (const [name, provider] of this.providers.entries()) {
      try {
        results[name] = await provider.healthCheck();
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Health check failed',
          lastChecked: Date.now(),
        };
      }
    }

    return results;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAIService(config: Partial<ServiceConfig> = {}): ReKeyAIService {
  return new ReKeyAIService(config);
}
