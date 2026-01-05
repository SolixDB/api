import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { config } from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SolixDB API',
      version: '1.0.0',
      description: 'Scaled API/GraphQL Service for Solana Transaction Data',
      contact: {
        name: 'SolixDB',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}`,
        description: 'Local development server',
      },
      {
        url: 'https://api.solixdb.xyz',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check and monitoring endpoints',
      },
      {
        name: 'Query',
        description: 'SQL query execution endpoints',
      },
      {
        name: 'Admin',
        description: 'Administrative endpoints',
      },
      {
        name: 'GraphQL',
        description: 'GraphQL API endpoint (see /graphql for interactive playground)',
      },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type',
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy'],
              description: 'Overall health status',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp of health check',
            },
            services: {
              type: 'object',
              properties: {
                clickhouse: {
                  type: 'string',
                  enum: ['up', 'down'],
                },
                redis: {
                  type: 'string',
                  enum: ['up', 'down'],
                },
              },
            },
          },
        },
        QueryRequest: {
          type: 'object',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              description: 'SQL SELECT query (read-only, no write operations allowed)',
              example: 'SELECT * FROM transactions LIMIT 10',
            },
            format: {
              type: 'string',
              enum: ['json', 'csv'],
              default: 'json',
              description: 'Response format',
            },
          },
        },
        QueryResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true,
              },
              description: 'Query results',
            },
            count: {
              type: 'integer',
              description: 'Number of rows returned',
            },
            query: {
              type: 'string',
              description: 'The executed query (sanitized)',
            },
          },
        },
      },
    },
  },
  apis: [
    path.join(__dirname, '../routes/*.ts'),
    path.join(__dirname, '../index.ts'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

