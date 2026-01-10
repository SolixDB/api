# SolixDB API

Production-ready TypeScript REST/JSON-RPC API for querying 929M+ Solana transaction instruction records from ClickHouse. A flexible, composable API for blockchain data analytics.

## Features

- **REST & JSON-RPC API** - Flexible query endpoints with JSON-RPC 2.0 support
- **API Key Authentication** - Secure API key-based authentication with plan-based rate limiting
- **Smart Caching** - Adaptive caching with real-time blockchain data invalidation
- **Connection Pooling** - Scales to 200 connections for 1000+ concurrent requests
- **Plan-Based Rate Limiting** - Rate limits based on subscription plan (free/x402/enterprise)
- **Observability** - Prometheus metrics, structured logging, query analysis
- **Memory Protection** - Automatic OOM prevention with heap monitoring
- **SQL Query Support** - Direct SQL query execution with automatic LIMIT injection

## Quick Start

### Prerequisites

- Node.js 20+
- ClickHouse database access
- Redis instance
- Supabase instance (for API key management)

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

### Supabase (for API Key Management)
- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### Rate Limiting (Plan-Based)
- `RATE_LIMIT_FREE` - Requests/min for free plan (default: 100)
- `RATE_LIMIT_X402` - Requests/min for x402 plan (default: 500)
- `RATE_LIMIT_ENTERPRISE` - Requests/min for enterprise plan (default: 2000)

### Memory
- `MAX_HEAP_MB` - Maximum heap size in MB (default: 16384)
- `MEMORY_REJECT_THRESHOLD_PERCENT` - Reject queries at this heap usage (default: 80)

## API Endpoints

### Authentication

All API endpoints (except `/health` and `/metrics`) require API key authentication. Include your API key in one of the following ways:

- **Header**: `x-api-key: YOUR_API_KEY`
- **Query Parameter**: `?api-key=YOUR_API_KEY`

### JSON-RPC API

**Primary Endpoint:** `POST /v1/rpc`

The JSON-RPC API provides method-based access to Solana transaction analytics, following the JSON-RPC 2.0 specification. All methods are designed specifically for SolixDB's analytics capabilities.

#### Available Methods

- `getTransaction` - Get a single transaction by signature
- `getTransactions` - Get transactions with filters (protocol, instruction type, time range, etc.)
- `getProtocolStats` - Get comprehensive statistics for a protocol
- `getProtocolComparison` - Compare multiple protocols side by side
- `getInstructionTypes` - Get instruction types with statistics for protocols
- `getProtocolActivity` - Get time-series activity data (hourly/daily)
- `getTopProtocols` - Get top protocols by transaction count, fees, or success rate
- `getFailedTransactions` - Get failed transactions with error details
- `getProtocolPerformance` - Get performance metrics (percentiles, averages)
- `getProtocols` - Get list of all available protocols

#### Example: Get Transaction by Signature

```javascript
const response = await fetch('https://api.solixdb.xyz/v1/rpc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getTransaction',
    params: ['5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4LjF3ZdUi2gEB9M2K3j3gv6q']
  })
});

const data = await response.json();
console.log('Transaction:', data.result);
```

#### Example: Get Transactions with Filters

```javascript
const response = await fetch('https://api.solixdb.xyz/v1/rpc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getTransactions',
    params: [{
      sortOrder: 'desc',
      limit: 50,
      filters: {
        blockTime: {
          gte: 1735689600,  // Jan 1, 2025
          lte: 1738368000   // Jan 31, 2025
        },
        status: 'succeeded',
        protocols: ['drift_v2', 'kamino_lending'],
        instructionTypes: ['Deposit', 'Withdraw']
      }
    }]
  })
});

const data = await response.json();
console.log('Transactions:', data.result.data);
```

#### Example: Get Protocol Statistics

```javascript
const response = await fetch('https://api.solixdb.xyz/v1/rpc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'getProtocolStats',
    params: [{
      protocolName: 'drift_v2',
      blockTime: {
        gte: 1735689600,
        lte: 1738368000
      }
    }]
  })
});

const data = await response.json();
console.log('Protocol Stats:', data.result);
// Returns: totalTransactions, successRate, averageFee, averageComputeUnits, etc.
```

#### Example: Compare Multiple Protocols

```javascript
const response = await fetch('https://api.solixdb.xyz/v1/rpc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'getProtocolComparison',
    params: [{
      protocols: ['drift_v2', 'kamino_lending', 'meteora_dlmm'],
      blockTime: {
        gte: 1735689600,
        lte: 1738368000
      }
    }]
  })
});

const data = await response.json();
console.log('Protocol Comparison:', data.result);
// Returns side-by-side comparison of protocols
```

#### Example: Get Top Protocols

```javascript
const response = await fetch('https://api.solixdb.xyz/v1/rpc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 4,
    method: 'getTopProtocols',
    params: [{
      limit: 10,
      sortBy: 'transactions',  // or 'fees' or 'successRate'
      blockTime: {
        gte: 1735689600,
        lte: 1738368000
      }
    }]
  })
});

const data = await response.json();
console.log('Top Protocols:', data.result);
```

#### Example: Get Protocol Activity (Time-Series)

```javascript
const response = await fetch('https://api.solixdb.xyz/v1/rpc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 5,
    method: 'getProtocolActivity',
    params: [{
      protocolName: 'drift_v2',  // optional, omit for all protocols
      blockTime: {
        gte: 1735689600,
        lte: 1738368000
      },
      interval: 'hour'  // or 'day'
    }]
  })
});

const data = await response.json();
console.log('Activity Data:', data.result);
// Returns time-series data points with counts, fees, compute units
```

#### Example: Get Instruction Types for a Protocol

```javascript
const response = await fetch('https://api.solixdb.xyz/v1/rpc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 6,
    method: 'getInstructionTypes',
    params: [{
      protocolName: 'kamino_lending',
      limit: 20
    }]
  })
});

const data = await response.json();
console.log('Instruction Types:', data.result);
// Returns instruction types with counts, success rates, averages
```

#### Example: Get Protocol Performance Metrics

```javascript
const response = await fetch('https://api.solixdb.xyz/v1/rpc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 7,
    method: 'getProtocolPerformance',
    params: [{
      protocolName: 'drift_v2',
      blockTime: {
        gte: 1735689600,
        lte: 1738368000
      }
    }]
  })
});

const data = await response.json();
console.log('Performance Metrics:', data.result);
// Returns: successRate, p50/p95/p99 compute units, averages
```

#### Example: Get Failed Transactions

```javascript
const response = await fetch('https://api.solixdb.xyz/v1/rpc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 8,
    method: 'getFailedTransactions',
    params: [{
      protocolName: 'drift_v2',
      limit: 100
    }]
  })
});

const data = await response.json();
console.log('Failed Transactions:', data.result.data);
// Returns failed transactions with error messages and logs
```

#### Example: Get Available Protocols

```javascript
const response = await fetch('https://api.solixdb.xyz/v1/rpc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 9,
    method: 'getProtocols',
    params: []
  })
});

const data = await response.json();
console.log('Available Protocols:', data.result);
// Returns: ['drift_v2', 'kamino_farms', 'kamino_lending', ...]
```

### SQL Query API

**Endpoint:** `POST /v1/query`

Execute read-only SQL SELECT queries against ClickHouse. Queries automatically get a default LIMIT of 1000 if not specified (max 10,000).

#### Example: Simple Query

```javascript
const response = await fetch('https://api.solixdb.xyz/v1/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({
    query: 'SELECT * FROM transactions WHERE protocol_name = \'pump_fun\'',
    format: 'json'
  })
});

const data = await response.json();
console.log('Results:', data.data);
```

**Note:** The query will automatically have `LIMIT 1000` appended if no LIMIT is present. You can specify your own LIMIT (up to 10,000).

### Health Check

**Endpoint:** `GET /health`

Returns the health status of the API and its dependencies.

```bash
curl https://api.solixdb.xyz/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "uptime": 12345,
  "environment": "production",
  "services": {
    "clickhouse": "up",
    "redis": "up"
  }
}
```

### Metrics (Prometheus)

**Endpoint:** `GET /metrics`

Exposes Prometheus metrics for monitoring.

```bash
curl https://api.solixdb.xyz/metrics
```

## Rate Limiting

Rate limiting is based on your subscription plan:

| Plan | Requests per Minute |
|------|-------------------|
| Free | 100 |
| x402 | 500 |
| Enterprise | 2000 |

Rate limit headers are included in all responses:
- `X-RateLimit-Limit` - Your plan's rate limit
- `X-RateLimit-Remaining` - Remaining requests in current window
- `X-RateLimit-Reset` - When the rate limit window resets
- `X-RateLimit-Plan` - Your current plan tier

When rate limited, you'll receive a `429 Too Many Requests` response with a `Retry-After` header.

## SQL Query Handling

- **Automatic LIMIT**: If your query doesn't include a LIMIT clause, a default LIMIT of 1000 is automatically added
- **Maximum LIMIT**: The maximum allowed LIMIT is 10,000 rows
- **Read-Only**: Only SELECT queries are allowed (no INSERT, UPDATE, DELETE, etc.)
- **Query Validation**: All queries are validated for safety before execution

## Security

- **Helmet**: Security headers
- **CORS**: Configurable CORS policies
- **API Key Authentication**: Required for all API endpoints
- **Rate Limiting**: Plan-based with sliding window
- **Input Validation**: Query validation and sanitization
- **Memory Protection**: Automatic OOM prevention

## Monitoring

### Health Check

```bash
curl https://api.solixdb.xyz/health
```

### Prometheus Metrics

```bash
curl https://api.solixdb.xyz/metrics
```

Available metrics:
- `api_request_duration_seconds` - API request latency by endpoint
- `api_request_total` - Total API requests by endpoint and status
- `cache_hit_rate` - Cache effectiveness
- `clickhouse_query_duration_seconds` - Database query performance
- `active_connections` - Connection pool usage
- `memory_heap_used_bytes` - Memory consumption
- `rate_limit_hits_total` - Rate limit enforcement by plan

### Structured Logging

All logs include:
- Correlation IDs for request tracking
- Query signatures for analysis
- Execution times
- Memory usage metrics
- Slow query detection (>2s)

## Project Structure

```
api/
├── src/
│   ├── config/              # Configuration management
│   ├── services/
│   │   ├── clickhouse.ts    # ClickHouse service with connection pooling
│   │   ├── redis.ts         # Redis caching service
│   │   ├── supabase.ts      # Supabase service for API key validation
│   │   ├── rpcService.ts    # JSON-RPC method handlers
│   │   ├── cacheManager.ts  # Adaptive caching with invalidation
│   │   ├── metrics.ts       # Prometheus metrics
│   │   └── logger.ts        # Structured logging (Pino)
│   ├── routes/              # REST API routes
│   │   ├── health.ts        # Health check endpoint
│   │   ├── query.ts         # SQL query endpoint
│   │   └── rpc.ts           # JSON-RPC endpoint
│   ├── middleware/
│   │   ├── apiKeyAuth.ts    # API key authentication middleware
│   │   ├── rateLimit.ts     # Plan-based rate limiting
│   │   └── metrics.ts      # Prometheus metrics endpoint
│   ├── types/               # TypeScript type definitions
│   └── index.ts             # Application entry point
├── dist/                    # Compiled JavaScript
└── package.json             # Dependencies
```

## Key Design Principles

1. **API Key Authentication** - All endpoints require valid API keys
2. **Plan-Based Limits** - Rate limits based on subscription tier
3. **Fail Fast** - Clear error messages with actionable recommendations
4. **Resource Protection** - Memory limits, connection pooling
5. **Observability First** - Comprehensive logging and metrics
6. **Production Ready** - Error handling, graceful shutdown, health checks

## Performance

- **Response Time**: <100ms p95 for simple queries, <1s for complex queries
- **Concurrency**: Handles 1000+ concurrent requests
- **Connection Pool**: 20-200 connections (auto-scaling)
- **Cache Hit Rate**: >70% for historical queries
- **Memory**: 16GB heap with 80% rejection threshold

## Troubleshooting

### Invalid API Key

If you get a 401 Unauthorized error:
1. Verify your API key is correct
2. Check that the key is active in your dashboard
3. Ensure you're sending it via `x-api-key` header or `api-key` query parameter

### Rate Limit Exceeded

If you get a 429 Too Many Requests error:
1. Check `X-RateLimit-Remaining` header
2. Use `Retry-After` header to know when to retry
3. Consider upgrading your plan for higher limits

### Query Errors

If queries fail:
1. Ensure queries are read-only (SELECT only)
2. Check that LIMIT values don't exceed 10,000
3. Verify query syntax is valid ClickHouse SQL

## License

MIT

## Support

For questions or issues, please contact support or open an issue in the repository.
