// ReKey AI - NVIDIA Provider Implementation

import axios, { AxiosInstance, AxiosError, CancelTokenSource } from 'axios';
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
// NVIDIA Provider Configuration
// ============================================================================

interface NVIDIAConfig {
  apiKey: string;
  baseUrl: string;
  safetyApiKey?: string;
  safetyBaseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

const DEFAULT_NVIDIA_CONFIG: NVIDIAConfig = {
  apiKey: process.env.NVIDIA_API_KEY || '',
  baseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  safetyApiKey: process.env.NVIDIA_SAFETY_MODEL ? undefined : process.env.NVIDIA_API_KEY1,
  safetyBaseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  timeout: 60000,
  maxRetries: 3,
};

// ============================================================================
// NVIDIA Models
// ============================================================================

const NVIDIA_MODELS: ModelConfig[] = [
  {
    id: 'nvidia/llama-3.2-3b-instruct',
    name: 'Llama 3.2 3B Instruct',
    description: 'Lightweight, fast model for general tasks',
    contextWindow: 128000,
    maxTokens: 8192,
    supportsStreaming: true,
    capabilities: ['chat', 'completions'],
  },
  {
    id: 'nvidia/llama-3.2-11b-instruct',
    name: 'Llama 3.2 11B Instruct',
    description: 'Medium-sized model with good balance',
    contextWindow: 128000,
    maxTokens: 8192,
    supportsStreaming: true,
    capabilities: ['chat', 'completions'],
  },
  {
    id: 'nvidia/llama-3.2-70b-instruct',
    name: 'Llama 3.2 70B Instruct',
    description: 'High-capacity model for complex tasks',
    contextWindow: 128000,
    maxTokens: 8192,
    supportsStreaming: true,
    capabilities: ['chat', 'completions'],
  },
  {
    id: 'nvidia/llama-3.2-90b-instruct',
    name: 'Llama 3.2 90B Instruct',
    description: 'Large model for maximum capability',
    contextWindow: 128000,
    maxTokens: 8192,
    supportsStreaming: true,
    capabilities: ['chat', 'completions'],
  },
  {
    id: 'nvidia/mistral-large-4-1t-a52b',
    name: 'Mistral Large 4',
    description: 'Mistral AI model for advanced reasoning',
    contextWindow: 128000,
    maxTokens: 32000,
    supportsStreaming: true,
    capabilities: ['chat', 'completions'],
  },
  {
    id: 'nvidia/nemotron-3.5-content-safety',
    name: 'Nemotron 3.5 Content Safety',
    description: 'Content safety and moderation model',
    contextWindow: 32000,
    maxTokens: 4096,
    supportsStreaming: false,
    capabilities: ['moderation'],
  },
];

// ============================================================================
// NVIDIA Provider Class
// ============================================================================

export class NVIDIAProvider implements AIProvider {
  name: ProviderName = 'nvidia';
  private config: NVIDIAConfig;
  private client: AxiosInstance;
  private safetyClient: AxiosInstance | null = null;

  constructor(config: Partial<NVIDIAConfig> = {}) {
    this.config = { ...DEFAULT_NVIDIA_CONFIG, ...config };
    
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    });
    
    // Create safety client if configured
    if (this.config.safetyApiKey) {
      this.safetyClient = axios.create({
        baseURL: this.config.safetyBaseUrl || this.config.baseUrl,
        timeout: this.config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.safetyApiKey}`,
        },
      });
    }
  }

  isAvailable(): boolean {
    return !!this.config.apiKey && this.config.apiKey.length > 0;
  }

  async listModels(): Promise<ModelConfig[]> {
    return [...NVIDIA_MODELS];
  }

  private convertToNVIDIAMessages(messages: ChatMessage[]): Array<{
    role: string;
    content: string;
  }> {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  private convertFromNVIDIAResponse(
    response: any,
    model: string
  ): ChatResponse {
    const nvidiaChoice = response.choices?.[0];
    
    return {
      id: response.id || `nvidia-${Date.now()}`,
      model,
      created: Date.now(),
      content: nvidiaChoice?.message?.content || '',
      role: 'assistant',
      finish_reason: nvidiaChoice?.finish_reason || 'stop',
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
        'NVIDIA provider is not configured with API key'
      );
    }

    const nvidiaMessages = this.convertToNVIDIAMessages(request.messages);
    
    const payload = {
      model: request.model,
      messages: nvidiaMessages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 2048,
      top_p: request.top_p ?? 0.9,
      stream: false,
    };

    try {
      const response = await this.client.post('/chat/completions', payload);
      return this.convertFromNVIDIAResponse(response.data, request.model);
    } catch (error) {
      return this.handleError(error, request.model);
    }
  }

  async *streamChat(request: ChatRequest): AsyncIterable<StreamingChatResponse> {
    if (!this.isAvailable()) {
      throw new AIError(
        'PROVIDER_UNAVAILABLE',
        'NVIDIA provider is not configured with API key'
      );
    }

    const nvidiaMessages = this.convertToNVIDIAMessages(request.messages);
    
    const payload = {
      model: request.model,
      messages: nvidiaMessages,
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
          responseId = data.id || `nvidia-${Date.now()}`;
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
        'NVIDIA provider is not configured with API key'
      );
    }

    // NVIDIA uses a different endpoint for embeddings
    // This is a simplified implementation
    const input = Array.isArray(request.input) ? request.input : [request.input];
    
    const payload = {
      model: request.model,
      input,
    };

    try {
      const response = await this.client.post('/embeddings', payload);
      
      return {
        data: response.data.data.map((item: any, index: number) => ({
          embedding: item.embedding,
          index,
        })),
        model: request.model,
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
          throw new AIError('API_KEY_INVALID', 'Invalid NVIDIA API key', undefined, false);
        case 429:
          throw new AIError('RATE_LIMITED', 'Rate limit exceeded', undefined, true);
        case 404:
          throw new AIError('MODEL_NOT_FOUND', `Model '${model}' not found`, undefined, false);
        case 500:
        case 502:
        case 503:
        case 504:
          throw new AIError('NETWORK_ERROR', 'NVIDIA service unavailable', { status }, true);
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
      // Test with a simple model list request
      const response = await this.client.get('/models', {
        timeout: 5000,
      });
      
      if (response.status === 200) {
        return {
          status: 'healthy',
          message: 'NVIDIA provider is available',
          lastChecked: Date.now(),
        };
      }
      
      return {
        status: 'degraded',
        message: 'Unexpected response from NVIDIA API',
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

export function createNVIDIAProvider(config: Partial<NVIDIAConfig> = {}): NVIDIAProvider {
  return new NVIDIAProvider(config);
}
