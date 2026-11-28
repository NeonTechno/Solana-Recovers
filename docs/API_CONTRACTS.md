# ReKey API Contracts

This document defines the API contracts for ReKey backend services, allowing frontend integration to begin before the backend implementation is complete.

## Table of Contents

1. [MCP Server API](#mcp-server-api)
2. [AI Service API](#ai-service-api)
3. [Rewards Engine API](#rewards-engine-api)
4. [Solana Integration API](#solana-integration-api)
5. [Authentication and Authorization](#authentication-and-authorization)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Integration Checklist](#integration-checklist)

---

## MCP Server API

The Model Context Protocol (MCP) server provides structured tools and resources for AI clients to interact with ReKey.

### Base URL
```
http://localhost:3001/mcp
```

### Endpoints

#### GET /mcp
Get server information and capabilities.

**Response:**
```json
{
  "name": "ReKey MCP Server",
  "version": "0.1.0",
  "description": "Model Context Protocol server for ReKey wallet recovery",
  "capabilities": {
    "tools": ["get_wallet_status", "get_recovery_policy", "list_guardians", "get_recovery_history", "check_recovery_readiness", "simulate_recovery", "get_resilience_score", "get_lifeline_points"],
    "resources": []
  }
}
```

#### GET /mcp/tools
List all available tools.

**Response:**
```json
{
  "tools": [
    {
      "name": "get_wallet_status",
      "description": "Get the current status of a wallet including balance and initialization state",
      "inputSchema": {
        "type": "object",
        "properties": {
          "walletAddress": { "type": "string", "format": "solana-address" },
          "network": { "type": "string", "enum": ["mainnet", "devnet", "testnet", "localnet"], "default": "devnet" }
        },
        "required": ["walletAddress"]
      }
    },
    {
      "name": "get_recovery_policy",
      "description": "Get the current recovery policy for a wallet",
      "inputSchema": {
        "type": "object",
        "properties": {
          "walletAddress": { "type": "string", "format": "solana-address" }
        },
        "required": ["walletAddress"]
      }
    },
    {
      "name": "list_guardians",
      "description": "List all guardians for a wallet with their verification status",
      "inputSchema": {
        "type": "object",
        "properties": {
          "walletAddress": { "type": "string", "format": "solana-address" }
        },
        "required": ["walletAddress"]
      }
    },
    {
      "name": "get_recovery_history",
      "description": "Get the recovery request history for a wallet",
      "inputSchema": {
        "type": "object",
        "properties": {
          "walletAddress": { "type": "string", "format": "solana-address" },
          "limit": { "type": "number", "minimum": 1, "maximum": 100, "default": 50 },
          "offset": { "type": "number", "minimum": 0, "default": 0 }
        },
        "required": ["walletAddress"]
      }
    },
    {
      "name": "check_recovery_readiness",
      "description": "Check if a wallet is ready for recovery and what requirements need to be met",
      "inputSchema": {
        "type": "object",
        "properties": {
          "walletAddress": { "type": "string", "format": "solana-address" }
        },
        "required": ["walletAddress"]
      }
    },
    {
      "name": "simulate_recovery",
      "description": "Simulate a recovery request to understand the flow without creating on-chain state",
      "inputSchema": {
        "type": "object",
        "properties": {
          "walletAddress": { "type": "string", "format": "solana-address" },
          "newOwner": { "type": "string", "format": "solana-address" },
          "guardians": {
            "type": "array",
            "items": { "type": "string", "format": "solana-address" },
            "maxItems": 5
          }
        },
        "required": ["walletAddress", "newOwner", "guardians"]
      }
    },
    {
      "name": "get_resilience_score",
      "description": "Calculate the resilience score for a wallet based on its recovery configuration",
      "inputSchema": {
        "type": "object",
        "properties": {
          "walletAddress": { "type": "string", "format": "solana-address" }
        },
        "required": ["walletAddress"]
      }
    },
    {
      "name": "get_lifeline_points",
      "description": "Get the current lifeline points balance and achievements for a wallet",
      "inputSchema": {
        "type": "object",
        "properties": {
          "walletAddress": { "type": "string", "format": "solana-address" }
        },
        "required": ["walletAddress"]
      }
    }
  ],
  "total": 8
}
```

#### GET /mcp/tools/:toolName
Get details for a specific tool.

**Response:**
```json
{
  "name": "get_wallet_status",
  "description": "Get the current status of a wallet including balance and initialization state",
  "inputSchema": {
    "type": "object",
    "properties": {
      "walletAddress": { "type": "string", "format": "solana-address" },
      "network": { "type": "string", "enum": ["mainnet", "devnet", "testnet", "localnet"], "default": "devnet" }
    },
    "required": ["walletAddress"]
  }
}
```

#### POST /mcp/tools/:toolName/execute
Execute a specific tool.

**Request:**
```json
{
  "walletAddress": "11111111111111111111111111111111",
  "network": "devnet"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "11111111111111111111111111111111",
    "isInitialized": false,
    "balanceLamports": 1000000000,
    "balanceSol": 1.0,
    "lastUpdated": 1700000000000,
    "network": "devnet"
  },
  "timestamp": 1700000000001,
  "requestId": "abc123-def456"
}
```

#### POST /mcp/tools/batch
Execute multiple tools in a single request.

**Request:**
```json
[
  { "toolName": "get_wallet_status", "input": { "walletAddress": "1111...", "network": "devnet" } },
  { "toolName": "get_recovery_policy", "input": { "walletAddress": "1111..." } }
]
```

**Response:**
```json
{
  "success": true,
  "results": [
    { "toolName": "get_wallet_status", "success": true, "data": { ... }, "requestId": "...", "timestamp": 123 },
    { "toolName": "get_recovery_policy", "success": true, "data": { ... }, "requestId": "...", "timestamp": 124 }
  ],
  "timestamp": 1700000000001,
  "requestId": "batch-abc123"
}
```

### Tool Specifications

#### get_wallet_status
Get wallet status and balance.

**Input:**
```typescript
{
  walletAddress: string; // Solana base58 address
  network: 'mainnet' | 'devnet' | 'testnet' | 'localnet';
}
```

**Output:**
```typescript
{
  walletAddress: string;
  isInitialized: boolean;
  owner?: string; // Solana base58 address
  vaultAddress?: string; // Solana base58 address
  balanceLamports?: number;
  balanceSol?: number;
  lastUpdated: number; // Unix timestamp in milliseconds
  network: string;
}
```

#### get_recovery_policy
Get the recovery policy for a wallet.

**Input:**
```typescript
{
  walletAddress: string;
}
```

**Output:**
```typescript
{
  walletAddress: string;
  guardians: string[]; // Array of Solana base58 addresses
  threshold: number; // 1-5
  delaySeconds: number; // 60 to 2,592,000 (30 days)
  policyVersion: number;
  initialOwner: string;
  currentOwner: string;
  nextNonce: number;
}
```

#### list_guardians
List guardians for a wallet.

**Input:**
```typescript
{
  walletAddress: string;
}
```

**Output:**
```typescript
{
  guardians: Array<{
    pubkey: string;
    label?: string;
    isVerified: boolean;
    verificationMethod?: string;
    lastVerified?: number;
  }>;
}
```

#### get_recovery_history
Get recovery request history.

**Input:**
```typescript
{
  walletAddress: string;
  limit: number; // 1-100, default 50
  offset: number; // default 0
}
```

**Output:**
```typescript
{
  walletAddress: string;
  requests: Array<{
    requestId: string;
    walletAddress: string;
    newOwner: string;
    nonce: number;
    policyVersion: number;
    createdAt: number;
    executeAfter: number;
    expiresAt: number;
    approvals: string[];
    status: 'pending' | 'approved' | 'executed' | 'cancelled' | 'expired' | 'failed';
    transactionSignature?: string;
  }>;
  totalRequests: number;
  successfulRecoveries: number;
}
```

#### check_recovery_readiness
Check if a wallet is ready for recovery.

**Input:**
```typescript
{
  walletAddress: string;
}
```

**Output:**
```typescript
{
  walletAddress: string;
  isReady: boolean;
  requirements: Array<{
    id: string;
    description: string;
    isMet: boolean;
    details?: string;
  }>;
  score: number; // 0-100
  recommendations: string[];
}
```

#### simulate_recovery
Simulate a recovery request.

**Input:**
```typescript
{
  walletAddress: string;
  newOwner: string;
  guardians: string[]; // Guardians to approve in the simulation
}
```

**Output:**
```typescript
{
  walletAddress: string;
  newOwner: string;
  thresholdMet: boolean;
  approvalsNeeded: number;
  approvalsReceived: number;
  timelockStartsAt: number; // Unix timestamp in seconds
  recoveryExecutableAt: number; // Unix timestamp in seconds
  steps: Array<{
    step: number;
    description: string;
    status: 'pending' | 'completed' | 'skipped';
    timestamp: number;
  }>;
  warnings: string[];
}
```

#### get_resilience_score
Calculate resilience score.

**Input:**
```typescript
{
  walletAddress: string;
}
```

**Output:**
```typescript
{
  walletAddress: string;
  score: number; // 0-100
  factors: {
    guardianCount: number; // 0-1
    threshold: number; // 0-1
    delayConfig: number; // 0-1
    guardianDiversity: number; // 0-1
    policyActivity: number; // 0-1
    simulationHistory: number; // 0-1
  };
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  timestamp: number;
}
```

#### get_lifeline_points
Get lifeline points and achievements.

**Input:**
```typescript
{
  walletAddress: string;
}
```

**Output:**
```typescript
{
  walletAddress: string;
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  achievements: Array<{
    id: string;
    name: string;
    points: number;
    earnedAt: number;
    description: string;
  }>;
  lastActivity: number;
}
```

---

## AI Service API

### Base URL
```
http://localhost:3001/api/ai
```

### Endpoints

#### GET /providers
List available AI providers.

**Response:**
```json
{
  "success": true,
  "providers": ["nvidia", "mistral"],
  "activeProvider": "nvidia"
}
```

#### POST /providers/select
Select a specific provider.

**Request:**
```json
{
  "providerName": "nvidia"
}
```

**Response:**
```json
{
  "success": true,
  "activeProvider": "nvidia"
}
```

#### GET /models
List available models.

**Response:**
```json
{
  "success": true,
  "models": [
    {
      "id": "nvidia/mistral-large-4-1t-a52b",
      "name": "Mistral Large 4",
      "contextWindow": 128000,
      "maxTokens": 32000,
      "supportsStreaming": true,
      "capabilities": ["chat", "completions"]
    }
  ]
}
```

#### GET /health
Check health of all AI providers.

**Response:**
```json
{
  "success": true,
  "health": {
    "nvidia": {
      "status": "healthy",
      "message": "NVIDIA provider is available",
      "lastChecked": 1700000000000
    },
    "mistral": {
      "status": "healthy",
      "message": "Mistral provider is available",
      "lastChecked": 1700000000000
    }
  }
}
```

### ReKey-Specific AI Endpoints

#### POST /explain/policy
Explain a recovery policy.

**Request:**
```json
{
  "walletAddress": "11111111111111111111111111111111",
  "policy": {
    "guardians": ["2222...", "3333...", "4444..."],
    "threshold": 2,
    "delaySeconds": 86400
  },
  "userLanguage": "English"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "11111111111111111111111111111111",
    "summary": "Your recovery policy uses a 2-of-3 threshold with a 24-hour timelock.",
    "guardianExplanation": "You have 3 guardians who can approve recovery requests.",
    "thresholdExplanation": "At least 2 guardians must approve any recovery request.",
    "timelockExplanation": "There is a 24-hour waiting period after approval before recovery can be executed.",
    "securityImplications": [
      "Your guardians cannot spend your funds; they can only approve ownership changes.",
      "The timelock provides protection against unauthorized recovery attempts."
    ],
    "recommendations": [
      "Ensure all guardians are trustworthy and available.",
      "Review your guardian list periodically."
    ],
    "usage": {
      "prompt_tokens": 100,
      "completion_tokens": 200,
      "total_tokens": 300
    }
  }
}
```

#### POST /assess/readiness
Assess recovery readiness.

**Request:**
```json
{
  "walletAddress": "11111111111111111111111111111111",
  "policy": {
    "guardians": ["2222...", "3333...", "4444..."],
    "threshold": 2,
    "delaySeconds": 86400
  },
  "walletBalance": 10,
  "guardianVerifiedStatus": {
    "2222...": true,
    "3333...": true,
    "4444...": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "11111111111111111111111111111111",
    "overallScore": 95,
    "isReady": true,
    "requirements": [
      {
        "id": "guardians_configured",
        "name": "Guardians Configured",
        "description": "At least one guardian must be configured",
        "isMet": true,
        "weight": 0.3
      },
      {
        "id": "threshold_valid",
        "name": "Valid Threshold",
        "description": "Threshold must be between 1 and number of guardians",
        "isMet": true,
        "weight": 0.3
      }
    ],
    "recommendations": [
      {
        "priority": "medium",
        "action": "Verify remaining guardian",
        "description": "Guardian 4444... is not yet verified",
        "impact": "Improves recovery reliability"
      }
    ],
    "risks": [],
    "usage": { "prompt_tokens": 150, "completion_tokens": 300, "total_tokens": 450 }
  }
}
```

#### POST /explain/threshold
Explain guardian threshold.

**Request:**
```json
{
  "walletAddress": "11111111111111111111111111111111",
  "threshold": 2,
  "guardianCount": 3,
  "guardianLabels": ["Guardian Alpha", "Guardian Beta", "Guardian Gamma"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "11111111111111111111111111111111",
    "threshold": 2,
    "guardianCount": 3,
    "explanation": "With a threshold of 2 of 3, you need approval from at least 2 out of your 3 guardians for a recovery request to proceed.",
    "examples": [
      "If any 2 of your guardians approve a recovery request, it meets the threshold.",
      "If fewer than 2 guardians approve, the request cannot proceed.",
      "All 3 guardians approving would exceed the threshold."
    ],
    "math": "2/3 = 67% approval required",
    "implications": [
      "Higher threshold = more security but harder to reach",
      "Lower threshold = easier recovery but less security"
    ],
    "usage": { "prompt_tokens": 80, "completion_tokens": 150, "total_tokens": 230 }
  }
}
```

#### POST /recommend/security
Get security recommendations.

**Request:**
```json
{
  "walletAddress": "11111111111111111111111111111111",
  "currentConfig": {
    "guardians": ["2222..."],
    "threshold": 1,
    "delaySeconds": 60
  },
  "preferences": {
    "securityLevel": "high",
    "convenience": "medium"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "11111111111111111111111111111111",
    "recommendations": [
      {
        "category": "guardians",
        "action": "Add 2 more guardian(s)",
        "description": "More guardians provide better redundancy and security",
        "priority": "high",
        "currentValue": 1,
        "recommendedValue": 3,
        "impact": "Reduces risk of single point of failure"
      },
      {
        "category": "threshold",
        "action": "Increase threshold to 2",
        "description": "Current threshold of 1 may be too low for 1 guardians",
        "priority": "high",
        "currentValue": 1,
        "recommendedValue": 2,
        "impact": "Improves security by requiring more approvals"
      }
    ],
    "rationale": "These recommendations are based on your high security level and medium convenience preference.",
    "usage": { "prompt_tokens": 120, "completion_tokens": 250, "total_tokens": 370 }
  }
}
```

#### POST /guide/simulation
Get a guide for recovery simulation.

**Request:**
```json
{
  "walletAddress": "11111111111111111111111111111111",
  "newOwner": "55555555555555555555555555555555",
  "guardians": ["2222...", "3333...", "4444..."],
  "threshold": 2,
  "delaySeconds": 86400
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "11111111111111111111111111111111",
    "steps": [
      {
        "step": 1,
        "title": "Request Initiation",
        "description": "A guardian initiates a recovery request specifying the new owner address",
        "actor": "Any guardian",
        "required": true,
        "estimatedTime": "1 minute"
      },
      {
        "step": 2,
        "title": "Guardian Approvals",
        "description": "Collect approvals from 2 out of 3 guardians",
        "actor": "Guardians",
        "required": true,
        "estimatedTime": "Minutes to hours"
      },
      {
        "step": 3,
        "title": "Threshold Reached",
        "description": "Once 2 approvals are collected, the threshold is met",
        "actor": "System",
        "required": true,
        "estimatedTime": "Instant"
      },
      {
        "step": 4,
        "title": "Timelock Period",
        "description": "Wait for 1 day(s) before execution is possible",
        "actor": "System",
        "required": true,
        "estimatedTime": "1 day(s)"
      },
      {
        "step": 5,
        "title": "Recovery Execution",
        "description": "After timelock elapses, anyone can execute the recovery to transfer ownership",
        "actor": "Anyone",
        "required": true,
        "estimatedTime": "1 minute"
      }
    ],
    "timeline": {
      "totalEstimatedTime": "2 day(s)",
      "criticalPath": ["Request Initiation", "Guardian Approvals", "Timelock Period", "Recovery Execution"],
      "dependencies": [
        { "step": 2, "dependsOn": [1] },
        { "step": 3, "dependsOn": [2] },
        { "step": 4, "dependsOn": [3] },
        { "step": 5, "dependsOn": [4] }
      ]
    },
    "checkpoints": [
      {
        "id": "request_created",
        "description": "Recovery request is created and nonce is assigned",
        "verificationMethod": "Check on-chain state for request with matching nonce"
      },
      {
        "id": "threshold_met",
        "description": "At least 2 guardian approvals collected",
        "verificationMethod": "Check approval count in request state"
      }
    ],
    "warnings": [],
    "usage": { "prompt_tokens": 100, "completion_tokens": 200, "total_tokens": 300 }
  }
}
```

#### POST /explain/rewards
Explain rewards and points.

**Request:**
```json
{
  "walletAddress": "11111111111111111111111111111111",
  "points": 1500,
  "achievements": [
    { "id": "first_steps", "name": "First Steps", "points": 100, "earnedAt": 1700000000000 }
  ],
  "eligibleActions": ["complete_simulation", "verify_guardian"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "11111111111111111111111111111111",
    "currentPoints": 1500,
    "achievementsSummary": "2 achievement(s) earned, totaling 250 points",
    "pointsBreakdown": [
      {
        "category": "Wallet Setup",
        "points": 100,
        "description": "Points for initializing and configuring your ReKey wallet"
      },
      {
        "category": "Security Configuration",
        "points": 150,
        "description": "Points for setting up recovery policy and guardians"
      },
      {
        "category": "Other",
        "points": 1250,
        "description": "Points from other activities"
      }
    ],
    "eligibleActions": [
      {
        "action": "complete_simulation",
        "points": 50,
        "description": "Complete a recovery simulation",
        "requirements": ["Wallet must be initialized", "Policy must be configured"]
      },
      {
        "action": "verify_guardian",
        "points": 30,
        "description": "Verify a guardian identity",
        "requirements": ["Guardian must be added to policy"]
      }
    ],
    "nextMilestone": {
      "pointsNeeded": 500,
      "reward": "Gold Badge",
      "description": "Advanced security practitioner"
    },
    "usage": { "prompt_tokens": 90, "completion_tokens": 180, "total_tokens": 270 }
  }
}
```

#### POST /ask
Ask a general question.

**Request:**
```json
{
  "question": "How does ReKey wallet recovery work?",
  "context": {
    "walletAddress": "11111111111111111111111111111111"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "answer": "ReKey wallet recovery uses a combination of trusted guardians and program-enforced timelocks. To recover your wallet, you need a specific number of your guardians to approve the recovery request. Once the approval threshold is met, there's a waiting period (timelock) before the recovery can be executed. This gives you time to cancel if the recovery was unauthorized. During the timelock, the current owner can cancel the recovery. After the timelock elapses, anyone can execute the recovery to transfer ownership to the new owner.",
    "confidence": 0.95,
    "sources": ["ReKey documentation", "Solana program knowledge"],
    "followUpQuestions": [
      "How do I add or remove a guardian?",
      "What happens if a guardian loses their wallet?",
      "Can I change my threshold setting?"
    ],
    "usage": { "prompt_tokens": 15, "completion_tokens": 200, "total_tokens": 215 }
  }
}
```

---

## Rewards Engine API

### Base URL
```
http://localhost:3001/api/rewards
```

### Endpoints

#### POST /events
Record a new event.

**Request:**
```json
{
  "type": "wallet_initialized",
  "walletAddress": "11111111111111111111111111111111",
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "event": {
    "id": "event-uuid",
    "type": "wallet_initialized",
    "walletAddress": "11111111111111111111111111111111",
    "timestamp": 1700000000000,
    "points": 100,
    "processed": false
  },
  "pointsEarned": 100
}
```

#### GET /points/:walletAddress
Get points balance for a wallet.

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "11111111111111111111111111111111",
    "totalPoints": 250,
    "availablePoints": 250,
    "lockedPoints": 0,
    "lastUpdated": 1700000000000
  }
}
```

#### GET /history/:walletAddress
Get transaction history for a wallet.

**Query Parameters:**
- `limit`: number (default: 50)
- `offset`: number (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "11111111111111111111111111111111",
    "transactions": [
      {
        "id": "entry-1",
        "walletAddress": "11111111111111111111111111111111",
        "amount": 100,
        "type": "earn",
        "source": "wallet_initialized",
        "timestamp": 1700000000000,
        "transactionId": "event-uuid",
        "description": "Points for wallet_initialized"
      }
    ],
    "total": 2,
    "limit": 50,
    "offset": 0
  }
}
```

#### GET /achievements/:walletAddress
Get achievements for a wallet.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ach-uuid",
      "achievementId": "first_steps",
      "walletAddress": "11111111111111111111111111111111",
      "earnedAt": 1700000000000,
      "points": 100,
      "criteriaMet": { "type": "event", "eventType": "wallet_initialized" }
    }
  ]
}
```

#### GET /resilience/:walletAddress
Calculate resilience score.

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "11111111111111111111111111111111",
    "score": 85,
    "grade": "B",
    "factors": [
      {
        "name": "guardianCount",
        "score": 0.75,
        "weight": 0.25,
        "description": "Guardian count score: 3 guardians"
      },
      {
        "name": "threshold",
        "score": 0.8,
        "weight": 0.2,
        "description": "Threshold score: 2 of 3"
      }
    ],
    "lastCalculated": 1700000000000,
    "history": []
  }
}
```

#### GET /streak/:walletAddress
Get streak information.

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "11111111111111111111111111111111",
    "currentStreak": 7,
    "longestStreak": 15,
    "lastActivityDate": 1700000000000,
    "streakStartDate": 1699920000000
  }
}
```

#### POST /contributions
Submit a contribution.

**Request:**
```json
{
  "type": "documentation_contribution",
  "title": "ReKey Documentation",
  "description": "Comprehensive documentation for ReKey",
  "url": "https://github.com/NeonTechno/Solana-Recovers"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "contrib-uuid",
    "walletAddress": "11111111111111111111111111111111",
    "type": "documentation_contribution",
    "title": "ReKey Documentation",
    "description": "Comprehensive documentation for ReKey",
    "url": "https://github.com/NeonTechno/Solana-Recovers",
    "submittedAt": 1700000000000,
    "status": "pending",
    "pointsAwarded": 0
  }
}
```

#### GET /contributions/:walletAddress
Get contributions for a wallet.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "contrib-uuid",
      "walletAddress": "11111111111111111111111111111111",
      "type": "documentation_contribution",
      "title": "ReKey Documentation",
      "status": "pending",
      "submittedAt": 1700000000000
    }
  ]
}
```

---

## Solana Integration API

### Base URL
```
http://localhost:3001/api/solana
```

### Types

All types use the native Solana types from `@solana/web3.js`. Addresses are base58-encoded strings.

### Read-Only Endpoints

#### GET /wallet/:walletAddress/config
Get wallet configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "pubkey": "11111111111111111111111111111111",
    "initialOwner": "11111111111111111111111111111111",
    "owner": "11111111111111111111111111111111",
    "guardians": ["2222...", "3333...", "4444..."],
    "threshold": 2,
    "delaySeconds": 86400,
    "nextNonce": 1,
    "policyVersion": 1,
    "bump": 255
  }
}
```

#### GET /wallet/:walletAddress/vault
Get vault information.

**Response:**
```json
{
  "success": true,
  "data": {
    "pubkey": "55555555555555555555555555555555",
    "walletConfig": "11111111111111111111111111111111",
    "bump": 255
  }
}
```

#### GET /wallet/:walletAddress/recovery-requests
Get all recovery requests for a wallet.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "pubkey": "66666666666666666666666666666666",
      "walletConfig": "11111111111111111111111111111111",
      "newOwner": "77777777777777777777777777777777",
      "nonce": 0,
      "policyVersion": 1,
      "createdAt": 1700000000,
      "executeAfter": 1700086400,
      "expiresAt": 1700172800,
      "approvals": ["2222...", "3333..."];
      "status": "approved",
      "bump": 255
    }
  ]
}
```

#### GET /wallet/:walletAddress/recovery-request/:nonce
Get a specific recovery request.

**Response:**
```json
{
  "success": true,
  "data": {
    "pubkey": "66666666666666666666666666666666",
    "walletConfig": "11111111111111111111111111111111",
    "newOwner": "77777777777777777777777777777777",
    "nonce": 0,
    "policyVersion": 1,
    "createdAt": 1700000000,
    "executeAfter": 1700086400,
    "expiresAt": 1700172800,
    "approvals": ["2222...", "3333..."];
    "status": "approved",
    "bump": 255
  }
}
```

### Health Check

#### GET /health
Check Solana client health.

**Response:**
```json
{
  "status": "healthy",
  "message": "Connected to https://api.devnet.solana.com",
  "programId": "284Xsc92KLKwKb7gBYAB8CXWc979FHL11tc185UYqcbP"
}
```

---

## Authentication and Authorization

### API Key Authentication

Include an API key in the `X-API-Key` header:

```
X-API-Key: your-api-key-here
```

The API key is configured via the `MCP_API_KEY` environment variable.

### Rate Limiting

All endpoints are rate-limited. Rate limit information is returned in headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 30
```

- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Seconds until rate limit resets

### Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }, // Optional additional details
    "retryable": true // Optional, indicates if the request can be retried
  },
  "timestamp": 1700000000000,
  "requestId": "abc123"
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `UNAUTHORIZED` | Authentication required | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `INVALID_INPUT` | Invalid request parameters | 400 |
| `RATE_LIMITED` | Too many requests | 429 |
| `WALLET_NOT_INITIALIZED` | Wallet not initialized | 400 |
| `SYBIL_DETECTED` | Sybil detection triggered | 403 |
| `ACCOUNT_SUSPENDED` | Account suspended | 403 |
| `INTERNAL_ERROR` | Internal server error | 500 |

---

## Integration Checklist

### For Hermes (Lead Integrator)

1. [ ] Review all API contracts
2. [ ] Verify authentication mechanisms
3. [ ] Test rate limiting behavior
4. [ ] Validate error handling
5. [ ] Coordinate with Junie on frontend integration
6. [ ] Review security boundaries

### For Junie (Frontend Engineer)

1. [ ] Integrate MCP server endpoints
2. [ ] Implement AI service calls
3. [ ] Connect rewards engine
4. [ ] Use Solana integration for on-chain operations
5. [ ] Handle authentication tokens
6. [ ] Implement rate limiting UI
7. [ ] Add error handling and user feedback

### For Vibe (Backend Engineer)

1. [ ] Complete MCP server implementation
2. [ ] Implement all AI service endpoints
3. [ ] Build rewards engine
4. [ ] Create Solana integration layer
5. [ ] Write comprehensive tests
6. [ ] Document all endpoints
7. [ ] Set up CI/CD for backend

---

## Version History

- **v0.1.0** (Initial): First draft of API contracts for ReKey backend services

---

## Notes

1. All addresses are Solana base58-encoded strings
2. All timestamps are Unix timestamps in milliseconds unless otherwise specified
3. Points and tokens are non-transferable
4. The backend must never have unrestricted wallet access
5. AI responses are generated from prompts and should be verified
6. Transaction confirmation should always be verified before reporting success

For questions or clarifications, contact:
- Hermes (Lead Integrator)
- Vibe (Backend Engineer)
