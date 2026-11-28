// ReKey AI Provider Abstraction Types

import { z } from 'zod';

// ============================================================================
// Provider Configuration Types
// ============================================================================

export type ProviderName = 'nvidia' | 'mistral' | 'openai' | 'anthropic' | 'minimax' | 'custom';

export interface ProviderConfig {
  name: ProviderName;
  apiKey: string;
  baseUrl: string;
  models: ModelConfig[];
  timeout?: number; // milliseconds
  maxRetries?: number;
  rateLimit?: RateLimitConfig;
}

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  maxTokens: number;
  supportsStreaming: boolean;
  capabilities: ModelCapability[];
}

export type ModelCapability = 
  | 'chat'
  | 'completions'
  | 'embeddings'
  | 'classification'
  | 'moderation';

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

// ============================================================================
// AI Request/Response Types
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
  tools?: ToolDefinition[];
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatResponse {
  id: string;
  model: string;
  created: number;
  content: string;
  role: 'assistant';
  finish_reason: string;
  usage: TokenUsage;
  tool_calls?: ToolCall[];
}

export interface StreamingChatResponse {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
      finish_reason?: string;
    };
  }>;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
}

export interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: TokenUsage;
}

// ============================================================================
// AI Feature Types (ReKey-specific)
// ============================================================================

export interface PolicyExplanationRequest {
  walletAddress: string;
  policy: {
    guardians: string[];
    threshold: number;
    delaySeconds: number;
  };
  userLanguage?: string;
}

export interface PolicyExplanationResponse {
  walletAddress: string;
  summary: string;
  guardianExplanation: string;
  thresholdExplanation: string;
  timelockExplanation: string;
  securityImplications: string[];
  recommendations: string[];
  usage: TokenUsage;
}

export interface ReadinessAssessmentRequest {
  walletAddress: string;
  policy: {
    guardians: string[];
    threshold: number;
    delaySeconds: number;
  };
  walletBalance?: number;
  guardianVerifiedStatus?: Record<string, boolean>;
}

export interface ReadinessAssessmentResponse {
  walletAddress: string;
  overallScore: number; // 0-100
  isReady: boolean;
  requirements: Array<{
    id: string;
    name: string;
    description: string;
    isMet: boolean;
    weight: number;
    details?: string;
  }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    description: string;
    impact: string;
  }>;
  risks: string[];
  usage: TokenUsage;
}

export interface GuardianThresholdExplanationRequest {
  walletAddress: string;
  threshold: number;
  guardianCount: number;
  guardianLabels?: string[];
}

export interface GuardianThresholdExplanationResponse {
  walletAddress: string;
  threshold: number;
  guardianCount: number;
  explanation: string;
  examples: string[];
  math: string;
  implications: string[];
  usage: TokenUsage;
}

export interface SecurityRecommendationRequest {
  walletAddress: string;
  currentConfig: {
    guardians: string[];
    threshold: number;
    delaySeconds: number;
  };
  preferences?: {
    securityLevel: 'low' | 'medium' | 'high';
    convenience: 'low' | 'medium' | 'high';
  };
}

export interface SecurityRecommendationResponse {
  walletAddress: string;
  recommendations: Array<{
    category: 'guardians' | 'threshold' | 'timelock' | 'diversity' | 'monitoring';
    action: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    currentValue?: string | number;
    recommendedValue?: string | number;
    impact: string;
  }>;
  rationale: string;
  usage: TokenUsage;
}

export interface RecoverySimulationGuideRequest {
  walletAddress: string;
  newOwner: string;
  guardians: string[];
  threshold: number;
  delaySeconds: number;
}

export interface RecoverySimulationGuideResponse {
  walletAddress: string;
  steps: Array<{
    step: number;
    title: string;
    description: string;
    actor: string;
    required: boolean;
    estimatedTime?: string;
  }>;
  timeline: {
    totalEstimatedTime: string;
    criticalPath: string[];
    dependencies: Array<{
      step: number;
      dependsOn: number[];
    }>;
  };
  checkpoints: Array<{
    id: string;
    description: string;
    verificationMethod: string;
  }>;
  warnings: string[];
  usage: TokenUsage;
}

export interface RewardsExplanationRequest {
  walletAddress: string;
  points: number;
  achievements: Array<{
    id: string;
    name: string;
    points: number;
    earnedAt: number;
  }>;
  eligibleActions?: string[];
}

export interface RewardsExplanationResponse {
  walletAddress: string;
  currentPoints: number;
  achievementsSummary: string;
  pointsBreakdown: Array<{
    category: string;
    points: number;
    description: string;
  }>;
  eligibleActions: Array<{
    action: string;
    points: number;
    description: string;
    requirements: string[];
  }>;
  nextMilestone?: {
    pointsNeeded: number;
    reward: string;
    description: string;
  };
  usage: TokenUsage;
}

export interface GeneralQuestionRequest {
  question: string;
  context?: {
    walletAddress?: string;
    policy?: any;
    history?: any;
  };
}

export interface GeneralQuestionResponse {
  answer: string;
  confidence: number;
  sources: string[];
  followUpQuestions: string[];
  usage: TokenUsage;
}

// ============================================================================
// AI Provider Interface
// ============================================================================

export interface AIProvider {
  name: ProviderName;
  
  /**
   * Check if the provider is available and configured
   */
  isAvailable(): boolean;
  
  /**
   * List available models
   */
  listModels(): Promise<ModelConfig[]>;
  
  /**
   * Chat completion
   */
  chat(request: ChatRequest): Promise<ChatResponse>;
  
  /**
   * Streaming chat completion
   */
  streamChat(request: ChatRequest): AsyncIterable<StreamingChatResponse>;
  
  /**
   * Get embeddings
   */
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  
  /**
   * Health check
   */
  healthCheck(): Promise<ProviderHealth>;
}

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastChecked: number;
}

// ============================================================================
// AI Service Interface
// ============================================================================

export interface AIService {
  /**
   * Get the current active provider
   */
  getProvider(): AIProvider;
  
  /**
   * List all available providers
   */
  listProviders(): ProviderName[];
  
  /**
   * Select a specific provider
   */
  selectProvider(providerName: ProviderName): void;
  
  /**
   * Explain recovery policy
   */
  explainPolicy(request: PolicyExplanationRequest): Promise<PolicyExplanationResponse>;
  
  /**
   * Assess recovery readiness
   */
  assessReadiness(request: ReadinessAssessmentRequest): Promise<ReadinessAssessmentResponse>;
  
  /**
   * Explain guardian threshold
   */
  explainThreshold(request: GuardianThresholdExplanationRequest): Promise<GuardianThresholdExplanationResponse>;
  
  /**
   * Get security recommendations
   */
  recommendSecurity(request: SecurityRecommendationRequest): Promise<SecurityRecommendationResponse>;
  
  /**
   * Guide recovery simulation
   */
  guideSimulation(request: RecoverySimulationGuideRequest): Promise<RecoverySimulationGuideResponse>;
  
  /**
   * Explain rewards
   */
  explainRewards(request: RewardsExplanationRequest): Promise<RewardsExplanationResponse>;
  
  /**
   * Answer general questions
   */
  answerQuestion(request: GeneralQuestionRequest): Promise<GeneralQuestionResponse>;
  
  /**
   * Health check all providers
   */
  healthCheck(): Promise<Record<ProviderName, ProviderHealth>>;
}

// ============================================================================
// Error Types
// ============================================================================

export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
    public readonly details?: any,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export type AIErrorCode = 
  | 'PROVIDER_UNAVAILABLE'
  | 'MODEL_NOT_FOUND'
  | 'API_KEY_INVALID'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_INPUT'
  | 'CONTENT_FILTERED'
  | 'INTERNAL_ERROR';

// ============================================================================
// Configuration Schema
// ============================================================================

export const AIConfigSchema = z.object({
  defaultProvider: z.enum(['nvidia', 'mistral', 'openai', 'anthropic', 'minimax', 'custom']).default('nvidia'),
  providers: z.object({
    nvidia: z.object({
      apiKey: z.string().optional(),
      baseUrl: z.string().default('https://integrate.api.nvidia.com/v1'),
      models: z.array(z.object({
        id: z.string(),
        name: z.string(),
        contextWindow: z.number().optional(),
        maxTokens: z.number().optional(),
      })).optional(),
    }).optional(),
    mistral: z.object({
      apiKey: z.string().optional(),
      baseUrl: z.string().default('https://api.mistral.ai/v1'),
    }).optional(),
    minimax: z.object({
      apiKey: z.string().optional(),
      baseUrl: z.string().default('https://api.minimax.ai/v1'),
    }).optional(),
  }).optional(),
  timeout: z.number().default(60000),
  maxRetries: z.number().default(3),
});

export type AIConfig = z.infer<typeof AIConfigSchema>;
