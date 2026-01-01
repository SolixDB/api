# Getting Started

This guide will help you get started with the SolixDB API.

## Prerequisites

- HTTP client (curl, Postman, or your preferred tool)
- Basic understanding of REST APIs and/or GraphQL

## Installation

```bash
# Clone the repository
git clone <repository-url>
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

# Or run in development mode
npm run dev
```

## Environment Variables

Create a `.env` file with the following variables:

```env
PORT=3000
NODE_ENV=production

# ClickHouse Configuration
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DATABASE=default
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TTL=3600

# API Configuration
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## Making Your First Request

### REST API Example

```bash
curl -X GET "https://api.solixdb.xyz/api/v1/transactions?protocol_name=jupiter_v6&limit=10"
```

### GraphQL Example

```bash
curl -X POST "https://api.solixdb.xyz/graphql" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ transactions(protocolName: \"jupiter_v6\", limit: 10) { signature protocolName fee } }"
  }'
```

### SQL Query Example

Execute custom SQL queries directly against the database:

```bash
curl -X POST "https://api.solixdb.xyz/api/v1/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT signature, protocol_name, fee FROM transactions WHERE protocol_name = '\''jupiter_v6'\'' LIMIT 10"
  }'
```

**Note:** SQL queries must include a LIMIT clause and are read-only (SELECT only).

## Next Steps

- Explore the [REST API Reference](./rest-api.md)
- Check out [GraphQL API Reference](./graphql-api.md)
- See [Examples](./examples.md) for common use cases

