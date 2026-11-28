// ReKey AI - API Endpoints
// HTTP endpoints for AI features

import express, { Request, Response, Router } from 'express';
import { z } from 'zod';
import { ReKeyAIService, createAIService } from './aiService';
import {
  PolicyExplanationRequest,
  ReadinessAssessmentRequest,
  GuardianThresholdExplanationRequest,
  SecurityRecommendationRequest,
  RecoverySimulationGuideRequest,
  RewardsExplanationRequest,
  GeneralQuestionRequest,
  AIError,
} from './types';

// ============================================================================
// Request Schemas
// ============================================================================

const PolicyExplanationSchema = z.object({
  walletAddress: z.string(),
  policy: z.object({
    guardians: z.array(z.string()),
    threshold: z.number().min(1).max(5),
    delaySeconds: z.number().min(60),
  }),
  userLanguage: z.string().optional(),
});

const ReadinessAssessmentSchema = z.object({
  walletAddress: z.string(),
  policy: z.object({
    guardians: z.array(z.string()),
    threshold: z.number().min(1).max(5),
    delaySeconds: z.number().min(60),
  }),
  walletBalance: z.number().optional(),
  guardianVerifiedStatus: z.record(z.string(), z.boolean()).optional(),
});

const ThresholdExplanationSchema = z.object({
  walletAddress: z.string(),
  threshold: z.number().min(1).max(5),
  guardianCount: z.number().min(1).max(5),
  guardianLabels: z.array(z.string()).optional(),
});

const SecurityRecommendationSchema = z.object({
  walletAddress: z.string(),
  currentConfig: z.object({
    guardians: z.array(z.string()),
    threshold: z.number().min(1).max(5),
    delaySeconds: z.number().min(60),
  }),
  preferences: z.object({
    securityLevel: z.enum(['low', 'medium', 'high']).optional(),
    convenience: z.enum(['low', 'medium', 'high']).optional(),
  }).optional(),
});

const SimulationGuideSchema = z.object({
  walletAddress: z.string(),
  newOwner: z.string(),
  guardians: z.array(z.string()),
  threshold: z.number().min(1).max(5),
  delaySeconds: z.number().min(60),
});

const RewardsExplanationSchema = z.object({
  walletAddress: z.string(),
  points: z.number().min(0),
  achievements: z.array(z.object({
    id: z.string(),
    name: z.string(),
    points: z.number().min(0),
    earnedAt: z.number().min(0),
  })).optional(),
  eligibleActions: z.array(z.string()).optional(),
});

const GeneralQuestionSchema = z.object({
  question: z.string().min(1),
  context: z.record(z.any()).optional(),
});

// ============================================================================
// Create AI Router
// ============================================================================

export function createAIRouter(aiService: ReKeyAIService): Router {
  const router = express.Router();

  // ==========================================================================
  // Provider Endpoints
  // ==========================================================================

  router.get('/providers', (req: Request, res: Response) => {
    try {
      const providers = aiService.listProviders();
      res.json({
        success: true,
        providers,
        activeProvider: aiService.getProvider().name,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: formatAIError(error),
      });
    }
  });

  router.post('/providers/select', (req: Request, res: Response) => {
    try {
      const { providerName } = req.body;
      if (!providerName) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'providerName is required' },
        });
      }
      
      aiService.selectProvider(providerName);
      res.json({
        success: true,
        activeProvider: aiService.getProvider().name,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: formatAIError(error),
      });
    }
  });

  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await aiService.healthCheck();
      res.json({
        success: true,
        health,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: formatAIError(error),
      });
    }
  });

  // ==========================================================================
  // ReKey-Specific AI Endpoints
  // ==========================================================================

  // Explain recovery policy
  router.post('/explain/policy', async (req: Request, res: Response) => {
    try {
      const request = PolicyExplanationSchema.parse(req.body);
      const response = await aiService.explainPolicy(request);
      res.json({ success: true, data: response });
    } catch (error) {
      handleAIError(res, error);
    }
  });

  // Assess recovery readiness
  router.post('/assess/readiness', async (req: Request, res: Response) => {
    try {
      const request = ReadinessAssessmentSchema.parse(req.body);
      const response = await aiService.assessReadiness(request);
      res.json({ success: true, data: response });
    } catch (error) {
      handleAIError(res, error);
    }
  });

  // Explain guardian threshold
  router.post('/explain/threshold', async (req: Request, res: Response) => {
    try {
      const request = ThresholdExplanationSchema.parse(req.body);
      const response = await aiService.explainThreshold(request);
      res.json({ success: true, data: response });
    } catch (error) {
      handleAIError(res, error);
    }
  });

  // Get security recommendations
  router.post('/recommend/security', async (req: Request, res: Response) => {
    try {
      const request = SecurityRecommendationSchema.parse(req.body);
      const response = await aiService.recommendSecurity(request);
      res.json({ success: true, data: response });
    } catch (error) {
      handleAIError(res, error);
    }
  });

  // Guide recovery simulation
  router.post('/guide/simulation', async (req: Request, res: Response) => {
    try {
      const request = SimulationGuideSchema.parse(req.body);
      const response = await aiService.guideSimulation(request);
      res.json({ success: true, data: response });
    } catch (error) {
      handleAIError(res, error);
    }
  });

  // Explain rewards
  router.post('/explain/rewards', async (req: Request, res: Response) => {
    try {
      const request = RewardsExplanationSchema.parse(req.body);
      const response = await aiService.explainRewards(request);
      res.json({ success: true, data: response });
    } catch (error) {
      handleAIError(res, error);
    }
  });

  // Answer general questions
  router.post('/ask', async (req: Request, res: Response) => {
    try {
      const request = GeneralQuestionSchema.parse(req.body);
      const response = await aiService.answerQuestion(request);
      res.json({ success: true, data: response });
    } catch (error) {
      handleAIError(res, error);
    }
  });

  return router;
}

// ============================================================================
// Express Middleware Factory
// ============================================================================

export function createAIApp(config: any = {}): express.Application {
  const app = express();
  const aiService = createAIService(config);
  const router = createAIRouter(aiService);

  // Use JSON body parser
  app.use(express.json({ limit: '10mb' }));

  // Mount AI router
  app.use('/api/ai', router);

  // Health check
  app.get('/api/ai/health', async (req: Request, res: Response) => {
    try {
      const health = await aiService.healthCheck();
      const allHealthy = Object.values(health).every(h => h.status === 'healthy');
      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'degraded',
        providers: health,
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: formatAIError(error),
      });
    }
  });

  // List models
  app.get('/api/ai/models', async (req: Request, res: Response) => {
    try {
      const models = await aiService.listModels();
      res.json({ success: true, models });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: formatAIError(error),
      });
    }
  });

  return app;
}

// ============================================================================
// Error Handling
// ============================================================================

function formatAIError(error: unknown): { code: string; message: string; details?: any } {
  if (error instanceof AIError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }
  if (error instanceof z.ZodError) {
    return {
      code: 'INVALID_INPUT',
      message: 'Invalid input parameters',
      details: error.errors,
    };
  }
  if (error instanceof Error) {
    return {
      code: 'INTERNAL_ERROR',
      message: error.message,
    };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: 'An unknown error occurred',
  };
}

function handleAIError(res: Response, error: unknown): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      error: formatAIError(error),
    });
  } else if (error instanceof AIError) {
    const status = error.code === 'PROVIDER_UNAVAILABLE' ? 503 :
                   error.code === 'INVALID_INPUT' ? 400 : 500;
    res.status(status).json({
      success: false,
      error: formatAIError(error),
    });
  } else {
    res.status(500).json({
      success: false,
      error: formatAIError(error),
    });
  }
}

// ============================================================================
// Exports
// ============================================================================

export { ReKeyAIService, createAIService };
export type { Router };
