# Error Handling

The API uses standard HTTP status codes and returns error messages in a consistent format.

## Error Response Format

All errors follow this structure:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "details": {}
}
```

## HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 400 | Bad Request | Invalid request parameters |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

## Error Types

### 400 Bad Request

Invalid request parameters or validation errors.

**Example:**

```json
{
  "error": "Validation error",
  "details": [
    {
      "path": ["date_from"],
      "message": "Invalid date format. Expected YYYY-MM-DD"
    }
  ]
}
```

**Common Causes:**
- Invalid date format
- Invalid parameter values
- Missing required parameters
- Parameter out of range

### 404 Not Found

Resource not found.

**Example:**

```json
{
  "error": "Not Found",
  "message": "Transaction not found"
}
```

**Common Causes:**
- Transaction signature doesn't exist
- Invalid endpoint
- Resource was deleted

### 429 Too Many Requests

Rate limit exceeded.

**Example:**

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 100 requests per 60 seconds."
}
```

**Solution:** Implement exponential backoff and respect rate limit headers.

### 500 Internal Server Error

Server error.

**Example:**

```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

**Solution:** Retry the request. If the error persists, contact support.

### 503 Service Unavailable

Service temporarily unavailable.

**Example:**

```json
{
  "error": "Service Unavailable",
  "message": "Service is temporarily unavailable. Please try again later."
}
```

**Solution:** Retry after a delay. Check service status.

## Error Handling Examples

### JavaScript/TypeScript

```typescript
async function handleRequest(url: string, options: RequestInit) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      
      switch (response.status) {
        case 400:
          console.error('Validation error:', error.details);
          break;
        case 404:
          console.error('Resource not found');
          break;
        case 429:
          const resetTime = response.headers.get('X-RateLimit-Reset');
          console.error('Rate limit exceeded. Reset at:', resetTime);
          break;
        case 500:
        case 503:
          console.error('Server error. Retrying...');
          // Implement retry logic
          break;
        default:
          console.error('Unexpected error:', error);
      }
      
      throw new Error(error.message);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
}
```

### Python

```python
import requests
from typing import Dict, Any

def handle_request(url: str, headers: Dict[str, str]) -> Any:
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        error = response.json()
        
        if response.status_code == 400:
            print('Validation error:', error.get('details'))
        elif response.status_code == 404:
            print('Resource not found')
        elif response.status_code == 429:
            reset_time = response.headers.get('X-RateLimit-Reset')
            print(f'Rate limit exceeded. Reset at: {reset_time}')
        elif response.status_code in [500, 503]:
            print('Server error. Retrying...')
            # Implement retry logic
        
        raise Exception(error.get('message', 'Request failed'))
    except requests.exceptions.RequestException as e:
        print(f'Request failed: {e}')
        raise
```

## Retry Logic

Implement retry logic for transient errors (500, 503, 429):

```typescript
async function retryRequest(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const resetTime = response.headers.get('X-RateLimit-Reset');
        const waitTime = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (response.status >= 500 && response.status < 600) {
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

