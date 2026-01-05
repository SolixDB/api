import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
// @ts-expect-error - no types available for graphql-depth-limit
import depthLimit from 'graphql-depth-limit';
import cron from 'node-cron';
import { config } from './config';
import { swaggerSpec } from './config/swagger';
import { rateLimit } from './middleware/rateLimit';
import { metricsMiddleware } from './middleware/metrics';
import { graphqlRateLimitPlugin } from './middleware/graphqlRateLimit';
import healthRouter from './routes/health';
import queryRouter from './routes/query';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { logger } from './services/logger';
import { exportService } from './services/exportService';
import { cacheManager } from './services/cacheManager';
import { clickhouseService } from './services/clickhouse';
import { jobQueueService } from './services/jobQueue';
import { v4 as uuidv4 } from 'uuid';
import v8 from 'v8';

const app = express();

// Correlation ID middleware
app.use((_req, res, next) => {
  const correlationId = _req.headers['x-correlation-id'] as string || uuidv4();
  logger.setCorrelationId(correlationId);
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// Memory monitoring middleware
// Smart memory protection: only reject when heap is actually large and under real pressure
app.use((req, res, next) => {
  const isHealthOrMetrics = req.path === '/health' || req.path === '/metrics';
  
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  const heapTotalMB = usage.heapTotal / 1024 / 1024;
  const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;

  // Get max heap limit to check if it's configured correctly
  const heapStats = v8.getHeapStatistics();
  const maxHeapMB = heapStats.heap_size_limit / 1024 / 1024;
  
  // Detect if Node.js max heap is misconfigured (likely NODE_OPTIONS not set)
  // If max heap is < 100MB, it's probably not configured correctly
  const isHeapMisconfigured = maxHeapMB < 100;
  
  if (isHeapMisconfigured) {
    // Don't reject - this is a configuration issue, not a real memory problem
    // Just log a warning (only once per minute to avoid spam)
    const now = Date.now();
    const lastWarningKey = 'heap_size_warning_last_logged';
    const lastWarning = (global as any)[lastWarningKey] || 0;
    if (now - lastWarning > 60000) { // Log max once per minute
      logger.warn('Node.js max heap size is very small - NODE_OPTIONS may not be set', {
        currentHeapMB: Math.round(heapTotalMB),
        maxHeapMB: Math.round(maxHeapMB),
        expectedMB: config.memory.maxHeapMB,
        recommendation: `Set NODE_OPTIONS="--max-old-space-size=${config.memory.maxHeapMB}" before starting the server`,
        note: 'Requests will not be rejected due to small heap size - this is a configuration issue, not a memory constraint.',
      });
      (global as any)[lastWarningKey] = now;
    }
    // Allow all requests through when heap is misconfigured
    next();
    return;
  }

  // Calculate percentage of max heap (more meaningful than percentage of allocated heap)
  const heapUsedPercentOfMax = (usage.heapUsed / heapStats.heap_size_limit) * 100;
  
  // Only reject when max heap is large (> 1GB) AND current allocation is large AND usage is high
  // This protects against real OOM scenarios, not configuration issues
  const isLargeMaxHeap = maxHeapMB > 1024; // Max heap > 1GB
  const isLargeCurrentHeap = heapTotalMB > 1024; // Current allocation > 1GB
  const isHighUsageOfAllocated = heapUsedPercent > config.memory.rejectThresholdPercent;
  const isHighUsageOfMax = heapUsedPercentOfMax > config.memory.rejectThresholdPercent;
  
  if (isLargeMaxHeap && isLargeCurrentHeap && isHighUsageOfMax && !isHealthOrMetrics) {
    logger.warn('Memory usage high on large heap, rejecting request', {
      heapUsedPercentOfAllocated: Math.round(heapUsedPercent),
      heapUsedPercentOfMax: Math.round(heapUsedPercentOfMax),
      heapUsedMB: Math.round(heapUsedMB),
      currentHeapMB: Math.round(heapTotalMB),
      maxHeapMB: Math.round(maxHeapMB),
      path: req.path,
    });

    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Server memory usage too high. Please try again later.',
    });
    return;
  }

  // Log warning for high usage but allow through if heap is small or it's health/metrics
  if (isHighUsageOfAllocated) {
    const now = Date.now();
    const lastWarningKey = `memory_warning_${req.path}_last_logged`;
    const lastWarning = (global as any)[lastWarningKey] || 0;
    if (now - lastWarning > 30000) { // Log max once per 30 seconds per path
      logger.warn('Memory usage high', {
        heapUsedPercentOfAllocated: Math.round(heapUsedPercent),
        heapUsedPercentOfMax: Math.round(heapUsedPercentOfMax),
        heapUsedMB: Math.round(heapUsedMB),
        currentHeapMB: Math.round(heapTotalMB),
        maxHeapMB: Math.round(maxHeapMB),
        path: req.path,
        action: isHealthOrMetrics ? 'allowing (critical endpoint)' : isLargeCurrentHeap ? 'rejecting' : 'allowing (heap will grow)',
        note: `${Math.round(heapUsedPercent)}% of allocated heap, ${Math.round(heapUsedPercentOfMax)}% of max heap`,
      });
      (global as any)[lastWarningKey] = now;
    }
  }

  next();
});

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Metrics endpoint (before other routes)
app.use(metricsMiddleware);

// Swagger UI at root
app.use('/', swaggerUi.serve);
app.get('/', swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SolixDB API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    tryItOutEnabled: true,
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    validatorUrl: null, // Disable online validator
    filter: true, // Enable filter box
    showExtensions: true,
    showCommonExtensions: true,
  },
}));

// Health check (no auth required)
app.use('/health', healthRouter);

// Export file serving
app.use('/exports', express.static(config.export.dir));

// API routes (public, rate limited by IP)
app.use('/api/v1/query', rateLimit, queryRouter);

// Admin endpoints
/**
 * @swagger
 * /admin/suggest-materialized-views:
 *   get:
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

// GraphQL endpoint
const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [graphqlRateLimitPlugin],
  validationRules: [depthLimit(config.graphql.maxDepth)],
  formatError: (error) => {
    logger.error('GraphQL error', error as Error, {
      code: error.extensions?.code,
    });
    return {
      message: error.message,
      extensions: {
        code: error.extensions?.code,
        ...error.extensions,
      },
    };
  },
});

async function startServer() {
  // Check Node.js heap size at startup
  // Use v8.getHeapStatistics() to get the actual max heap limit, not just current allocation
  const heapStats = v8.getHeapStatistics();
  const maxHeapMB = heapStats.heap_size_limit / 1024 / 1024;
  const currentHeapMB = process.memoryUsage().heapTotal / 1024 / 1024;
  const expectedHeapMB = config.memory.maxHeapMB;
  
  // Check if max heap is configured correctly (should be close to expected, allow 10% variance)
  const isHeapConfigured = maxHeapMB >= expectedHeapMB * 0.9;
  
  if (!isHeapConfigured) {
    logger.warn('⚠️  Node.js max heap size is smaller than expected!', {
      currentAllocatedHeapMB: Math.round(currentHeapMB),
      maxHeapLimitMB: Math.round(maxHeapMB),
      expectedMaxHeapMB: expectedHeapMB,
      recommendation: `Set NODE_OPTIONS="--max-old-space-size=${expectedHeapMB}" before starting the server`,
      note: 'The server will still run, but may reject requests due to memory constraints. Health checks will always work.',
    });
    console.warn(`\n⚠️  WARNING: Node.js max heap limit is ${Math.round(maxHeapMB)}MB (expected ${expectedHeapMB}MB)`);
    console.warn(`   Current allocated heap: ${Math.round(currentHeapMB)}MB (will grow as needed up to max limit)`);
    console.warn(`   Set NODE_OPTIONS="--max-old-space-size=${expectedHeapMB}" before starting the server\n`);
  } else {
    logger.info('✅ Node.js heap configuration', {
      currentAllocatedHeapMB: Math.round(currentHeapMB),
      maxHeapLimitMB: Math.round(maxHeapMB),
      expectedMaxHeapMB: expectedHeapMB,
      summary: `Heap: ${Math.round(currentHeapMB)}MB allocated (will grow) / ${Math.round(maxHeapMB)}MB max limit`,
      note: 'Initial heap is small by design - it will grow automatically as needed up to the max limit.',
    });
  }

  await apolloServer.start();
  
  // GraphQL endpoint (public, rate limited by IP)
  /**
   * @swagger
   * /graphql:
   *   post:
   *     summary: Execute a GraphQL query
   *     description: |
   *       Execute GraphQL queries and mutations against the SolixDB GraphQL API.
   *       Use the interactive GraphQL playground at /graphql for testing queries.
   *       This endpoint accepts standard GraphQL POST requests with query, variables, and operationName.
   *     tags: [GraphQL]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - query
   *             properties:
   *               query:
   *                 type: string
   *                 description: GraphQL query string
   *                 example: "query { transactions(limit: 10) { signature timestamp } }"
   *               variables:
   *                 type: object
   *                 description: GraphQL variables (optional)
   *                 additionalProperties: true
   *               operationName:
   *                 type: string
   *                 description: Name of the operation to execute (for multi-operation queries)
   *     responses:
   *       200:
   *         description: GraphQL query executed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: GraphQL response data
   *                   additionalProperties: true
   *                 errors:
   *                   type: array
   *                   items:
   *                     type: object
   *                   description: GraphQL errors (if any)
   *       400:
   *         description: Invalid GraphQL query
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: GraphQL execution error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.use(
    '/graphql',
    rateLimit,
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        return {
          correlationId: req.headers['x-correlation-id'] || uuidv4(),
        };
      },
    })
  );

  // Start export cleanup cron job (runs every hour)
  cron.schedule('0 * * * *', async () => {
    logger.info('Running export cleanup cron job');
    try {
      const deletedCount = await exportService.cleanupExpiredExports();
      logger.info('Export cleanup completed', { deletedCount });
    } catch (error) {
      logger.error('Export cleanup cron error', error as Error);
    }
  });

  app.listen(config.server.port, () => {
    logger.info('🚀 Server started successfully', {
      port: config.server.port,
      nodeEnv: config.server.nodeEnv,
      memory: {
        currentAllocatedHeapMB: Math.round(currentHeapMB),
        maxHeapLimitMB: Math.round(maxHeapMB),
        summary: `${Math.round(currentHeapMB)}MB allocated / ${Math.round(maxHeapMB)}MB max`,
      },
    });
    console.log(`\n🚀 Server running on port ${config.server.port}`);
    console.log(`   Environment: ${config.server.nodeEnv}`);
    console.log(`   Memory: ${Math.round(currentHeapMB)}MB allocated / ${Math.round(maxHeapMB)}MB max limit`);
    console.log(`\n📡 Endpoints:`);
    console.log(`   API Docs (Swagger): http://localhost:${config.server.port}/`);
    console.log(`   GraphQL: http://localhost:${config.server.port}/graphql`);
    console.log(`   SQL Query: http://localhost:${config.server.port}/api/v1/query`);
    console.log(`   Health: http://localhost:${config.server.port}/health`);
    console.log(`   Metrics: http://localhost:${config.server.port}/metrics\n`);
  });
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down server...');
  
  try {
    await apolloServer.stop();
    await clickhouseService.close();
    await cacheManager.cleanup();
    await jobQueueService.close();
    
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

