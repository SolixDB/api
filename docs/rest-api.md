# REST API Reference

The REST API provides standardized endpoints for querying Solana transaction data.

## Base URL

```
https://api.solixdb.xyz/api/v1
```

## Endpoints

### Get Transactions

Retrieve a list of transactions with optional filters.

**Endpoint:** `GET /transactions`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol_name` | string | No | Filter by protocol (jupiter_v4, jupiter_v6, raydium_amm_v3, etc.) |
| `program_id` | string | No | Filter by Solana program ID |
| `date_from` | string | No | Start date (YYYY-MM-DD) |
| `date_to` | string | No | End date (YYYY-MM-DD) |
| `signature` | string | No | Filter by transaction signature |
| `limit` | integer | No | Number of results (1-1000, default: 100) |
| `offset` | integer | No | Number of results to skip (default: 0) |

**Example Request:**

```bash
curl -X GET "https://api.solixdb.xyz/api/v1/transactions?protocol_name=jupiter_v6&date_from=2025-07-20&limit=100" \
```

**Example Response:**

```json
{
  "data": [
    {
      "signature": "5KJp...",
      "slot": 123456789,
      "blockTime": 1721491200,
      "programId": "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      "protocolName": "jupiter_v6",
      "instructionType": "swap",
      "fee": 5000,
      "computeUnits": 200000,
      "accountsCount": 10,
      "date": "2025-07-20",
      "hour": 12
    }
  ],
  "count": 100,
  "limit": 100,
  "offset": 0
}
```

### Get Transaction by Signature

Retrieve a specific transaction by its signature.

**Endpoint:** `GET /transactions/:signature`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `signature` | string | Yes | Transaction signature |

**Example Request:**

```bash
curl -X GET "https://api.solixdb.xyz/api/v1/transactions/5KJp..." \
```

**Example Response:**

```json
{
  "data": {
    "signature": "5KJp...",
    "slot": 123456789,
    "blockTime": 1721491200,
    "programId": "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    "protocolName": "jupiter_v6",
    "instructionType": "swap",
    "fee": 5000,
    "computeUnits": 200000,
    "accountsCount": 10,
    "date": "2025-07-20",
    "hour": 12
  }
}
```

### Get Protocol Analytics

Get aggregated analytics for a specific protocol.

**Endpoint:** `GET /analytics/protocols`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol_name` | string | Yes | Protocol name |
| `date_from` | string | No | Start date (YYYY-MM-DD) |
| `date_to` | string | No | End date (YYYY-MM-DD) |

**Example Request:**

```bash
curl -X GET "https://api.solixdb.xyz/api/v1/analytics/protocols?protocol_name=jupiter_v6&date_from=2025-07-20" \
```

**Example Response:**

```json
{
  "data": {
    "protocolName": "jupiter_v6",
    "totalTransactions": 1500000,
    "totalFees": 7500000000,
    "totalComputeUnits": 300000000000,
    "averageFee": 5000,
    "averageComputeUnits": 200000,
    "uniquePrograms": 5,
    "dateFrom": "2025-07-20",
    "dateTo": null
  }
}
```

### Get Time Series Data

Get time series data for transactions.

**Endpoint:** `GET /analytics/time-series`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol_name` | string | No | Filter by protocol |
| `date_from` | string | Yes | Start date (YYYY-MM-DD) |
| `date_to` | string | Yes | End date (YYYY-MM-DD) |
| `granularity` | string | No | Time granularity: `hour` or `day` (default: `hour`) |

**Example Request:**

```bash
curl -X GET "https://api.solixdb.xyz/api/v1/analytics/time-series?protocol_name=jupiter_v6&date_from=2025-07-20&date_to=2025-07-21&granularity=hour" \
```

**Example Response:**

```json
{
  "data": [
    {
      "timestamp": "2025-07-20T00:00:00Z",
      "value": 50000
    },
    {
      "timestamp": "2025-07-20T01:00:00Z",
      "value": 52000
    }
  ]
}
```

### Get Fee Analytics

Get fee statistics and analytics.

**Endpoint:** `GET /analytics/fees`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `protocol_name` | string | No | Filter by protocol |
| `date_from` | string | No | Start date (YYYY-MM-DD) |
| `date_to` | string | No | End date (YYYY-MM-DD) |

**Example Request:**

```bash
curl -X GET "https://api.solixdb.xyz/api/v1/analytics/fees?protocol_name=jupiter_v6" \
```

**Example Response:**

```json
{
  "data": {
    "minFee": 1000,
    "maxFee": 10000,
    "avgFee": 5000,
    "medianFee": 4800,
    "p95Fee": 8500,
    "p99Fee": 9500,
    "totalFees": 7500000000
  }
}
```

### Get Global Stats

Get global statistics about the database.

**Endpoint:** `GET /stats`

**Example Request:**

```bash
curl -X GET "https://api.solixdb.xyz/api/v1/stats" \
```

**Example Response:**

```json
{
  "data": {
    "totalTransactions": 389000000,
    "totalFailedTransactions": 14000000,
    "dateRange": {
      "from": "2025-07-03",
      "to": "2025-08-02"
    },
    "protocols": [
      {
        "name": "jupiter_v6",
        "count": 150000000
      },
      {
        "name": "jupiter_v4",
        "count": 100000000
      }
    ]
  }
}
```

### Execute SQL Query

Execute read-only SQL queries directly against the ClickHouse database. This endpoint allows you to write custom SELECT queries for maximum flexibility.

**Endpoint:** `POST /query`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | SQL SELECT query (must include LIMIT) |
| `format` | string | No | Response format: `json` or `csv` (default: `json`) |

**Safety Restrictions:**

- Only SELECT queries are allowed (no DROP, DELETE, UPDATE, INSERT, etc.)
- Query must include a LIMIT clause
- Maximum LIMIT value: 10,000 rows
- Maximum query length: 100,000 characters
- Query timeout: 30 seconds
- Only single statements allowed (no semicolons)

**Example Request (JSON):**

```bash
curl -X POST "https://api.solixdb.xyz/api/v1/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT signature, protocol_name, fee, compute_units FROM transactions WHERE protocol_name = '\''jupiter_v6'\'' AND date >= '\''2025-07-20'\'' LIMIT 100"
  }'
```

**Example Request (CSV):**

```bash
curl -X POST "https://api.solixdb.xyz/api/v1/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT protocol_name, count() as total FROM transactions GROUP BY protocol_name ORDER BY total DESC LIMIT 10",
    "format": "csv"
  }'
```

**Example Response (JSON):**

```json
{
  "data": [
    {
      "signature": "5KJp...",
      "protocol_name": "jupiter_v6",
      "fee": 5000,
      "compute_units": 200000
    }
  ],
  "count": 100,
  "query": "SELECT signature, protocol_name, fee, compute_units FROM transactions WHERE protocol_name = 'jupiter_v6' AND date >= '2025-07-20' LIMIT 100"
}
```

**Example Response (CSV):**

```
protocol_name,total
jupiter_v6,150000000
jupiter_v4,100000000
raydium_amm_v3,50000000
```

**Error Responses:**

```json
{
  "error": "Invalid query",
  "message": "Query must include a LIMIT clause. Maximum allowed: LIMIT 10000"
}
```

```json
{
  "error": "Invalid query",
  "message": "Destructive operation 'DROP' is not allowed. Only read-only queries are permitted."
}
```

## Response Format

All successful responses follow this format:

```json
{
  "data": { ... },
  "count": 100,
  "limit": 100,
  "offset": 0
}
```

## Error Responses

See [Error Handling](./error-handling.md) for details on error responses.

