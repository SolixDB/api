# SolixDB API

Production-ready TypeScript API/GraphQL service for querying 390M+ Solana transaction instruction records from ClickHouse.

## Features

- **REST API** - Fast, standardized endpoints for common queries
- **GraphQL API** - Flexible querying with exactly the data you need
- **High Performance** - Optimized queries with < 500ms response times
- **Redis Caching** - Intelligent caching for improved performance
- **Rate Limiting** - IP-based rate limiting to prevent abuse
- **Analytics** - Protocol analytics, time series, and fee statistics
- **Health Checks** - Built-in health monitoring

## Quick Start

### Prerequisites

- Node.js 20+
- ClickHouse database access
- Redis instance

### Installation

```bash
# Clone the repository
git clone https://github.com/SolixDB/api
cd api

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Build the project
npm run build

# Start the server
npm start
```

## Configuration

See `.env.example` for all configuration options:

- **ClickHouse**: Database connection settings
- **Redis**: Cache connection settings
- **API**: Rate limiting configuration

## API Endpoints

### REST API

- `GET /api/v1/transactions` - Get transactions with filters
- `GET /api/v1/transactions/:signature` - Get transaction by signature
- `GET /api/v1/analytics/protocols` - Get protocol analytics
- `GET /api/v1/analytics/time-series` - Get time series data
- `GET /api/v1/analytics/fees` - Get fee analytics
- `GET /api/v1/stats` - Get global statistics

### GraphQL

- `POST /graphql` - GraphQL endpoint

### Health

- `GET /health` - Health check endpoint

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- [Getting Started](./docs/getting-started.md)
- [REST API Reference](./docs/rest-api.md)
- [GraphQL API Reference](./docs/graphql-api.md)
- [Rate Limiting](./docs/rate-limiting.md)
- [Error Handling](./docs/error-handling.md)
- [Examples](./docs/examples.md)

**Live Documentation:** [docs.solixdb.xyz](https://docs.solixdb.xyz) (when deployed)

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

## Testing

Run the comprehensive test suite to verify all endpoints:

```bash
# Test against local server (default: http://localhost:3000)
./test-api.sh

# Test against custom URL
BASE_URL=https://api.solixdb.xyz ./test-api.sh
```

The test suite covers:
- Health check endpoint
- All REST API endpoints
- GraphQL queries
- Rate limiting headers

## Project Structure

```
api/
├── src/
│   ├── config/          # Configuration
│   ├── services/        # Business logic (ClickHouse, Redis, Transactions)
│   ├── routes/          # REST API routes
│   ├── graphql/         # GraphQL schema and resolvers
│   ├── middleware/     # Auth, rate limiting
│   ├── validators/      # Request validation
│   ├── types/           # TypeScript types
│   └── index.ts         # Application entry point
├── docs/                # Documentation
└── package.json         # Dependencies
```

## Query Optimization

The service is optimized for ClickHouse:

- **Partition Pruning**: Always filter by `date` when possible
- **Bloom Filters**: Uses indexes on `protocol_name`, `program_id`, `signature`
- **Caching**: Redis caching for common queries
- **LIMIT Clauses**: Always uses LIMIT to prevent large result sets

## Performance

- **Response Time**: < 500ms for most queries
- **Concurrency**: Handles 100+ concurrent requests
- **Caching**: Redis caching reduces database load
- **Connection Pooling**: Efficient database connection management

## Security

- **Helmet**: Security headers
- **CORS**: Configurable CORS policies
- **Rate Limiting**: IP-based rate limiting
- **Input Validation**: Zod schema validation

## Monitoring

Health check endpoint provides service status:

```bash
curl http://localhost:3000/health
```

Response includes:
- Overall service status
- ClickHouse connection status
- Redis connection status

## License

MIT

## Support

For questions or issues, please contact support or open an issue in the repository.

