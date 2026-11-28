// ReKey MCP Server - Rate Limiting
// Provides configurable rate limiting for API endpoints

import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';
import {
  MCPError,
  MCPErrorCode,
} from './types';
import { AuditLogger } from './audit';

// ============================================================================
// Configuration
// ============================================================================

export interface RateLimitConfig {
  requestsPerWindow: number;
  windowSizeMs: number;
  maxWaitMs?: number;
  
  // Per-endpoint overrides
  endpoints?: Record<string, {
    requestsPerWindow: number;
    windowSizeMs: number;
  }>;
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  requestsPerWindow: 100,
  windowSizeMs: 60 * 1000, // 1 minute
  maxWaitMs: 0, // No waiting, just reject
  endpoints: {
    // Stricter limits for sensitive endpoints
    '/tools/create_recovery_request': {
      requestsPerWindow: 5,
      windowSizeMs: 60 * 1000,
    },
    '/tools/approve_recovery': {
      requestsPerWindow: 10,
      windowSizeMs: 60 * 1000,
    },
    '/tools/execute_recovery': {
      requestsPerWindow: 3,
      windowSizeMs: 60 * 1000,
    },
  },
};

// ============================================================================
// Rate Limiter Implementation
// ============================================================================

export class RateLimiter {
  private rateLimiter: RateLimiterMemory;
  private config: RateLimitConfig;
  private auditLogger: AuditLogger;
  
  // Per-endpoint rate limiters
  private endpointLimiters: Map<string, RateLimiterMemory>;

  constructor(
    config: Partial<RateLimitConfig> = {},
    auditLogger: AuditLogger
  ) {
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
    this.auditLogger = auditLogger;
    this.endpointLimiters = new Map();

    // Create main rate limiter
    this.rateLimiter = new RateLimiterMemory({
      points: this.config.requestsPerWindow,
      duration: this.config.windowSizeMs / 1000,
      blockDuration: this.config.maxWaitMs ? this.config.maxWaitMs / 1000 : 0,
    });

    // Create per-endpoint rate limiters
    for (const [endpoint, endpointConfig] of Object.entries(
      this.config.endpoints || {}
    )) {
      this.endpointLimiters.set(
        endpoint,
        new RateLimiterMemory({
          points: endpointConfig.requestsPerWindow,
          duration: endpointConfig.windowSizeMs / 1000,
          blockDuration: this.config.maxWaitMs ? this.config.maxWaitMs / 1000 : 0,
        })
      );
    }
  }

  /**
   * Check rate limit for a general request
   */
  async consume(ipAddress: string, userId?: string): Promise<RateLimitResult> {
    const key = userId ? `user:${userId}` : `ip:${ipAddress}`;
    
    try {
      const res = await this.rateLimiter.consume(key, 1);
      
      return {
        allowed: true,
        remainingPoints: res.remainingPoints,
        resetTime: res.msBeforeNext,
      };
    } catch (rateLimitRes) {
      return {
        allowed: false,
        remainingPoints: 0,
        resetTime: (rateLimitRes as any).msBeforeNext,
      };
    }
  }

  /**
   * Check rate limit for a specific endpoint
   */
  async consumeEndpoint(
    endpoint: string,
    ipAddress: string,
    userId?: string
  ): Promise<RateLimitResult> {
    const endpointLimiter = this.endpointLimiters.get(endpoint);
    
    if (!endpointLimiter) {
      // No specific endpoint limit, use general limit
      return this.consume(ipAddress, userId);
    }

    const key = userId ? `user:${userId}:${endpoint}` : `ip:${ipAddress}:${endpoint}`;
    
    try {
      const res = await endpointLimiter.consume(key, 1);
      
      return {
        allowed: true,
        remainingPoints: res.remainingPoints,
        resetTime: res.msBeforeNext,
      };
    } catch (rateLimitRes) {
      return {
        allowed: false,
        remainingPoints: 0,
        resetTime: (rateLimitRes as any).msBeforeNext,
      };
    }
  }

  /**
   * Rate limit middleware for Express
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userId = (req as any).authContext?.userId;
      const endpoint = req.path;

      const result = await this.consumeEndpoint(endpoint, ipAddress, userId);

      if (!result.allowed) {
        // Log rate limit hit
        await this.auditLogger.log({
          id: `rate-limit-${Date.now()}`,
          timestamp: Date.now(),
          level: 'warn',
          action: 'rate_limit_hit',
          tool: 'rateLimiter',
          userId,
          ipAddress,
          input: { endpoint, ipAddress, userId },
          output: { resetTime: result.resetTime },
        });

        res.set('X-RateLimit-Limit', this.config.requestsPerWindow.toString());
        res.set('X-RateLimit-Remaining', '0');
        res.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
        
        res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests, please try again later',
            details: {
              resetIn: Math.ceil(result.resetTime / 1000),
              retryAfter: Math.ceil(result.resetTime / 1000),
            },
          },
        });
        return;
      }

      // Set rate limit headers
      res.set('X-RateLimit-Limit', this.config.requestsPerWindow.toString());
      res.set('X-RateLimit-Remaining', result.remainingPoints.toString());
      res.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

      next();
    };
  }

  /**
   * Get rate limit status for a user
   */
  async getRateLimitStatus(ipAddress: string, userId?: string): Promise<RateLimitStatus> {
    const key = userId ? `user:${userId}` : `ip:${ipAddress}`;
    const limit = this.config.requestsPerWindow;
    const windowSize = this.config.windowSizeMs;

    // Get current usage
    const res = await this.rateLimiter.get(key);

    return {
      limit,
      windowSizeMs: windowSize,
      remaining: res?.remainingPoints || limit,
      resetTime: res?.msBeforeNext || 0,
    };
  }

  /**
   * Reset rate limit for a specific key
   * (Useful for testing or admin operations)
   */
  async reset(key: string): Promise<void> {
    await this.rateLimiter.delete(key);
  }
}

// ============================================================================
// Types
// ============================================================================

export interface RateLimitResult {
  allowed: boolean;
  remainingPoints: number;
  resetTime: number;
}

export interface RateLimitStatus {
  limit: number;
  windowSizeMs: number;
  remaining: number;
  resetTime: number;
}

// ============================================================================
// Export
// ============================================================================

export function createRateLimiter(
  config: Partial<RateLimitConfig> = {},
  auditLogger: AuditLogger
): RateLimiter {
  return new RateLimiter(config, auditLogger);
}
