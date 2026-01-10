import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

class MetricsService {
  private register: Registry;

  // API metrics
  public apiRequestDuration: Histogram<string>;
  public apiRequestTotal: Counter<string>;

  // Cache metrics
  public cacheHitRate: Gauge<string>;
  public cacheMissesTotal: Counter<string>;
  public cacheInvalidationsTotal: Counter<string>;

  // ClickHouse metrics
  public clickhouseQueryDuration: Histogram<string>;
  public clickhousePoolSize: Gauge<string>;
  public activeConnections: Gauge<string>;

  // Redis metrics
  public redisOperationsTotal: Counter<string>;

  // Rate limiting metrics
  public rateLimitHitsTotal: Counter<string>;

  // Memory metrics
  public memoryHeapUsed: Gauge<string>;
  public memoryHeapTotal: Gauge<string>;

  // Disk metrics
  public diskSpaceAvailable: Gauge<string>;

  constructor() {
    this.register = new Registry();

    // Collect default Node.js metrics
    collectDefaultMetrics({ register: this.register });

    // API metrics
    this.apiRequestDuration = new Histogram({
      name: 'api_request_duration_seconds',
      help: 'Duration of API requests in seconds',
      labelNames: ['endpoint', 'method'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    this.apiRequestTotal = new Counter({
      name: 'api_request_total',
      help: 'Total number of API requests',
      labelNames: ['endpoint', 'method', 'status'],
      registers: [this.register],
    });

    // Cache metrics
    this.cacheHitRate = new Gauge({
      name: 'cache_hit_rate',
      help: 'Cache hit rate (0-1)',
      registers: [this.register],
    });

    this.cacheMissesTotal = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      registers: [this.register],
    });

    this.cacheInvalidationsTotal = new Counter({
      name: 'cache_invalidations_total',
      help: 'Total number of cache invalidations',
      registers: [this.register],
    });

    // ClickHouse metrics
    this.clickhouseQueryDuration = new Histogram({
      name: 'clickhouse_query_duration_seconds',
      help: 'Duration of ClickHouse queries in seconds',
      labelNames: ['query_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register],
    });

    this.clickhousePoolSize = new Gauge({
      name: 'clickhouse_pool_size',
      help: 'Current ClickHouse connection pool size',
      registers: [this.register],
    });

    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Number of active ClickHouse connections',
      registers: [this.register],
    });

    // Redis metrics
    this.redisOperationsTotal = new Counter({
      name: 'redis_operations_total',
      help: 'Total number of Redis operations',
      labelNames: ['operation'],
      registers: [this.register],
    });

    // Rate limiting metrics
    this.rateLimitHitsTotal = new Counter({
      name: 'rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['plan'],
      registers: [this.register],
    });

    // Memory metrics
    this.memoryHeapUsed = new Gauge({
      name: 'memory_heap_used_bytes',
      help: 'Heap memory used in bytes',
      registers: [this.register],
    });

    this.memoryHeapTotal = new Gauge({
      name: 'memory_heap_total_bytes',
      help: 'Total heap memory in bytes',
      registers: [this.register],
    });

    // Disk metrics
    this.diskSpaceAvailable = new Gauge({
      name: 'disk_space_available_bytes',
      help: 'Available disk space in bytes',
      labelNames: ['path'],
      registers: [this.register],
    });

    // Update memory metrics periodically
    this.startMemoryMetrics();
  }

  private startMemoryMetrics() {
    setInterval(() => {
      const usage = process.memoryUsage();
      this.memoryHeapUsed.set(usage.heapUsed);
      this.memoryHeapTotal.set(usage.heapTotal);
    }, 5000);
  }

  getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  getRegister(): Registry {
    return this.register;
  }
}

export const metrics = new MetricsService();

