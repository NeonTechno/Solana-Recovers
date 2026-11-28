// ReKey AI - Mistral Provider Implementation

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  AIProvider,
  ProviderName,
  ModelConfig,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  StreamingChatResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  TokenUsage,
  ProviderHealth,
  AIError,
  AIErrorCode,
} from '../types';

// ============================================================================
// Mistral Provider Configuration
// ============================================================================

interface MistralConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
  maxRetries?: number;
}

const DEFAULT_MISTRAL_CONFIG: MistralConfig = {
  apiKey: process.env.MISTRAL_API_KEY || '',
  baseUrl: process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1',
  timeout: 60000,
  maxRetries: 3,
};

// ============================================================================
// Mistral Models
// ============================================================================

const MISTRAL_MODELS: ModelConfig[] = [
  {
    id: 'mistralai/mistral-large-4-1t-a52b',
    name: 'Mistral Large 4',
    description: 'Latest flagship model with advanced reasoning',
    contextWindow: 128000,
    maxTokens: 32000,
    supportsStreaming: true,
    capabilities: ['chat', 'completions'],
  },
  {
    id: 'mistralai/mistral-large-2407',
    name: 'Mistral Large 2407',
    description: 'Previous generation large model',
    contextWindow: 128000,
    maxTokens: 32000,
    supportsStreaming: true,
    capabilities: ['chat', 'completions'],
  },
  {
    id: 'mistralai/mistral-large-2402',
    name: 'Mistral Large 2402',
    description: 'Earlier large model',
    contextWindow: 128000,
    maxTokens: 32000,
    supportsStreaming: true,
    capabilities: ['chat', 'completions'],
  },
  {
    id: 'mistralai/mistral-small-2402',
    name: 'Mistral Small 2402',
    description: 'Fast, cost-effective model',
    contextWindow: 32000,
    maxTokens: 8192,
    supportsStreaming: true,
    capabilities: ['chat', 'completions'],
  },
  {
    id: 'mistralai/mistral-tiny-2402',
    name: 'Mistral Tiny 2402',
    description: 'Compact, efficient model',
    contextWindow: 32000,
    maxTokens: 8192,
    supportsStreaming: true,
    capabilities: ['chat', 'completions'],
  },
  {
    id: 'mistralai/mistral-embed',
    name: 'Mistral Embed',
    description: 'Embedding model',
    contextWindow: 8192,
    maxTokens: 8192,
    supportsStreaming: false,
    capabilities: ['embeddings'],
  },
];

// ============================================================================
// Mistral Provider Class
// ============================================================================

export class MistralProvider implements AIProvider {
  name: ProviderName = 'mistral';
  private config: MistralConfig;
  private client: AxiosInstance;

  constructor(config: Partial<MistralConfig> = {}) {
    this.config = { ...DEFAULT_MISTRAL_CONFIG, ...config };
    
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    });
  }

  isAvailable(): boolean {
    return !!this.config.apiKey && this.config.apiKey.length > 0;
  }

  async listModels(): Promise<ModelConfig[]> {
    return [...MISTRAL_MODELS];
  }

  private convertToMistralMessages(messages: ChatMessage[]): Array<{
    role: string;
    content: string;
  }> {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  private convertFromMistralResponse(
    response: any,
    model: string
  ): ChatResponse {
    const choice = response.choices?.[0];
    
    return {
      id: response.id || `mistral-${Date.now()}`,
      model,
      created: Date.now(),
      content: choice?.message?.content || '',
      role: 'assistant',
      finish_reason: choice?.finish_reason || 'stop',
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      },
    };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.isAvailable()) {
      throw new AIError(
        'PROVIDER_UNAVAILABLE',
        'Mistral provider is not configured with API key'
      );
    }

    const mistralMessages = this.convertToMistralMessages(request.messages);
    
    const payload = {
      model: request.model,
      messages: mistralMessages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 2048,
      top_p: request.top_p ?? 0.9,
      stream: false,
    };

    try {
      const response = await this.client.post('/chat/completions', payload);
      return this.convertFromMistralResponse(response.data, request.model);
    } catch (error) {
      return this.handleError(error, request.model);
    }
  }

  async *streamChat(request: ChatRequest): AsyncIterable<StreamingChatResponse> {
    if (!this.isAvailable()) {
      throw new AIError(
        'PROVIDER_UNAVAILABLE',
        'Mistral provider is not configured with API key'
      );
    }

    const mistralMessages = this.convertToMistralMessages(request.messages);
    
    const payload = {
      model: request.model,
      messages: mistralMessages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 2048,
      top_p: request.top_p ?? 0.9,
      stream: true,
    };

    try {
      const response = await this.client.post('/chat/completions', payload, {
        responseType: 'stream',
      });

      let firstChunk = true;
      let responseId = '';
      let model = '';
      let created = 0;

      for await (const chunk of response.data) {
        if (!chunk || chunk.toString().trim() === '') continue;
        
        const data = this.parseChunk(chunk);
        if (!data) continue;

        if (firstChunk) {
          responseId = data.id || `mistral-${Date.now()}`;
          model = data.model || request.model;
          created = data.created || Date.now();
          firstChunk = false;
        }

        const choice = data.choices?.[0];
        if (choice?.delta?.content) {
          yield {
            id: responseId,
            model,
            created,
            choices: [{
              delta: {
                content: choice.delta.content,
              },
            }],
          };
        }

        if (choice?.finish_reason) {
          yield {
            id: responseId,
            model,
            created,
            choices: [{
              delta: {
                finish_reason: choice.finish_reason,
              },
            }],
          };
        }
      }
    } catch (error) {
      throw this.handleError(error, request.model);
    }
  }

  private parseChunk(chunk: any): any {
    try {
      const text = chunk.toString();
      if (text.startsWith('data: ')) {
        const jsonStr = text.substring(6).trim();
        if (jsonStr === '[DONE]') return null;
        return JSON.parse(jsonStr);
      }
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.isAvailable()) {
      throw new AIError(
        'PROVIDER_UNAVAILABLE',
        'Mistral provider is not configured with API key'
      );
    }

    const input = Array.isArray(request.input) ? request.input : [request.input];
    
    const payload = {
      model: request.model || 'mistral-embed',
      input,
    };

    try {
      const response = await this.client.post('/embeddings', payload);
      
      return {
        data: response.data.data.map((item: any, index: number) => ({
          embedding: item.embedding,
          index,
        })),
        model: request.model || 'mistral-embed',
        usage: {
          prompt_tokens: response.data.usage?.prompt_tokens || 0,
          completion_tokens: 0,
          total_tokens: response.data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      throw this.handleError(error, request.model);
    }
  }

  private handleError(error: any, model: string): never {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      switch (status) {
        case 401:
          throw new AIError('API_KEY_INVALID', 'Invalid Mistral API key', undefined, false);
        case 429:
          throw new AIError('RATE_LIMITED', 'Rate limit exceeded', undefined, true);
        case 404:
          throw new AIError('MODEL_NOT_FOUND', `Model '${model}' not found`, undefined, false);
        case 500:
        case 502:
        case 503:
        case 504:
          throw new AIError('NETWORK_ERROR', 'Mistral service unavailable', { status }, true);
        default:
          throw new AIError('INTERNAL_ERROR', message, { status, error: error.message });
      }
    }
    
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new AIError('TIMEOUT', 'Request timed out', undefined, true);
    }
    
    throw new AIError('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error');
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.isAvailable()) {
      return {
        status: 'unhealthy',
        message: 'No API key configured',
        lastChecked: Date.now(),
      };
    }

    try {
      const response = await this.client.get('/models', {
        timeout: 5000,
      });
      
      if (response.status === 200) {
        return {
          status: 'healthy',
          message: 'Mistral provider is available',
          lastChecked: Date.now(),
        };
      }
      
      return {
        status: 'degraded',
        message: 'Unexpected response from Mistral API',
        lastChecked: Date.now(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Health check failed';
      return {
        status: 'unhealthy',
        message,
        lastChecked: Date.now(),
      };
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMistralProvider(config: Partial<MistralConfig> = {}): MistralProvider {
  return new MistralProvider(config);
}
