# Authentication

The SolixDB API uses API key authentication for all requests.

## API Key Header

Include your API key in the request header:

```
X-API-Key: your-api-key-here
```

## Obtaining an API Key

Contact support to obtain an API key. API keys are unique identifiers that:
- Authenticate your requests
- Track your usage
- Enforce rate limits

## Using API Keys

### REST API

```bash
curl -X GET "https://api.solixdb.xyz/api/v1/transactions" \
  -H "X-API-Key: your-api-key"
```

### GraphQL

```bash
curl -X POST "https://api.solixdb.xyz/graphql" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"query": "{ stats { totalTransactions } }"}'
```

### JavaScript/TypeScript

```typescript
const response = await fetch('https://api.solixdb.xyz/api/v1/transactions', {
  headers: {
    'X-API-Key': 'your-api-key'
  }
});
```

### Python

```python
import requests

headers = {
    'X-API-Key': 'your-api-key'
}

response = requests.get(
    'https://api.solixdb.xyz/api/v1/transactions',
    headers=headers
)
```

## Error Responses

### Missing API Key

```json
{
  "error": "Unauthorized",
  "message": "API key is required"
}
```

**Status Code:** `401 Unauthorized`

### Invalid API Key

```json
{
  "error": "Forbidden",
  "message": "Invalid API key"
}
```

**Status Code:** `403 Forbidden`

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** to store API keys
3. **Rotate API keys** regularly
4. **Use different keys** for development and production
5. **Monitor API key usage** for suspicious activity

