import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { existsSync } from 'fs';
import { config } from './index';

// Find the source directory - works in both dev and production
function findSourceDir(): string {
  // Try to find src directory relative to current location
  const possiblePaths = [
    path.join(process.cwd(), 'src'), // From project root
    path.join(__dirname, '../../src'), // From dist/config
    path.join(__dirname, '../src'), // If running from src/config directly
  ];
  
  for (const srcPath of possiblePaths) {
    if (existsSync(srcPath)) {
      return srcPath;
    }
  }
  
  // Fallback to process.cwd() + src
  return path.join(process.cwd(), 'src');
}

const srcDir = findSourceDir();

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
    path.join(srcDir, 'routes/*.ts'),
    path.join(srcDir, 'index.ts'),
  ],
};

// Generate swagger spec with error handling
let swaggerSpec: any;
try {
  swaggerSpec = swaggerJsdoc(options);
  
  // Always log swagger spec generation for debugging
  const paths = Object.keys(swaggerSpec.paths || {});
  const pathDetails = paths.map(path => {
    const methods = Object.keys(swaggerSpec.paths[path] || {});
    return `${path} [${methods.join(', ').toUpperCase()}]`;
  });
  
  console.log(`✅ Swagger spec generated successfully`);
  console.log(`   Source directory: ${srcDir}`);
  console.log(`   Endpoints found: ${paths.length}`);
  console.log(`   ${pathDetails.join('\n   ')}`);
  
  // Validate that we have endpoints
  if (paths.length === 0) {
    console.warn('⚠️  WARNING: No endpoints found in Swagger spec!');
    console.warn(`   Searched in: ${options.apis?.join(', ') || 'unknown'}`);
  }
} catch (error: any) {
  console.error('❌ Failed to generate Swagger spec:', error);
  console.error('   Error details:', error.message);
  console.error('   Stack:', error.stack);
  // Provide a minimal spec so the UI still loads
  swaggerSpec = {
    openapi: '3.0.0',
    info: {
      title: 'SolixDB API',
      version: '1.0.0',
      description: 'Error loading API documentation',
    },
    paths: {},
  };
}

export { swaggerSpec };

