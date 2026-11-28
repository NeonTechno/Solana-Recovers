// ReKey MCP Server - Main Entry Point
// Implements a Model Context Protocol server for ReKey wallet recovery

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import {
  MCPServerConfig,
  AuthContext,
  MCPError,
  MCPErrorCode,
  MCPResponse,
} from './types';
import { readOnlyTools, ReadOnlyTool, ReadOnlyToolNames } from './tools/readOnlyTools';
import { createAuthServices, AuthMiddleware } from './auth';
import { createRateLimiter, RateLimiter } from './rateLimiter';
import { createAuditLogger, AuditLogger } from './audit';
import { ToolContext } from './tools/readOnlyTools';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: MCPServerConfig = {
  name: 'ReKey MCP Server',
  version: '0.1.0',
  description: 'Model Context Protocol server for ReKey wallet recovery',
  transport: 'http',
  port: 3001,
  host: 'localhost',
  apiKey: process.env.MCP_API_KEY,
  rateLimit: {
    requestsPerWindow: 100,
    windowSizeMs: 60 * 1000,
  },
  solanaRpcUrl: process.env.SOLANA_RPC_URL || clusterApiUrl('devnet'),
  programId: process.env.REKEY_PROGRAM_ID || '284Xsc92KLKwKb7gBYAB8CXWc979FHL11tc185UYqcbP',
  logLevel: 'info',
  auditLogPath: './logs/audit.log',
};

// ============================================================================
// MCP Server Class
// ============================================================================

class MCPServer {
  private config: MCPServerConfig;
  private app: express.Application;
  private connection: Connection;
  private auditLogger: AuditLogger;
  private rateLimiter: RateLimiter;
  private authMiddleware: AuthMiddleware;
  private isRunning: boolean = false;

  constructor(config: Partial<MCPServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.app = express();
    
    // Initialize Solana connection
    this.connection = new Connection(this.config.solanaRpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
    
    // Initialize logging
    this.auditLogger = createAuditLogger({
      logLevel: this.config.logLevel,
      logPath: this.config.auditLogPath,
    });
    
    // Initialize rate limiter
    this.rateLimiter = createRateLimiter(
      this.config.rateLimit,
      this.auditLogger
    );
    
    // Initialize auth services
    const { authMiddleware } = createAuthServices(this.auditLogger, {
      apiKey: this.config.apiKey,
    });
    this.authMiddleware = authMiddleware;
    
    // Setup middleware
    this.setupMiddleware();
    
    // Setup routes
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: '*', // In production, restrict to known origins
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    }));
    
    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));
    
    // Add request ID
    this.app.use((req, res, next) => {
      const requestId = req.headers['x-request-id'] as string || 
        require('crypto').randomBytes(8).toString('hex');
      (req as any).requestId = requestId;
      res.set('X-Request-ID', requestId);
      next();
    });
    
    // Add authentication context
    this.app.use((req, res, next) => {
      const defaultContext: AuthContext = {
        isAuthenticated: false,
        permissions: [],
        sessionId: req.headers['x-request-id'] as string || 
          require('crypto').randomBytes(8).toString('hex'),
        timestamp: Date.now(),
      };
      (req as any).authContext = defaultContext;
      next();
    });
    
    // Apply rate limiting
    this.app.use(this.rateLimiter.middleware());
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        name: this.config.name,
        version: this.config.version,
        timestamp: Date.now(),
      });
    });
  }

  private setupRoutes(): void {
    // ==========================================================================
    // MCP Standard Endpoints
    // ==========================================================================
    
    // Get server info
    this.app.get('/mcp', (req, res) => {
      res.json({
        name: this.config.name,
        version: this.config.version,
        description: this.config.description,
        capabilities: {
          tools: Object.keys(this.readOnlyTools),
          resources: [],
        },
      });
    });
    
    // List available tools
    this.app.get('/mcp/tools', (req, res) => {
      const tools = Object.entries(this.readOnlyTools).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
      
      res.json({
        tools,
        total: tools.length,
      });
    });
    
    // Get tool details
    this.app.get('/mcp/tools/:toolName', (req, res) => {
      const toolName = req.params.toolName as ReadOnlyToolNames;
      const tool = this.readOnlyTools[toolName];
      
      if (!tool) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Tool '${toolName}' not found`,
          },
        });
      }
      
      res.json({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
    });
    
    // ==========================================================================
    // Tool Execution Endpoint
    // ==========================================================================
    
    // Execute a tool
    this.app.post('/mcp/tools/:toolName/execute', async (req, res) => {
      const toolName = req.params.toolName as ReadOnlyToolNames;
      const authContext = (req as any).authContext as AuthContext;
      const requestId = (req as any).requestId as string;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      
      const tool = this.readOnlyTools[toolName];
      
      if (!tool) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Tool '${toolName}' not found`,
          },
        } as MCPResponse<null>);
      }
      
      try {
        // Parse and validate input
        const input = tool.inputSchema.parse(req.body);
        
        // Create tool context
        const toolContext: ToolContext = {
          connection: this.connection,
          programId: this.config.programId,
          auditLogger: this.auditLogger,
          rateLimiter: this.rateLimiter,
          authContext,
        };
        
        // Execute tool
        const result = await tool.handler(input, toolContext);
        
        // Log successful execution
        await this.auditLogger.log({
          id: requestId,
          timestamp: Date.now(),
          level: 'info',
          action: 'tool_execute',
          tool: toolName,
          userId: authContext.userId,
          walletAddress: authContext.walletAddress,
          sessionId: authContext.sessionId,
          ipAddress,
          input,
          output: result,
        });
        
        // Return result
        const response: MCPResponse<typeof result> = {
          success: true,
          data: result,
          timestamp: Date.now(),
          requestId,
        };
        
        res.json(response);
        
      } catch (error) {
        // Handle validation errors
        if (error instanceof import('zod').ZodError) {
          const response: MCPResponse<null> = {
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid input parameters',
              details: error.errors.map(e => ({
                path: e.path,
                message: e.message,
              })),
            },
            timestamp: Date.now(),
            requestId,
          };
          
          await this.auditLogger.log({
            id: requestId,
            timestamp: Date.now(),
            level: 'warn',
            action: 'tool_execute',
            tool: toolName,
            userId: authContext.userId,
            walletAddress: authContext.walletAddress,
            sessionId: authContext.sessionId,
            ipAddress,
            input: req.body,
            error: 'Invalid input parameters',
          });
          
          return res.status(400).json(response);
        }
        
        // Handle MCP errors
        if (error instanceof MCPError) {
          const response: MCPResponse<null> = {
            success: false,
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
              retryable: error.isRetryable,
            },
            timestamp: Date.now(),
            requestId,
          };
          
          await this.auditLogger.log({
            id: requestId,
            timestamp: Date.now(),
            level: error.code === 'INTERNAL_ERROR' ? 'error' : 'warn',
            action: 'tool_execute',
            tool: toolName,
            userId: authContext.userId,
            walletAddress: authContext.walletAddress,
            sessionId: authContext.sessionId,
            ipAddress,
            input: req.body,
            error: error.message,
          });
          
          return res.status(error.code === 'NOT_FOUND' ? 404 : 400).json(response);
        }
        
        // Handle generic errors
        const response: MCPResponse<null> = {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Internal server error',
          },
          timestamp: Date.now(),
          requestId,
        };
        
        await this.auditLogger.log({
          id: requestId,
          timestamp: Date.now(),
          level: 'error',
          action: 'tool_execute',
          tool: toolName,
          userId: authContext.userId,
          walletAddress: authContext.walletAddress,
          sessionId: authContext.sessionId,
          ipAddress,
          input: req.body,
          error: error instanceof Error ? error.stack : String(error),
        });
        
        res.status(500).json(response);
      }
    });
    
    // Batch execute tools
    this.app.post('/mcp/tools/batch', async (req, res) => {
      const requests = req.body as Array<{
        toolName: string;
        input: any;
      }>;
      const authContext = (req as any).authContext as AuthContext;
      const requestId = (req as any).requestId as string;
      
      if (!Array.isArray(requests) || requests.length === 0) {
        return res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Requests must be a non-empty array',
          },
        } as MCPResponse<null>);
      }
      
      if (requests.length > 10) {
        return res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Maximum 10 requests per batch',
          },
        } as MCPResponse<null>);
      }
      
      try {
        const results = await Promise.all(
          requests.map(async (request, index) => {
            const toolName = request.toolName as ReadOnlyToolNames;
            const tool = this.readOnlyTools[toolName];
            
            if (!tool) {
              return {
                toolName,
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: `Tool '${toolName}' not found`,
                },
                requestId: `${requestId}-${index}`,
                timestamp: Date.now(),
              };
            }
            
            try {
              const input = tool.inputSchema.parse(request.input);
              const toolContext: ToolContext = {
                connection: this.connection,
                programId: this.config.programId,
                auditLogger: this.auditLogger,
                rateLimiter: this.rateLimiter,
                authContext,
              };
              
              const result = await tool.handler(input, toolContext);
              
              return {
                toolName,
                success: true,
                data: result,
                requestId: `${requestId}-${index}`,
                timestamp: Date.now(),
              };
            } catch (error) {
              return {
                toolName,
                success: false,
                error: this.formatError(error),
                requestId: `${requestId}-${index}`,
                timestamp: Date.now(),
              };
            }
          })
        );
        
        res.json({
          success: results.every(r => r.success),
          results,
          timestamp: Date.now(),
          requestId,
        });
        
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Internal server error',
          },
          timestamp: Date.now(),
          requestId,
        } as MCPResponse<null>);
      }
    });
    
    // ==========================================================================
    // Health and Status Endpoints
    // ==========================================================================
    
    this.app.get('/status', (req, res) => {
      res.json({
        status: 'ok',
        server: {
          name: this.config.name,
          version: this.config.version,
          uptime: process.uptime(),
        },
        solana: {
          rpcUrl: this.config.solanaRpcUrl,
          programId: this.config.programId,
        },
        tools: {
          readOnly: Object.keys(this.readOnlyTools).length,
          transaction: 0, // Placeholder for transaction tools
        },
      });
    });
  }

  private get readOnlyTools(): Record<ReadOnlyToolNames, ReadOnlyTool> {
    return readOnlyTools as Record<ReadOnlyToolNames, ReadOnlyTool>;
  }

  private formatError(error: unknown): {
    code: string;
    message: string;
    details?: any;
    retryable?: boolean;
  } {
    if (error instanceof import('zod').ZodError) {
      return {
        code: 'INVALID_INPUT',
        message: 'Invalid input parameters',
        details: error.errors,
      };
    }
    
    if (error instanceof MCPError) {
      return {
        code: error.code,
        message: error.message,
        details: error.details,
        retryable: error.isRetryable,
      };
    }
    
    return {
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Internal server error',
    };
  }

  // ============================================================================
  // Server Lifecycle
  // ============================================================================

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Server is already running');
      return;
    }

    this.isRunning = true;
    
    await new Promise<void>((resolve, reject) => {
      const server = this.app.listen(this.config.port, this.config.host, () => {
        console.log(`ReKey MCP Server started on ${this.config.host}:${this.config.port}`);
        console.log(`Solana RPC: ${this.config.solanaRpcUrl}`);
        console.log(`Program ID: ${this.config.programId}`);
        console.log(`Available tools: ${Object.keys(this.readOnlyTools).join(', ')}`);
        resolve();
      });

      server.on('error', (error) => {
        this.isRunning = false;
        reject(error);
      });

      // Store server reference for cleanup
      (this as any).server = server;
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve, reject) => {
      const server = (this as any).server;
      if (server) {
        server.close((error?: Error) => {
          if (error) {
            reject(error);
          } else {
            this.isRunning = false;
            console.log('ReKey MCP Server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  getApp(): express.Application {
    return this.app;
  }

  getConfig(): MCPServerConfig {
    return this.config;
  }
}

// ============================================================================
// Export
// ============================================================================

let serverInstance: MCPServer | null = null;

export function createMCPServer(config: Partial<MCPServerConfig> = {}): MCPServer {
  serverInstance = new MCPServer(config);
  return serverInstance;
}

export function getMCPServer(): MCPServer | null {
  return serverInstance;
}

// Default export for direct usage
export default MCPServer;

// Export types
export type { MCPServerConfig, AuthContext, MCPError, MCPResponse };
export { readOnlyTools };
