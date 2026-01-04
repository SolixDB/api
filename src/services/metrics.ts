import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

class MetricsService {
  private register: Registry;

  // GraphQL metrics
  public graphqlQueryDuration: Histogram<string>;
  public graphqlQueryTotal: Counter<string>;
  public graphqlQueryComplexity: Histogram<string>;
  public graphqlQueryEstimatedRows: Histogram<string>;

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

  // Export metrics
  public exportJobsTotal: Counter<string>;
  public exportJobDuration: Histogram<string>;
  public exportFileSize: Histogram<string>;

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

    // GraphQL metrics
    this.graphqlQueryDuration = new Histogram({
      name: 'graphql_query_duration_seconds',
      help: 'Duration of GraphQL queries in seconds',
      labelNames: ['query', 'complexity_tier'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    this.graphqlQueryTotal = new Counter({
      name: 'graphql_query_total',
      help: 'Total number of GraphQL queries',
      labelNames: ['query', 'status'],
      registers: [this.register],
    });

    this.graphqlQueryComplexity = new Histogram({
      name: 'graphql_query_complexity_score',
      help: 'Complexity score of GraphQL queries',
      labelNames: ['query'],
      buckets: [10, 50, 100, 200, 500, 1000],
      registers: [this.register],
    });

    this.graphqlQueryEstimatedRows = new Histogram({
      name: 'graphql_query_estimated_rows',
      help: 'Estimated row count for GraphQL queries',
      labelNames: ['query'],
      buckets: [100, 1000, 10000, 100000, 1000000, 5000000],
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

    // Export metrics
    this.exportJobsTotal = new Counter({
      name: 'export_jobs_total',
      help: 'Total number of export jobs',
      labelNames: ['status'],
      registers: [this.register],
    });

    this.exportJobDuration = new Histogram({
      name: 'export_job_duration_seconds',
      help: 'Duration of export jobs in seconds',
      labelNames: ['format'],
      buckets: [10, 30, 60, 300, 600, 1800, 3600],
      registers: [this.register],
    });

    this.exportFileSize = new Histogram({
      name: 'export_file_size_bytes',
      help: 'Size of exported files in bytes',
      labelNames: ['format'],
      buckets: [1024 * 1024, 10 * 1024 * 1024, 100 * 1024 * 1024, 1024 * 1024 * 1024, 5 * 1024 * 1024 * 1024],
      registers: [this.register],
    });

    // Rate limiting metrics
    this.rateLimitHitsTotal = new Counter({
      name: 'rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['tier'],
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

