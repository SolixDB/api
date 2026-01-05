import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
// @ts-expect-error - no types available for graphql-depth-limit
import depthLimit from 'graphql-depth-limit';
import cron from 'node-cron';
import { config } from './config';
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

  // Only reject when max heap is large (> 1GB) AND current allocation is large AND usage is high
  // This protects against real OOM scenarios, not configuration issues
  const isLargeMaxHeap = maxHeapMB > 1024; // Max heap > 1GB
  const isLargeCurrentHeap = heapTotalMB > 1024; // Current allocation > 1GB
  const isHighUsage = heapUsedPercent > config.memory.rejectThresholdPercent;
  
  if (isLargeMaxHeap && isLargeCurrentHeap && isHighUsage && !isHealthOrMetrics) {
    logger.warn('Memory usage high on large heap, rejecting request', {
      heapUsedPercent: Math.round(heapUsedPercent),
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
  if (isHighUsage) {
    const now = Date.now();
    const lastWarningKey = `memory_warning_${req.path}_last_logged`;
    const lastWarning = (global as any)[lastWarningKey] || 0;
    if (now - lastWarning > 30000) { // Log max once per 30 seconds per path
      logger.warn('Memory usage high', {
        heapUsedPercent: Math.round(heapUsedPercent),
        heapUsedMB: Math.round(heapUsedMB),
        currentHeapMB: Math.round(heapTotalMB),
        maxHeapMB: Math.round(maxHeapMB),
        path: req.path,
        action: isHealthOrMetrics ? 'allowing (critical endpoint)' : isLargeCurrentHeap ? 'rejecting' : 'allowing (heap will grow)',
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

// Health check (no auth required)
app.use('/health', healthRouter);

// Export file serving
app.use('/exports', express.static(config.export.dir));

// API routes (public, rate limited by IP)
app.use('/api/v1/query', rateLimit, queryRouter);

// Admin endpoints
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
      currentHeapMB: Math.round(currentHeapMB),
      maxHeapMB: Math.round(maxHeapMB),
      expectedHeapMB,
      recommendation: `Set NODE_OPTIONS="--max-old-space-size=${expectedHeapMB}" before starting the server`,
      note: 'The server will still run, but may reject requests due to memory constraints. Health checks will always work.',
    });
    console.warn(`\n⚠️  WARNING: Node.js max heap size is ${Math.round(maxHeapMB)}MB (expected ${expectedHeapMB}MB)`);
    console.warn(`   Current allocated heap: ${Math.round(currentHeapMB)}MB (will grow as needed)`);
    console.warn(`   Set NODE_OPTIONS="--max-old-space-size=${expectedHeapMB}" before starting the server\n`);
  } else {
    logger.info('Node.js heap size configured correctly', {
      currentHeapMB: Math.round(currentHeapMB),
      maxHeapMB: Math.round(maxHeapMB),
      expectedHeapMB,
      note: 'Initial heap is small by design - it will grow as needed up to the max limit.',
    });
  }

  await apolloServer.start();
  
  // GraphQL endpoint (public, rate limited by IP)
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

  // Start memory monitoring (every 30 seconds)
  setInterval(() => {
    logger.logMemoryUsage();
  }, 30000);

  app.listen(config.server.port, () => {
    logger.info('Server started', {
      port: config.server.port,
      nodeEnv: config.server.nodeEnv,
      currentHeapMB: Math.round(currentHeapMB),
      maxHeapMB: Math.round(maxHeapMB),
    });
    console.log(`Server running on port ${config.server.port}`);
    console.log(`GraphQL: http://localhost:${config.server.port}/graphql`);
    console.log(`SQL Query: http://localhost:${config.server.port}/api/v1/query`);
    console.log(`Health: http://localhost:${config.server.port}/health`);
    console.log(`Metrics: http://localhost:${config.server.port}/metrics`);
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

