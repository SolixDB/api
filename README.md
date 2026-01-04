# SolixDB API

Production-ready TypeScript GraphQL API for querying 929M+ Solana transaction instruction records from ClickHouse. A flexible, composable query language for blockchain data analytics.

## Features

- **Flexible GraphQL API** - Composable query primitives, not predefined use cases
- **Query Complexity Scoring** - Real ClickHouse row estimates for accurate cost calculation
- **Smart Caching** - Adaptive caching with real-time blockchain data invalidation
- **ML Dataset Export** - Background job processing for Parquet, CSV, JSONL exports
- **Connection Pooling** - Scales to 200 connections for 1000+ concurrent requests
- **Toggle-able Rate Limiting** - Logarithmic tiers with sliding window tracking
- **Observability** - Prometheus metrics, structured logging, query analysis
- **Memory Protection** - Automatic OOM prevention with heap monitoring
- **Export Management** - Automatic disk space management and cleanup

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

Environment variables (see `.env.example`):

### Core Settings
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `ENABLE_RATE_LIMIT` - Toggle rate limiting on/off (default: true)

### ClickHouse
- `CLICKHOUSE_URL` - ClickHouse server URL
- `CLICKHOUSE_DATABASE` - Database name
- `CLICKHOUSE_USER` - Username
- `CLICKHOUSE_PASSWORD` - Password
- `CLICKHOUSE_POOL_MIN` - Minimum connections (default: 20)
- `CLICKHOUSE_POOL_MAX` - Maximum connections (default: 200)

### Redis
- `REDIS_HOST` - Redis host
- `REDIS_PORT` - Redis port
- `REDIS_PASSWORD` - Redis password
- `REDIS_TTL` - Default cache TTL in seconds

### Rate Limiting
- `RATE_LIMIT_COST_50` - Requests/min for complexity <50 (default: 200)
- `RATE_LIMIT_COST_100` - Requests/min for complexity <100 (default: 100)
- `RATE_LIMIT_COST_200` - Requests/min for complexity <200 (default: 50)
- `RATE_LIMIT_COST_500` - Requests/min for complexity <500 (default: 20)
- `RATE_LIMIT_COST_1000` - Requests/min for complexity <1000 (default: 10)

### Export Settings
- `EXPORT_DIR` - Export directory path (default: /var/solixdb/exports)
- `EXPORT_EXPIRATION_HOURS` - File expiration time (default: 24)
- `EXPORT_MIN_FREE_SPACE_GB` - Minimum free space required (default: 20)
- `EXPORT_MAX_TOTAL_SIZE_GB` - Maximum total export size (default: 100)
- `JWT_SECRET` - Secret for signed download URLs

### Memory
- `MAX_HEAP_MB` - Maximum heap size in MB (default: 8192)
- `MEMORY_REJECT_THRESHOLD_PERCENT` - Reject queries at this heap usage (default: 80)

## API Endpoints

### GraphQL API

**Primary Endpoint:** `POST /graphql`

The GraphQL API provides flexible, composable query primitives. Build your own analytics by combining filters, aggregations, and groupings.

#### Example: Flexible Transactions Query

```graphql
query {
  transactions(
    filters: {
      protocols: ["pump_fun", "pump_amm"]
      dateRange: { start: "2025-01-01", end: "2025-01-31" }
      feeRange: { min: 100000 }
    }
    groupBy: [PROTOCOL, HOUR]
    metrics: [COUNT, AVG_FEE, P95_COMPUTE_UNITS]
    sort: { field: COUNT, direction: DESC }
    pagination: { first: 100 }
  ) {
    edges {
      node {
        protocol
        hour
        count
        avgFee
        p95ComputeUnits
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

#### Example: Query Complexity Check

```graphql
query {
  queryComplexity(
    filters: {
      dateRange: { start: "2025-01-01", end: "2025-01-31" }
      protocols: ["pump_fun"]
    }
    groupBy: [PROTOCOL, HOUR]
    metrics: [COUNT, AVG_FEE]
  ) {
    score
    estimatedRows
    baseCost
    recommendations
  }
}
```

#### Example: ML Dataset Export

```graphql
mutation {
  exportDataset(
    config: {
      format: PARQUET
      filters: {
        protocols: ["pump_fun"]
        dateRange: { start: "2025-01-01", end: "2025-01-31" }
      }
      columns: [
        "protocol_name"
        "fee"
        "compute_units"
        "success"
        "instruction_type"
        "hour"
        "day_of_week"
        "accounts_count"
      ]
      sampling: { strategy: RANDOM, rate: 0.1 }
      splits: { train: 0.7, test: 0.2, val: 0.1 }
    }
  ) {
    id
    status
    progress
  }
}

# Check export job status
query {
  exportJob(id: "job-id-here") {
    status
    progress
    rowCount
    fileSize
    downloadUrl
  }
}
```

#### Example: Time Series Query

```graphql
query {
  timeSeries(
    filters: {
      protocols: ["pump_fun"]
      dateRange: { start: "2025-01-01", end: "2025-01-31" }
    }
    bucketBy: DAY
    metrics: [COUNT, AVG_FEE]
    groupBy: [PROTOCOL]
  ) {
    timestamp
    value
    label
  }
}
```

#### Example: Failed Transactions Analysis

```graphql
query {
  failedTransactions(
    filters: {
      protocols: ["pump_fun"]
      dateRange: { start: "2025-01-01", end: "2025-01-31" }
      errorPattern: "insufficient funds"
    }
    groupBy: [PROTOCOL, INSTRUCTION_TYPE]
    metrics: [COUNT]
    pagination: { first: 100 }
  ) {
    edges {
      node {
        protocolName
        instructionType
        errorMessage
        count
      }
    }
  }
}
```

### REST API (Legacy)

- `GET /api/v1/transactions` - Get transactions with filters
- `GET /api/v1/transactions/:signature` - Get transaction by signature
- `GET /api/v1/analytics/protocols` - Get protocol analytics
- `GET /api/v1/analytics/time-series` - Get time series data
- `GET /api/v1/analytics/fees` - Get fee analytics
- `GET /api/v1/stats` - Get global statistics
- `POST /api/v1/query` - Execute read-only SQL queries (SELECT only)

### Monitoring

- `GET /health` - Health check endpoint
- `GET /metrics` - Prometheus metrics endpoint
- `GET /admin/suggest-materialized-views` - Query pattern analysis for optimization

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
│   ├── config/              # Configuration management
│   ├── services/
│   │   ├── clickhouse.ts    # ClickHouse service with connection pooling
│   │   ├── redis.ts         # Redis caching service
│   │   ├── queryComplexity.ts    # Real row estimate complexity scoring
│   │   ├── queryOptimizer.ts     # Filter ordering optimization
│   │   ├── graphqlQueryBuilder.ts # GraphQL to ClickHouse SQL builder
│   │   ├── cacheManager.ts        # Adaptive caching with invalidation
│   │   ├── exportService.ts       # ML dataset export service
│   │   ├── jobQueue.ts           # BullMQ job queue
│   │   ├── metrics.ts             # Prometheus metrics
│   │   └── logger.ts              # Structured logging (Pino)
│   ├── routes/              # REST API routes (legacy)
│   ├── graphql/
│   │   ├── schema.ts        # GraphQL schema with flexible primitives
│   │   ├── resolvers.ts     # GraphQL resolvers
│   │   ├── resolvers/
│   │   │   └── exportResolvers.ts # Export mutation resolvers
│   │   └── scalars.ts       # Custom scalars (Date, Signature, BigInt)
│   ├── middleware/
│   │   ├── rateLimit.ts     # Complexity-based rate limiting
│   │   ├── graphqlRateLimit.ts # GraphQL rate limit plugin
│   │   └── metrics.ts      # Prometheus metrics endpoint
│   ├── types/               # TypeScript type definitions
│   └── index.ts             # Application entry point
├── dist/                    # Compiled JavaScript
└── package.json             # Dependencies
```

## Key Design Principles

1. **Composable Primitives** - Not predefined use cases, but building blocks
2. **Real Performance Metrics** - Query complexity based on actual row estimates
3. **Fail Fast** - Clear error messages with actionable recommendations
4. **Resource Protection** - Memory limits, connection pooling, disk space management
5. **Observability First** - Comprehensive logging and metrics for optimization
6. **Production Ready** - Error handling, graceful shutdown, health checks

## Query Optimization

### Complexity Scoring

Queries are scored using real ClickHouse row estimates:
- Base cost = `estimated_rows / 10000`
- GROUP BY multiplier = `2^dimensions`
- Aggregation cost = `+10% per aggregation`
- Queries >5M estimated rows require pagination
- Queries >1000 complexity are rejected

### Filter Ordering

Filters are applied in optimal order:
1. `signature =` (bloom filter, super selective)
2. `program_id IN` (bloom filter, very selective)
3. `date BETWEEN` (partition pruning)
4. `slot BETWEEN` (somewhat selective)
5. `protocol_name IN` (bloom filter, less selective)
6. Everything else

### Caching Strategy

- **Hot queries** (>5 hits): 1 hour cache
- **Recent data** (<24h): 5 min cache
- **Historical data**: 24 hour cache
- **Aggregations**: 30 min cache
- **Real-time invalidation**: Checks for new blockchain data every 60s

### Pagination

- Queries returning >10k rows: **FORCE cursor pagination**
- Cursor format: `(slot, signature)` composite
- Max 1000 rows per page
- Aggregations capped at 10k groups

## Performance

- **Response Time**: <100ms p95 for simple queries, <1s for complex queries
- **Concurrency**: Handles 1000+ concurrent requests
- **Connection Pool**: 20-200 connections (auto-scaling)
- **Cache Hit Rate**: >70% for historical queries
- **Memory**: 8GB heap with 80% rejection threshold
- **Export Processing**: Background jobs with 50k row chunks

## Rate Limiting

Rate limiting uses logarithmic tiers based on query complexity:

| Complexity | Limit (per minute) |
|------------|-------------------|
| < 50       | 200               |
| < 100      | 100               |
| < 200      | 50                |
| < 500      | 20                |
| < 1000     | 10                |
| ≥ 1000     | Rejected          |

- **Sliding window**: Tracks total cost used in last 60 seconds
- **Toggle-able**: Set `ENABLE_RATE_LIMIT=false` to disable
- **Export mutations**: 5 per hour limit

## Security

- **Helmet**: Security headers
- **CORS**: Configurable CORS policies
- **Rate Limiting**: Complexity-based with sliding window
- **Input Validation**: GraphQL schema validation
- **Query Depth Limiting**: Max 5 levels
- **Memory Protection**: Automatic OOM prevention

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

### Prometheus Metrics

```bash
curl http://localhost:3000/metrics
```

Available metrics:
- `graphql_query_duration_seconds` - Query latency by complexity tier
- `graphql_query_complexity_score` - Complexity distribution
- `cache_hit_rate` - Cache effectiveness
- `clickhouse_query_duration_seconds` - Database query performance
- `active_connections` - Connection pool usage
- `memory_heap_used_bytes` - Memory consumption
- `export_jobs_total` - Export job statistics
- `rate_limit_hits_total` - Rate limit enforcement

### Structured Logging

All logs include:
- Correlation IDs for request tracking
- Query signatures for analysis
- Complexity scores and execution times
- Memory usage metrics
- Slow query detection (>2s)

## ML Dataset Export

Export large datasets for machine learning training:

1. **Create export job** via GraphQL mutation
2. **Track progress** with `exportJob` query
3. **Download** via signed URL when complete

Supported formats:
- **CSV** - ClickHouse native format, gzip compressed
- **JSONL** - JSON Lines, gzip compressed
- **Parquet** - ClickHouse native Parquet format (requires ClickHouse 21.12+)

Features:
- Background processing with BullMQ
- Automatic disk space management
- 24-hour file expiration
- Sampling and train/test/val splits
- Preprocessing options (normalization, one-hot encoding)

## Example Use Cases

### Use Case 1: Analyze Failed Jupiter Swaps

```graphql
query {
  failedTransactions(
    filters: {
      protocols: ["jupiter"]
      dateRange: { start: "2025-01-01", end: "2025-01-31" }
      accountsCount: { min: 50 }
    }
    groupBy: [INSTRUCTION_TYPE]
    metrics: [COUNT]
    sort: { field: COUNT, direction: DESC }
  ) {
    edges {
      node {
        instructionType
        count
      }
    }
  }
}
```

### Use Case 2: Fee Analysis by Day of Week

```graphql
query {
  transactions(
    filters: {
      protocols: ["pump_fun"]
      dateRange: { start: "2025-01-01", end: "2025-01-31" }
    }
    groupBy: [DAY_OF_WEEK]
    metrics: [AVG_FEE, P95_FEE, COUNT]
    sort: { field: AVG_FEE, direction: DESC }
  ) {
    edges {
      node {
        dayOfWeek
        avgFee
        p95Fee
        count
      }
    }
  }
}
```

### Use Case 3: Export Training Dataset

```graphql
mutation {
  exportDataset(
    config: {
      format: PARQUET
      filters: {
        dateRange: { start: "2024-01-01", end: "2024-12-31" }
        success: true
      }
      columns: [
        "protocol_name"
        "fee"
        "compute_units"
        "instruction_type"
        "hour"
        "day_of_week"
        "accounts_count"
      ]
      sampling: { strategy: RANDOM, rate: 0.1 }
    }
  ) {
    id
    status
  }
}
```

## Troubleshooting

### Query Too Complex

If you get a "Query complexity too high" error:
1. Check complexity with `queryComplexity` query
2. Narrow date range
3. Reduce GROUP BY dimensions
4. Use `exportDataset` mutation for large datasets

### Rate Limit Exceeded

Rate limits are based on query complexity:
- Check `X-RateLimit-Remaining` header
- Use `Retry-After` header to know when to retry
- Consider using exports for bulk data access

### Memory Issues

If queries are rejected due to memory:
- Server monitors heap usage automatically
- Queries rejected at 80% heap usage
- Increase `MAX_HEAP_MB` if needed
- Check `/metrics` for memory statistics

## License

MIT

## Support

For questions or issues, please contact support or open an issue in the repository.
