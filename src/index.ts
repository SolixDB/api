import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { config } from './config';
import { rateLimit } from './middleware/rateLimit';
import transactionsRouter from './routes/transactions';
import analyticsRouter from './routes/analytics';
import statsRouter from './routes/stats';
import healthRouter from './routes/health';
import queryRouter from './routes/query';
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

// API routes (public, rate limited by IP)
app.use('/api/v1/transactions', rateLimit, transactionsRouter);
app.use('/api/v1/analytics', rateLimit, analyticsRouter);
app.use('/api/v1/stats', rateLimit, statsRouter);
app.use('/api/v1/query', rateLimit, queryRouter);

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
  
  // GraphQL endpoint (public, rate limited by IP)
  app.use(
    '/graphql',
    rateLimit,
    expressMiddleware(apolloServer, {
      context: async () => {
        return {};
      },
    })
  );

  app.listen(config.server.port, () => {
    console.log(`Server running on port ${config.server.port}`);
    console.log(`REST API: http://localhost:${config.server.port}/api/v1`);
    console.log(`SQL Query: http://localhost:${config.server.port}/api/v1/query`);
    console.log(`GraphQL: http://localhost:${config.server.port}/graphql`);
    console.log(`Health: http://localhost:${config.server.port}/health`);
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

