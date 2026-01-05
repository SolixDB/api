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
      cost50: parseInt(process.env.RATE_LIMIT_COST_50 || '200', 10),
      cost100: parseInt(process.env.RATE_LIMIT_COST_100 || '100', 10),
      cost200: parseInt(process.env.RATE_LIMIT_COST_200 || '50', 10),
      cost500: parseInt(process.env.RATE_LIMIT_COST_500 || '20', 10),
      cost1000: parseInt(process.env.RATE_LIMIT_COST_1000 || '10', 10),
      export: parseInt(process.env.RATE_LIMIT_EXPORT || '5', 10),
    },
  },
  graphql: {
    maxComplexity: parseInt(process.env.GRAPHQL_MAX_COMPLEXITY || '1000', 10),
    maxDepth: parseInt(process.env.GRAPHQL_MAX_DEPTH || '5', 10),
  },
  cache: {
    hotQueryTTL: parseInt(process.env.CACHE_HOT_QUERY_TTL || '3600', 10),
    recentDataTTL: parseInt(process.env.CACHE_RECENT_DATA_TTL || '300', 10),
    historicalDataTTL: parseInt(process.env.CACHE_HISTORICAL_DATA_TTL || '86400', 10),
    aggregationTTL: parseInt(process.env.CACHE_AGGREGATION_TTL || '1800', 10),
    invalidationCheckInterval: parseInt(process.env.CACHE_INVALIDATION_CHECK_INTERVAL || '60000', 10),
  },
  export: {
    dir: process.env.EXPORT_DIR || '/var/solixdb/exports',
    expirationHours: parseInt(process.env.EXPORT_EXPIRATION_HOURS || '24', 10),
    maxFileSizeGB: parseInt(process.env.EXPORT_MAX_FILE_SIZE_GB || '5', 10),
    minFreeSpaceGB: parseInt(process.env.EXPORT_MIN_FREE_SPACE_GB || '20', 10),
    maxTotalSizeGB: parseInt(process.env.EXPORT_MAX_TOTAL_SIZE_GB || '100', 10),
    jwtSecret: process.env.JWT_SECRET || process.env.SECRET || 'change-me-in-production',
  },
  memory: {
    maxHeapMB: parseInt(process.env.MAX_HEAP_MB || '16384', 10),
    rejectThresholdPercent: parseInt(process.env.MEMORY_REJECT_THRESHOLD_PERCENT || '80', 10),
  },
};

