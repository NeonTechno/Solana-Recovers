// ReKey MCP Server - Tests
// Comprehensive tests for the MCP server

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { MCPServer, createMCPServer } from '../mcp/src/index';
import { createAuditLogger } from '../mcp/src/audit';
import { createRateLimiter } from '../mcp/src/rateLimiter';
import { createAuthServices } from '../mcp/src/auth';

// Mock Solana connection
vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js');
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => ({
      getBalance: vi.fn().mockResolvedValue(1000000000), // 1 SOL
      getAccountInfo: vi.fn().mockResolvedValue(null),
      getTransaction: vi.fn().mockResolvedValue(null),
    })),
  };
});

describe('MCP Server', () => {
  let server: MCPServer;
  let app: express.Application;

  beforeAll(() => {
    const auditLogger = createAuditLogger({
      logLevel: 'debug',
      enableConsole: false,
    });
    
    const rateLimiter = createRateLimiter({}, auditLogger);
    const { authMiddleware } = createAuthServices(auditLogger);
    
    server = new MCPServer({
      solanaRpcUrl: 'https://api.devnet.solana.com',
      programId: '284Xsc92KLKwKb7gBYAB8CXWc979FHL11tc185UYqcbP',
      logLevel: 'debug',
    });
    
    app = server.getApp();
  });

  afterAll(() => {
    server.stop().catch(console.error);
  });

  describe('Health Endpoints', () => {
    it('should respond to /health', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.name).toBe('ReKey MCP Server');
      expect(response.body.version).toBe('0.1.0');
    });

    it('should respond to /status', async () => {
      const response = await request(app).get('/status');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.server).toBeDefined();
      expect(response.body.tools).toBeDefined();
    });
  });

  describe('MCP Standard Endpoints', () => {
    it('should respond to /mcp with server info', async () => {
      const response = await request(app).get('/mcp');
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('ReKey MCP Server');
      expect(response.body.version).toBe('0.1.0');
      expect(response.body.capabilities).toBeDefined();
      expect(response.body.capabilities.tools).toBeDefined();
    });

    it('should list available tools', async () => {
      const response = await request(app).get('/mcp/tools');
      
      expect(response.status).toBe(200);
      expect(response.body.tools).toBeInstanceOf(Array);
      expect(response.body.tools.length).toBeGreaterThan(0);
      
      // Check that we have the expected read-only tools
      const toolNames = response.body.tools.map((t: any) => t.name);
      expect(toolNames).toContain('get_wallet_status');
      expect(toolNames).toContain('get_recovery_policy');
      expect(toolNames).toContain('list_guardians');
      expect(toolNames).toContain('get_recovery_history');
      expect(toolNames).toContain('check_recovery_readiness');
      expect(toolNames).toContain('simulate_recovery');
      expect(toolNames).toContain('get_resilience_score');
      expect(toolNames).toContain('get_lifeline_points');
    });

    it('should get tool details', async () => {
      const response = await request(app)
        .get('/mcp/tools/get_wallet_status');
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('get_wallet_status');
      expect(response.body.description).toContain('wallet status');
    });

    it('should return 404 for non-existent tool', async () => {
      const response = await request(app)
        .get('/mcp/tools/non_existent_tool');
      
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Tool Execution', () => {
    it('should execute get_wallet_status tool', async () => {
      const walletAddress = '11111111111111111111111111111111';
      
      const response = await request(app)
        .post('/mcp/tools/get_wallet_status/execute')
        .send({
          walletAddress,
          network: 'devnet',
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.walletAddress).toBe(walletAddress);
    });

    it('should execute get_recovery_policy tool', async () => {
      const walletAddress = '11111111111111111111111111111111';
      
      const response = await request(app)
        .post('/mcp/tools/get_recovery_policy/execute')
        .send({ walletAddress });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.walletAddress).toBe(walletAddress);
    });

    it('should execute list_guardians tool', async () => {
      const walletAddress = '11111111111111111111111111111111';
      
      const response = await request(app)
        .post('/mcp/tools/list_guardians/execute')
        .send({ walletAddress });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.guardians).toBeInstanceOf(Array);
    });

    it('should execute check_recovery_readiness tool', async () => {
      const walletAddress = '11111111111111111111111111111111';
      
      const response = await request(app)
        .post('/mcp/tools/check_recovery_readiness/execute')
        .send({ walletAddress });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isReady).toBeDefined();
      expect(response.body.data.score).toBeDefined();
    });

    it('should execute simulate_recovery tool', async () => {
      const walletAddress = '11111111111111111111111111111111';
      const newOwner = '22222222222222222222222222222222';
      const guardians = [
        '33333333333333333333333333333333',
        '44444444444444444444444444444444',
      ];
      
      const response = await request(app)
        .post('/mcp/tools/simulate_recovery/execute')
        .send({ walletAddress, newOwner, guardians });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.thresholdMet).toBeDefined();
      expect(response.body.data.steps).toBeInstanceOf(Array);
    });

    it('should execute get_resilience_score tool', async () => {
      const walletAddress = '11111111111111111111111111111111';
      
      const response = await request(app)
        .post('/mcp/tools/get_resilience_score/execute')
        .send({ walletAddress });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.score).toBeDefined();
      expect(response.body.data.grade).toBeDefined();
    });

    it('should execute get_lifeline_points tool', async () => {
      const walletAddress = '11111111111111111111111111111111';
      
      const response = await request(app)
        .post('/mcp/tools/get_lifeline_points/execute')
        .send({ walletAddress });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalPoints).toBeDefined();
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/mcp/tools/get_wallet_status/execute')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should execute batch tool requests', async () => {
      const requests = [
        { toolName: 'get_wallet_status', input: { walletAddress: '11111111111111111111111111111111', network: 'devnet' } },
        { toolName: 'get_recovery_policy', input: { walletAddress: '11111111111111111111111111111111' } },
      ];
      
      const response = await request(app)
        .post('/mcp/tools/batch')
        .send(requests);
      
      expect(response.status).toBe(200);
      expect(response.body.results).toBeInstanceOf(Array);
      expect(response.body.results.length).toBe(2);
    });
  });

  describe('Rate Limiting', () => {
    it('should have rate limit headers', async () => {
      const response = await request(app)
        .post('/mcp/tools/get_wallet_status/execute')
        .send({ walletAddress: '11111111111111111111111111111111', network: 'devnet' });
      
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });
});

describe('MCP Server Initialization', () => {
  it('should create a new MCP server', () => {
    const auditLogger = createAuditLogger({ enableConsole: false });
    const server = createMCPServer({
      port: 3002,
      solanaRpcUrl: 'https://api.devnet.solana.com',
      programId: '284Xsc92KLKwKb7gBYAB8CXWc979FHL11tc185UYqcbP',
    });
    
    expect(server).toBeInstanceOf(MCPServer);
    expect(server.getConfig().port).toBe(3002);
  });

  it('should have correct default configuration', () => {
    const auditLogger = createAuditLogger({ enableConsole: false });
    const server = createMCPServer();
    const config = server.getConfig();
    
    expect(config.name).toBe('ReKey MCP Server');
    expect(config.version).toBe('0.1.0');
    expect(config.transport).toBe('http');
    expect(config.port).toBe(3001);
  });
});
