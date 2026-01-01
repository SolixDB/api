# GraphQL API Reference

The GraphQL API provides flexible querying with exactly the data you need.

## Endpoint

```
POST /graphql
```

## Authentication

Include your API key in the request header:

```
X-API-Key: your-api-key
```

## Schema

### Types

#### Transaction

```graphql
type Transaction {
  signature: String!
  slot: Int!
  blockTime: Int!
  programId: String!
  protocolName: String!
  instructionType: String!
  fee: Int!
  computeUnits: Int!
  accountsCount: Int!
  date: String!
  hour: Int!
}
```

#### ProtocolAnalytics

```graphql
type ProtocolAnalytics {
  protocolName: String!
  totalTransactions: Int!
  totalFees: Int!
  totalComputeUnits: Int!
  averageFee: Float!
  averageComputeUnits: Float!
  uniquePrograms: Int!
  dateFrom: String
  dateTo: String
}
```

#### TimeSeriesPoint

```graphql
type TimeSeriesPoint {
  timestamp: String!
  value: Int!
  label: String
}
```

#### FeeAnalytics

```graphql
type FeeAnalytics {
  minFee: Int!
  maxFee: Int!
  avgFee: Float!
  medianFee: Float!
  p95Fee: Float!
  p99Fee: Float!
  totalFees: Int!
}
```

#### Stats

```graphql
type Stats {
  totalTransactions: Int!
  totalFailedTransactions: Int!
  dateRange: DateRange!
  protocols: [ProtocolCount!]!
}

type DateRange {
  from: String!
  to: String!
}

type ProtocolCount {
  name: String!
  count: Int!
}
```

## Queries

### transactions

Query transactions with filters.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `protocolName` | String | No | Filter by protocol |
| `programId` | String | No | Filter by program ID |
| `dateFrom` | String | No | Start date (YYYY-MM-DD) |
| `dateTo` | String | No | End date (YYYY-MM-DD) |
| `signature` | String | No | Filter by signature |
| `limit` | Int | No | Number of results (default: 100) |
| `offset` | Int | No | Number to skip (default: 0) |

**Example:**

```graphql
query {
  transactions(
    protocolName: "jupiter_v6"
    dateFrom: "2025-07-20"
    limit: 10
  ) {
    signature
    protocolName
    fee
    computeUnits
    blockTime
  }
}
```

### transaction

Get a single transaction by signature.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `signature` | String | Yes | Transaction signature |

**Example:**

```graphql
query {
  transaction(signature: "5KJp...") {
    signature
    protocolName
    fee
    computeUnits
    blockTime
  }
}
```

### protocolAnalytics

Get analytics for a protocol.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `protocolName` | String | Yes | Protocol name |
| `dateFrom` | String | No | Start date |
| `dateTo` | String | No | End date |

**Example:**

```graphql
query {
  protocolAnalytics(
    protocolName: "jupiter_v6"
    dateFrom: "2025-07-20"
  ) {
    protocolName
    totalTransactions
    totalFees
    averageFee
    uniquePrograms
  }
}
```

### timeSeries

Get time series data.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `protocolName` | String | No | Filter by protocol |
| `dateFrom` | String | Yes | Start date |
| `dateTo` | String | Yes | End date |
| `granularity` | String | No | `hour` or `day` (default: `hour`) |

**Example:**

```graphql
query {
  timeSeries(
    protocolName: "jupiter_v6"
    dateFrom: "2025-07-20"
    dateTo: "2025-07-21"
    granularity: "hour"
  ) {
    timestamp
    value
  }
}
```

### feeAnalytics

Get fee analytics.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `protocolName` | String | No | Filter by protocol |
| `dateFrom` | String | No | Start date |
| `dateTo` | String | No | End date |

**Example:**

```graphql
query {
  feeAnalytics(protocolName: "jupiter_v6") {
    minFee
    maxFee
    avgFee
    medianFee
    p95Fee
    p99Fee
    totalFees
  }
}
```

### stats

Get global statistics.

**Example:**

```graphql
query {
  stats {
    totalTransactions
    totalFailedTransactions
    dateRange {
      from
      to
    }
    protocols {
      name
      count
    }
  }
}
```

## Example Requests

### Using curl

```bash
curl -X POST "https://api.solixdb.com/graphql" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "query": "{ transactions(protocolName: \"jupiter_v6\", limit: 5) { signature protocolName fee } }"
  }'
```

### Using JavaScript

```javascript
const query = `
  query {
    transactions(protocolName: "jupiter_v6", limit: 5) {
      signature
      protocolName
      fee
    }
  }
`;

const response = await fetch('https://api.solixdb.com/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({ query })
});

const data = await response.json();
console.log(data);
```

### Using Python

```python
import requests

query = """
{
  transactions(protocolName: "jupiter_v6", limit: 5) {
    signature
    protocolName
    fee
  }
}
"""

response = requests.post(
    'https://api.solixdb.com/graphql',
    json={'query': query},
    headers={'X-API-Key': 'your-api-key'}
)

data = response.json()
print(data)
```

## GraphQL Playground

You can use any GraphQL client or IDE to explore the API:

- [GraphQL Playground](https://github.com/graphql/graphql-playground)
- [Apollo Studio](https://studio.apollographql.com/)
- [Insomnia](https://insomnia.rest/)
- [Postman](https://www.postman.com/)

