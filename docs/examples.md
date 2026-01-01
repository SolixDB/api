# Examples

This page contains practical examples for common use cases.

## REST API Examples

### Get Recent Jupiter V6 Transactions

```bash
curl -X GET "https://api.solixdb.xyz/api/v1/transactions?protocol_name=jupiter_v6&limit=10"
```

### Get Transactions for a Date Range

```bash
curl -X GET "https://api.solixdb.xyz/api/v1/transactions?date_from=2025-07-20&date_to=2025-07-21&limit=100" \
```

### Get Protocol Analytics

```bash
curl -X GET "https://api.solixdb.xyz/api/v1/analytics/protocols?protocol_name=jupiter_v6&date_from=2025-07-20" \
```

### Get Time Series Data

```bash
curl -X GET "https://api.solixdb.xyz/api/v1/analytics/time-series?protocol_name=jupiter_v6&date_from=2025-07-20&date_to=2025-07-21&granularity=hour" \
```

## SQL Query Examples

### Basic SELECT Query

```bash
curl -X POST "https://api.solixdb.xyz/api/v1/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT signature, protocol_name, fee FROM transactions WHERE protocol_name = '\''jupiter_v6'\'' LIMIT 10"
  }'
```

### Aggregation Query

```bash
curl -X POST "https://api.solixdb.xyz/api/v1/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT protocol_name, count() as total, avg(fee) as avg_fee FROM transactions WHERE date >= '\''2025-07-20'\'' GROUP BY protocol_name ORDER BY total DESC LIMIT 10"
  }'
```

### Time Series Query

```bash
curl -X POST "https://api.solixdb.xyz/api/v1/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT toStartOfHour(toDateTime(block_time)) as hour, count() as transactions FROM transactions WHERE date >= '\''2025-07-20'\'' AND date <= '\''2025-07-21'\'' GROUP BY hour ORDER BY hour LIMIT 100"
  }'
```

### Export as CSV

```bash
curl -X POST "https://api.solixdb.xyz/api/v1/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT signature, protocol_name, fee, compute_units FROM transactions WHERE protocol_name = '\''jupiter_v6'\'' LIMIT 1000",
    "format": "csv"
  }' > transactions.csv
```

### Complex Query with JOIN

```bash
curl -X POST "https://api.solixdb.xyz/api/v1/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT t.protocol_name, count() as total, sum(t.fee) as total_fees FROM transactions t WHERE t.date >= '\''2025-07-20'\'' GROUP BY t.protocol_name HAVING total > 1000 ORDER BY total DESC LIMIT 20"
  }'
```

## GraphQL Examples

### Query Transactions

```graphql
query GetTransactions {
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

### Query Protocol Analytics

```graphql
query GetProtocolAnalytics {
  protocolAnalytics(
    protocolName: "jupiter_v6"
    dateFrom: "2025-07-20"
  ) {
    protocolName
    totalTransactions
    totalFees
    averageFee
    averageComputeUnits
    uniquePrograms
  }
}
```

### Query Time Series

```graphql
query GetTimeSeries {
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

### Complex Query with Multiple Fields

```graphql
query GetAnalytics {
  protocolAnalytics(protocolName: "jupiter_v6") {
    protocolName
    totalTransactions
    totalFees
    averageFee
  }
  
  feeAnalytics(protocolName: "jupiter_v6") {
    minFee
    maxFee
    avgFee
    medianFee
    p95Fee
    p99Fee
  }
  
  stats {
    totalTransactions
    dateRange {
      from
      to
    }
  }
}
```

## JavaScript/TypeScript Examples

### Using Fetch API

```typescript
const API_KEY = 'your-api-key';
const BASE_URL = 'https://api.solixdb.xyz/api/v1';

async function getTransactions(protocolName: string, limit = 100) {
  const url = `${BASE_URL}/transactions?protocol_name=${protocolName}&limit=${limit}`;
  
  const response = await fetch(url, {
    headers: {
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// Usage
const data = await getTransactions('jupiter_v6', 10);
console.log(data);
```

### Using Axios

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.solixdb.xyz/api/v1',
  headers: {
  }
});

async function getProtocolAnalytics(protocolName: string) {
  const response = await api.get('/analytics/protocols', {
    params: {
      protocol_name: protocolName
    }
  });
  
  return response.data;
}

// Usage
const analytics = await getProtocolAnalytics('jupiter_v6');
console.log(analytics);
```

### GraphQL Client

```typescript
async function graphqlQuery(query: string, variables?: Record<string, any>) {
  const response = await fetch('https://api.solixdb.xyz/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables })
  });
  
  const result = await response.json();
  
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  
  return result.data;
}

// Usage
const query = `
  query {
    transactions(protocolName: "jupiter_v6", limit: 10) {
      signature
      protocolName
      fee
    }
  }
`;

const data = await graphqlQuery(query);
console.log(data);
```

## Python Examples

### Using requests

```python
import requests

API_KEY = 'your-api-key'
BASE_URL = 'https://api.solixdb.xyz/api/v1'

def get_transactions(protocol_name, limit=100):
    url = f'{BASE_URL}/transactions'
    headers = {}
    params = {
        'protocol_name': protocol_name,
        'limit': limit
    }
    
    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()
    
    return response.json()

# Usage
data = get_transactions('jupiter_v6', 10)
print(data)
```

### GraphQL with requests

```python
import requests

def graphql_query(query, variables=None):
    url = 'https://api.solixdb.xyz/graphql'
    headers = {
        'Content-Type': 'application/json',
    }
    
    payload = {'query': query}
    if variables:
        payload['variables'] = variables
    
    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    
    result = response.json()
    
    if 'errors' in result:
        raise Exception(result['errors'][0]['message'])
    
    return result['data']

# Usage
query = """
{
  transactions(protocolName: "jupiter_v6", limit: 10) {
    signature
    protocolName
    fee
  }
}
"""

data = graphql_query(query)
print(data)
```

## Real-World Use Cases

### Monitor Protocol Activity

```typescript
async function monitorProtocol(protocolName: string) {
  const [analytics, timeSeries] = await Promise.all([
    getProtocolAnalytics(protocolName),
    getTimeSeries(protocolName, '2025-07-20', '2025-07-21', 'hour')
  ]);
  
  console.log(`Protocol: ${analytics.protocolName}`);
  console.log(`Total Transactions: ${analytics.totalTransactions}`);
  console.log(`Average Fee: ${analytics.averageFee}`);
  console.log(`Hourly Activity:`, timeSeries);
}

monitorProtocol('jupiter_v6');
```

### Compare Protocols

```typescript
async function compareProtocols(protocols: string[]) {
  const comparisons = await Promise.all(
    protocols.map(name => getProtocolAnalytics(name))
  );
  
  return comparisons.map(analytics => ({
    name: analytics.protocolName,
    transactions: analytics.totalTransactions,
    avgFee: analytics.averageFee,
    efficiency: analytics.averageComputeUnits
  }));
}

const comparison = await compareProtocols(['jupiter_v6', 'jupiter_v4', 'raydium_amm_v3']);
console.table(comparison);
```

### Track Fee Trends

```typescript
async function trackFeeTrends(protocolName: string, days: number) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const timeSeries = await getTimeSeries(
    protocolName,
    formatDate(startDate),
    formatDate(endDate),
    'day'
  );
  
  const feeAnalytics = await getFeeAnalytics(protocolName);
  
  return {
    trends: timeSeries,
    statistics: feeAnalytics
  };
}

const trends = await trackFeeTrends('jupiter_v6', 7);
console.log(trends);
```

