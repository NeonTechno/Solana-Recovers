// ReKey MCP Server - Authentication and Authorization
// Provides session management, token validation, and permission checking

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import {
  AuthContext,
  Permission,
  SessionToken,
  MCPError,
  MCPErrorCode,
} from './types';
import { AuditLogger } from './audit';

// ============================================================================
// Configuration
// ============================================================================

export interface AuthConfig {
  // API key for service-level authentication
  apiKey?: string;
  
  // Session configuration
  sessionSecret: string;
  sessionExpiryMs: number;
  
  // Token configuration
  tokenSecret: string;
  tokenExpiryMs: number;
  
  // CORS origins
  allowedOrigins: string[];
}

const DEFAULT_AUTH_CONFIG: AuthConfig = {
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  sessionExpiryMs: 24 * 60 * 60 * 1000, // 24 hours
  tokenSecret: process.env.TOKEN_SECRET || crypto.randomBytes(32).toString('hex'),
  tokenExpiryMs: 15 * 60 * 1000, // 15 minutes
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
};

// ============================================================================
// Session Store
// ============================================================================

interface Session {
  id: string;
  userId?: string;
  walletAddress?: string;
  permissions: Permission[];
  createdAt: number;
  expiresAt: number;
  ipAddress?: string;
  userAgent?: string;
}

// In-memory session store (in production, use Redis or database)
const sessionStore = new Map<string, Session>();

// Token store
const tokenStore = new Map<string, SessionToken>();

// ============================================================================
// Token Generation and Validation
// ============================================================================

export class TokenManager {
  private config: AuthConfig;
  private auditLogger: AuditLogger;

  constructor(config: Partial<AuthConfig> = {}, auditLogger: AuditLogger) {
    this.config = { ...DEFAULT_AUTH_CONFIG, ...config };
    this.auditLogger = auditLogger;
  }

  /**
   * Generate a new session token
   */
  generateSessionToken(
    userId: string,
    walletAddress: string,
    permissions: Permission[] = []
  ): SessionToken {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + this.config.tokenExpiryMs;

    const sessionToken: SessionToken = {
      token,
      userId,
      walletAddress,
      permissions,
      expiresAt,
      createdAt: now,
    };

    tokenStore.set(token, sessionToken);

    return sessionToken;
  }

  /**
   * Validate a session token
   */
  validateToken(token: string): SessionToken | null {
    const storedToken = tokenStore.get(token);
    if (!storedToken) {
      return null;
    }

    // Check if token has expired
    if (storedToken.expiresAt < Date.now()) {
      tokenStore.delete(token);
      return null;
    }

    return storedToken;
  }

  /**
   * Invalidate a session token
   */
  invalidateToken(token: string): boolean {
    return tokenStore.delete(token);
  }

  /**
   * Create a new session
   */
  createSession(
    userId: string,
    walletAddress: string,
    permissions: Permission[] = [],
    ipAddress?: string,
    userAgent?: string
  ): Session {
    const sessionId = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const expiresAt = now + this.config.sessionExpiryMs;

    const session: Session = {
      id: sessionId,
      userId,
      walletAddress,
      permissions,
      createdAt: now,
      expiresAt,
      ipAddress,
      userAgent,
    };

    sessionStore.set(sessionId, session);

    // Audit log
    this.auditLogger.log({
      id: `session-create-${sessionId}`,
      timestamp: now,
      level: 'info',
      action: 'session_create',
      tool: 'auth',
      userId,
      walletAddress,
      sessionId,
      input: { userId, walletAddress, permissions },
      output: { sessionId },
    });

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | null {
    const session = sessionStore.get(sessionId);
    if (!session) {
      return null;
    }

    // Check if session has expired
    if (session.expiresAt < Date.now()) {
      sessionStore.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Invalidate session
   */
  invalidateSession(sessionId: string): boolean {
    const session = sessionStore.get(sessionId);
    if (session) {
      // Audit log
      this.auditLogger.log({
        id: `session-invalidate-${sessionId}`,
        timestamp: Date.now(),
        level: 'info',
        action: 'session_invalidate',
        tool: 'auth',
        userId: session.userId,
        walletAddress: session.walletAddress,
        sessionId,
        input: { sessionId },
        output: { success: true },
      });
    }

    return sessionStore.delete(sessionId);
  }

  /**
   * Clean up expired sessions and tokens
   */
  cleanupExpired(): void {
    const now = Date.now();

    // Clean up expired sessions
    for (const [sessionId, session] of sessionStore.entries()) {
      if (session.expiresAt < now) {
        sessionStore.delete(sessionId);
      }
    }

    // Clean up expired tokens
    for (const [token, tokenData] of tokenStore.entries()) {
      if (tokenData.expiresAt < now) {
        tokenStore.delete(token);
      }
    }
  }
}

// ============================================================================
// Authentication Middleware
// ============================================================================

export class AuthMiddleware {
  private tokenManager: TokenManager;
  private config: AuthConfig;

  constructor(tokenManager: TokenManager, config: Partial<AuthConfig> = {}) {
    this.tokenManager = tokenManager;
    this.config = { ...DEFAULT_AUTH_CONFIG, ...config };
  }

  /**
   * API Key authentication middleware
   */
  apiKeyAuth() {
    return (req: Request, res: Response, next: NextFunction) => {
      const apiKey = req.headers['x-api-key'] as string | undefined;

      if (!apiKey || apiKey !== this.config.apiKey) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or missing API key',
          },
        });
        return;
      }

      // API key authentication successful
      (req as any).authContext = {
        isAuthenticated: true,
        permissions: ['read:wallet', 'read:policy', 'read:guardians', 'read:history'],
        sessionId: crypto.randomBytes(16).toString('hex'),
        timestamp: Date.now(),
      };

      next();
    };
  }

  /**
   * Session token authentication middleware
   */
  sessionAuth() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Get token from Authorization header
      const authHeader = req.headers['authorization'] as string | undefined;
      const token = authHeader?.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : undefined;

      if (!token) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing authentication token',
          },
        });
        return;
      }

      // Validate token
      const sessionToken = this.tokenManager.validateToken(token);
      if (!sessionToken) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired token',
          },
        });
        return;
      }

      // Create auth context
      const authContext: AuthContext = {
        userId: sessionToken.userId,
        sessionId: crypto.randomBytes(16).toString('hex'),
        walletAddress: sessionToken.walletAddress,
        isAuthenticated: true,
        permissions: sessionToken.permissions,
        timestamp: Date.now(),
      };

      (req as any).authContext = authContext;
      (req as any).token = token;

      next();
    };
  }

  /**
   * Permission checking middleware
   */
  requirePermission(...requiredPermissions: Permission[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const authContext = (req as any).authContext as AuthContext | undefined;

      if (!authContext?.isAuthenticated) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
        return;
      }

      // Check if user has all required permissions
      const hasAllPermissions = requiredPermissions.every(perm =>
        authContext.permissions.includes(perm)
      );

      if (!hasAllPermissions) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
            details: {
              required: requiredPermissions,
              has: authContext.permissions,
            },
          },
        });
        return;
      }

      next();
    };
  }

  /**
   * Wallet ownership verification middleware
   */
  requireWalletOwner(walletAddressParam: string = 'walletAddress') {
    return (req: Request, res: Response, next: NextFunction) => {
      const authContext = (req as any).authContext as AuthContext | undefined;
      const requestedWallet = req.params[walletAddressParam] || 
        req.query[walletAddressParam] as string | undefined;

      if (!authContext?.isAuthenticated) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
        return;
      }

      // Allow if user is admin or wallet owner
      const isAdmin = authContext.permissions.includes('admin');
      const isOwner = authContext.walletAddress?.toLowerCase() === 
        requestedWallet?.toLowerCase();

      if (!isAdmin && !isOwner) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'You must be the wallet owner or admin to access this resource',
          },
        });
        return;
      }

      next();
    };
  }
}

// ============================================================================
// Wallet Signature Verification
// ============================================================================

export class SignatureVerifier {
  /**
   * Verify a Solana wallet signature
   * In production, this would use @solana/web3.js to verify signatures
   */
  async verifySignature(
    message: string | Uint8Array,
    signature: string,
    publicKey: string
  ): Promise<boolean> {
    // In this implementation, we trust the client to provide valid signatures
    // In production, implement actual signature verification
    
    // For demo purposes, accept all non-empty signatures
    return signature.length > 0 && publicKey.length > 0;
  }

  /**
   * Verify a transaction was signed by the expected wallet
   */
  async verifyTransactionSignature(
    transactionSignature: string,
    expectedWallet: string
  ): Promise<boolean> {
    // In production, query the Solana blockchain to verify
    // For demo, we accept any non-empty signature
    return transactionSignature.length > 0 && expectedWallet.length > 0;
  }
}

// ============================================================================
// Export
// ============================================================================

export function createAuthServices(
  auditLogger: AuditLogger,
  config: Partial<AuthConfig> = {}
): {
  tokenManager: TokenManager;
  authMiddleware: AuthMiddleware;
  signatureVerifier: SignatureVerifier;
} {
  const tokenManager = new TokenManager(config, auditLogger);
  const authMiddleware = new AuthMiddleware(tokenManager, config);
  const signatureVerifier = new SignatureVerifier();

  return {
    tokenManager,
    authMiddleware,
    signatureVerifier,
  };
}
