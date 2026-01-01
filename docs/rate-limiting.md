# Rate Limiting

The API implements rate limiting to ensure fair usage and maintain service quality.

## Rate Limits

- **Default Limit:** 100 requests per minute per API key
- **Window:** 60 seconds (1 minute)

## Rate Limit Headers

Every API response includes rate limit information in the headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-07-20T12:01:00Z
```

### Header Descriptions

- **X-RateLimit-Limit:** Maximum number of requests allowed in the window
- **X-RateLimit-Remaining:** Number of requests remaining in the current window
- **X-RateLimit-Reset:** ISO 8601 timestamp when the rate limit window resets

## Rate Limit Exceeded

When you exceed the rate limit, you'll receive a `429 Too Many Requests` response:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 100 requests per 60 seconds."
}
```

**Status Code:** `429 Too Many Requests`

## Handling Rate Limits

### Exponential Backoff

Implement exponential backoff when you receive a 429 response:

```javascript
async function makeRequest(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const resetTime = response.headers.get('X-RateLimit-Reset');
        const waitTime = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

### Respect Rate Limit Headers

Check the `X-RateLimit-Remaining` header and adjust your request rate:

```javascript
const response = await fetch(url, options);
const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));

if (remaining < 10) {
  // Slow down requests
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

### Caching

Cache responses to reduce API calls:

```javascript
const cache = new Map();

async function getCachedData(key, fetcher) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const data = await fetcher();
  cache.set(key, data);
  setTimeout(() => cache.delete(key), 60000); // 1 minute cache
  
  return data;
}
```

## Custom Rate Limits

Contact support if you need custom rate limits for your use case. Enterprise plans may include:

- Higher rate limits
- Burst capacity
- Custom windows
- Priority queuing

## Best Practices

1. **Monitor rate limit headers** in your application
2. **Implement caching** to reduce API calls
3. **Use batch requests** when possible
4. **Implement exponential backoff** for retries
5. **Respect rate limits** to avoid service disruption

