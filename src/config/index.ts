import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  clickhouse: {
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    database: process.env.CLICKHOUSE_DATABASE || 'default',
    user: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    pool: {
      min: parseInt(process.env.CLICKHOUSE_POOL_MIN || '20', 10),
      max: parseInt(process.env.CLICKHOUSE_POOL_MAX || '200', 10),
      connectionTimeout: parseInt(process.env.CLICKHOUSE_CONNECTION_TIMEOUT || '5000', 10),
      idleTimeout: parseInt(process.env.CLICKHOUSE_IDLE_TIMEOUT || '60000', 10),
      queueMax: parseInt(process.env.CLICKHOUSE_QUEUE_MAX || '1000', 10),
    },
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
  },
  api: {
    enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
    rateLimitTiers: {
      free: parseInt(process.env.RATE_LIMIT_FREE || '100', 10),
      x402: parseInt(process.env.RATE_LIMIT_X402 || '500', 10),
      enterprise: parseInt(process.env.RATE_LIMIT_ENTERPRISE || '2000', 10),
    },
  },
  supabase: {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  cache: {
    hotQueryTTL: parseInt(process.env.CACHE_HOT_QUERY_TTL || '3600', 10),
    recentDataTTL: parseInt(process.env.CACHE_RECENT_DATA_TTL || '300', 10),
    historicalDataTTL: parseInt(process.env.CACHE_HISTORICAL_DATA_TTL || '86400', 10),
    aggregationTTL: parseInt(process.env.CACHE_AGGREGATION_TTL || '1800', 10),
    invalidationCheckInterval: parseInt(process.env.CACHE_INVALIDATION_CHECK_INTERVAL || '60000', 10),
  },
  memory: {
    maxHeapMB: parseInt(process.env.MAX_HEAP_MB || '16384', 10),
    rejectThresholdPercent: parseInt(process.env.MEMORY_REJECT_THRESHOLD_PERCENT || '80', 10),
  },
};

