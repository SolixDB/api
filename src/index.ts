import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { config } from './config';
import { authenticateApiKey } from './middleware/auth';
import { rateLimit } from './middleware/rateLimit';
import transactionsRouter from './routes/transactions';
import analyticsRouter from './routes/analytics';
import statsRouter from './routes/stats';
import healthRouter from './routes/health';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Health check (no auth required)
app.use('/health', healthRouter);

// API routes (require authentication and rate limiting)
app.use('/api/v1/transactions', authenticateApiKey, rateLimit, transactionsRouter);
app.use('/api/v1/analytics', authenticateApiKey, rateLimit, analyticsRouter);
app.use('/api/v1/stats', authenticateApiKey, rateLimit, statsRouter);

// GraphQL endpoint
const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  formatError: (error) => {
    console.error('GraphQL error:', error);
    return {
      message: error.message,
      extensions: {
        code: error.extensions?.code,
      },
    };
  },
});

async function startServer() {
  await apolloServer.start();
  
  // GraphQL endpoint with auth and rate limiting
  app.use(
    '/graphql',
    authenticateApiKey,
    rateLimit,
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        const apiKey = req.headers[config.api.keyHeader.toLowerCase()] as string;
        return { apiKey };
      },
    })
  );

  app.listen(config.server.port, () => {
    console.log(`🚀 Server running on port ${config.server.port}`);
    console.log(`📊 REST API: http://localhost:${config.server.port}/api/v1`);
    console.log(`🔮 GraphQL: http://localhost:${config.server.port}/graphql`);
    console.log(`❤️  Health: http://localhost:${config.server.port}/health`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await apolloServer.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await apolloServer.stop();
  process.exit(0);
});

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

