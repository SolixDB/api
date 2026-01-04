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

const app = express();

// Correlation ID middleware
app.use((_req, res, next) => {
  const correlationId = _req.headers['x-correlation-id'] as string || uuidv4();
  logger.setCorrelationId(correlationId);
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// Memory monitoring middleware
app.use((_req, res, next) => {
  const usage = process.memoryUsage();
  const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;

  if (heapUsedPercent > config.memory.rejectThresholdPercent) {
    logger.warn('Memory usage high, rejecting request', {
      heapUsedPercent: Math.round(heapUsedPercent),
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
    });

    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Server memory usage too high. Please try again later.',
    });
    return;
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

