import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';
import { swaggerSpec } from './config/swagger';
import { apiKeyAuth } from './middleware/apiKeyAuth';
import { metricsMiddleware } from './middleware/metrics';
import { rateLimit } from './middleware/rateLimit';
import { creditCheck } from './middleware/creditCheck';
import healthRouter from './routes/health';
import queryRouter from './routes/query';
import rpcRouter from './routes/rpc';
import { cacheManager } from './services/cacheManager';
import { clickhouseService } from './services/clickhouse';
import { logger } from './services/logger';

const app = express();

// Correlation ID middleware
app.use((_req, res, next) => {
  const correlationId = _req.headers['x-correlation-id'] as string || uuidv4();
  logger.setCorrelationId(correlationId);
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// Security middleware
app.use(helmet());
app.use(cors());
// Configure compression to skip metrics endpoint to avoid decompression errors
app.use(compression({
  filter: (req, res) => {
    // Skip compression for metrics endpoint to avoid decompression errors on large responses
    if (req.path === '/metrics') {
      return false;
    }
    // Use default compression filter for other routes
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses > 1KB
}));
app.use(express.json());

// Metrics endpoint (before other routes)
app.use(metricsMiddleware);

// Swagger JSON endpoint for debugging
app.get('/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});

// Swagger UI at root
app.use('/', swaggerUi.serve);
app.get('/', swaggerUi.setup(swaggerSpec, {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .opblock.opblock-get { border-color: #61affe; background: rgba(97,175,254,.1); }
    .swagger-ui .opblock.opblock-post { border-color: #49cc90; background: rgba(73,204,144,.1); }
    .swagger-ui .opblock-tag { cursor: pointer; }
    .swagger-ui .opblock-tag-section { cursor: pointer; }
    .swagger-ui .opblock-summary { cursor: pointer; }
    .swagger-ui .opblock-summary:hover { background: rgba(0,0,0,.05); }
  `,
  customSiteTitle: 'SolixDB API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    tryItOutEnabled: true,
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    validatorUrl: null,
    filter: true,
    docExpansion: 'full', // Expand all operations by default - 'none', 'list', or 'full'
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    displayOperationId: false,
    showExtensions: true,
    showCommonExtensions: true,
    deepLinking: true, // Enable deep linking for direct navigation
    withCredentials: false,
    requestInterceptor: (request: unknown) => {
      // Ensure requests work properly
      return request;
    },
    responseInterceptor: (response: unknown) => {
      // Ensure responses are handled properly
      return response;
    },
  },
}));

// Health check (no auth required)
app.use('/health', healthRouter);

// API routes (protected with API key auth, credit check, and rate limiting)
app.use('/v1/query', apiKeyAuth, creditCheck, rateLimit, queryRouter);
app.use('/v1/rpc', apiKeyAuth, creditCheck, rateLimit, rpcRouter);

// Admin endpoints
/**
 * @swagger
 * /admin/suggest-materialized-views:
 *   get:
 *     operationId: getMaterializedViewSuggestions
 *     summary: Get materialized view suggestions
 *     description: Analyzes query logs to suggest materialized views for optimization (implementation pending)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Materialized view suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 note:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/admin/suggest-materialized-views', async (_req, res) => {
  try {
    // This would analyze query logs to suggest materialized views
    // For now, return a placeholder
    res.json({
      message: 'Materialized view suggestions endpoint',
      note: 'This endpoint will analyze query logs to suggest materialized views. Implementation pending.',
    });
  } catch (error) {
    logger.error('Materialized view suggestion error', error as Error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function startServer() {
  app.listen(config.server.port, () => {
    logger.info('🚀 Server started successfully', {
      port: config.server.port,
      nodeEnv: config.server.nodeEnv,
    });
    console.log(`\n🚀 Server running on port ${config.server.port}`);
    console.log(`   Environment: ${config.server.nodeEnv}`);
    console.log(`\n📡 Endpoints:`);
    console.log(`   API Docs (Swagger): https://api.solixdb.xyz/`);
    console.log(`   SQL Query: https://api.solixdb.xyz/v1/query`);
    console.log(`   Health: https://api.solixdb.xyz/health`);
    console.log(`   Metrics: https://api.solixdb.xyz/metrics\n`);
  });
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down server...');

  try {
    await clickhouseService.close();
    await cacheManager.cleanup();

    logger.info('Server shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});

