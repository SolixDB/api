import { redisService } from './redis';
import { clickhouseService } from './clickhouse';
import { config } from '../config';
import { logger } from './logger';
import { metrics } from './metrics';

// Simple LRU cache for in-memory hot queries (<1ms access)
interface LRUEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

export class CacheManager {
  private maxBlockTime: number | null = null;
  private invalidationInterval: NodeJS.Timeout | null = null;
  private queryHitCounts: Map<string, number> = new Map();
  // In-memory LRU cache for ultra-fast hot queries
  private memoryCache: Map<string, LRUEntry<any>> = new Map();
  private readonly MAX_MEMORY_CACHE_SIZE = 5000; // Increased to 5000 entries for better hit rate
  private readonly MEMORY_CACHE_TTL = 300000; // 5 minutes TTL for memory cache (longer for better hit rate)

  constructor() {
    this.initializeMaxBlockTime();
    this.startInvalidationCheck();
  }

  /**
   * Initialize max block_time on startup
   */
  private async initializeMaxBlockTime() {
    try {
      const result = await clickhouseService.queryOne<{ max: number }>(
        'SELECT max(block_time) as max FROM transactions',
        {},
        5
      );
      if (result?.max) {
        this.maxBlockTime = result.max;
        logger.info('Initialized max block_time', { maxBlockTime: this.maxBlockTime });
      }
    } catch (error) {
      logger.error('Failed to initialize max block_time', error as Error);
    }
  }

  /**
   * Start checking for new data every 60s
   */
  private startInvalidationCheck() {
    this.invalidationInterval = setInterval(async () => {
      await this.checkForNewData();
    }, config.cache.invalidationCheckInterval);
  }

  /**
   * Check for new blockchain data and invalidate stale cache
   */
  private async checkForNewData() {
    try {
      const result = await clickhouseService.queryOne<{ max: number }>(
        'SELECT max(block_time) as max FROM transactions',
        {},
        5
      );

      if (result?.max && this.maxBlockTime !== null && result.max > this.maxBlockTime) {
        const oldMax = this.maxBlockTime;
        this.maxBlockTime = result.max;

        // Calculate cutoff time (1 hour before new max)
        const cutoffTime = result.max - 3600; // 1 hour in seconds

        logger.info('New blockchain data detected, invalidating cache', {
          oldMaxBlockTime: oldMax,
          newMaxBlockTime: result.max,
          cutoffTime,
        });

        // Invalidate cache keys for recent data
        await this.invalidateRecentCache(cutoffTime);

        metrics.cacheInvalidationsTotal.inc();
      }
    } catch (error) {
      logger.error('Error checking for new data', error as Error);
    }
  }

  /**
   * Invalidate cache keys matching date >= cutoffTime
   */
  private async invalidateRecentCache(_cutoffTime: number) {
    try {
      // Get all cache keys (this is a simplified approach)
      // In production, you might want to maintain a set of cache keys
      // For now, we'll use a pattern-based approach
      const redisClient = redisService.getClient();
      const keys = await redisClient.keys('cache:*');

      let invalidatedCount = 0;
      for (const key of keys) {
        // Check if key contains date information
        // This is a simplified check - in production, you'd want more sophisticated key structure
        const keyStr = key.toString();
        if (keyStr.includes('date') || keyStr.includes('recent')) {
          await redisService.del(keyStr);
          invalidatedCount++;
        }
      }

      logger.info('Cache invalidation completed', { invalidatedCount });
    } catch (error) {
      logger.error('Error invalidating cache', error as Error);
    }
  }

  /**
   * Generate cache key from query signature and parameters
   */
  generateCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${JSON.stringify(params[key])}`)
      .join('|');
    const hash = this.simpleHash(sortedParams);
    return `cache:${prefix}:${hash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Determine cache TTL based on query patterns and data freshness
   */
  getCacheTTL(
    cacheKey: string,
    isAggregation: boolean,
    dateRange?: { start?: string; end?: string }
  ): number {
    // Track query hits
    const hitCount = this.queryHitCounts.get(cacheKey) || 0;
    this.queryHitCounts.set(cacheKey, hitCount + 1);

    // Hot queries (>5 hits): 1 hour cache
    if (hitCount > 5) {
      return config.cache.hotQueryTTL;
    }

    // Aggregations: 30 min cache
    if (isAggregation) {
      return config.cache.aggregationTTL;
    }

    // Check if query includes recent data
    if (dateRange?.end) {
      const endDate = new Date(dateRange.end);
      const now = new Date();
      const daysDiff = (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24);

      // Recent data (<24h): 5 min cache
      if (daysDiff < 1) {
        return config.cache.recentDataTTL;
      }
    }

    // Historical data: 24 hour cache
    return config.cache.historicalDataTTL;
  }

  /**
   * Get cache value - two-tier: memory cache first (<1ms), then Redis
   * SYNCHRONOUS for memory cache to avoid any async overhead
   */
  get<T>(cacheKey: string): T | null {
    // Tier 1: Check in-memory cache first (ultra-fast <1ms, synchronous)
    const memoryEntry = this.memoryCache.get(cacheKey);
    if (memoryEntry) {
      const age = Date.now() - memoryEntry.timestamp;
      if (age < this.MEMORY_CACHE_TTL) {
        // Update access count for LRU eviction
        memoryEntry.accessCount++;
        return memoryEntry.value as T;
      } else {
        // Expired, remove from memory
        this.memoryCache.delete(cacheKey);
      }
    }
    return null;
  }

  /**
   * Async get for Redis fallback (only called if memory cache misses)
   */
  async getAsync<T>(cacheKey: string): Promise<T | null> {
    // Check memory cache first (synchronous, instant)
    const memoryValue = this.get<T>(cacheKey);
    if (memoryValue !== null) {
      return memoryValue;
    }

    // Tier 2: Check Redis cache (only if memory miss)
    try {
      metrics.redisOperationsTotal.inc({ operation: 'get' });
      const client = redisService.getClient();
      const value = await client.get(cacheKey);
      if (!value) {
        metrics.cacheMissesTotal.inc();
        return null;
      }
      // Fast JSON parse
      const parsed = JSON.parse(value) as T;
      
      // Store in memory cache for next time (synchronous, instant)
      this.setMemoryCache(cacheKey, parsed);
      
      return parsed;
    } catch (error) {
      logger.error('Cache get error', error as Error, { cacheKey });
      metrics.cacheMissesTotal.inc();
      return null;
    }
  }

  /**
   * Set value in memory cache with LRU eviction
   */
  private setMemoryCache<T>(key: string, value: T): void {
    // Evict if cache is full (LRU: remove least recently used)
    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE_SIZE) {
      // Find least recently used entry (lowest accessCount, oldest timestamp)
      let lruKey: string | null = null;
      let lruScore = Infinity;
      
      for (const [k, entry] of this.memoryCache.entries()) {
        const score = entry.accessCount * 1000000 + (Date.now() - entry.timestamp);
        if (score < lruScore) {
          lruScore = score;
          lruKey = k;
        }
      }
      
      if (lruKey) {
        this.memoryCache.delete(lruKey);
      }
    }
    
    this.memoryCache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  /**
   * Set cache value with appropriate TTL
   * Two-tier: memory cache (immediate) + Redis (background)
   */
  async set(
    cacheKey: string,
    value: any,
    ttl: number,
    isAggregation: boolean = false,
    dateRange?: { start?: string; end?: string }
  ): Promise<void> {
    const finalTTL = ttl || this.getCacheTTL(cacheKey, isAggregation, dateRange);
    
    // Tier 1: Set in-memory cache immediately (<1ms)
    this.setMemoryCache(cacheKey, value);
    
    // Tier 2: Set in Redis (non-blocking, fire-and-forget)
    metrics.redisOperationsTotal.inc({ operation: 'set' });
    const client = redisService.getClient();
    const serialized = JSON.stringify(value);
    
    // Don't await - let Redis write happen in background
    client.setex(cacheKey, finalTTL, serialized).catch((error) => {
      logger.error('Background Redis cache set error', error as Error, { cacheKey });
    });
  }

  /**
   * Delete cache key from both memory and Redis
   */
  async del(cacheKey: string): Promise<void> {
    // Delete from memory cache immediately
    this.memoryCache.delete(cacheKey);
    
    // Delete from Redis (non-blocking)
    try {
      metrics.redisOperationsTotal.inc({ operation: 'del' });
      redisService.del(cacheKey).catch((error) => {
        logger.error('Background Redis cache del error', error as Error, { cacheKey });
      });
      this.queryHitCounts.delete(cacheKey);
    } catch (error) {
      logger.error('Cache del error', error as Error, { cacheKey });
    }
  }

  /**
   * Get cache control header value
   */
  getCacheControlHeader(ttl: number): string {
    return `max-age=${ttl}, public`;
  }

  /**
   * Cleanup on shutdown
   */
  cleanup() {
    if (this.invalidationInterval) {
      clearInterval(this.invalidationInterval);
    }
    this.memoryCache.clear();
  }

  /**
   * Get memory cache stats for monitoring
   */
  getMemoryCacheStats() {
    return {
      size: this.memoryCache.size,
      maxSize: this.MAX_MEMORY_CACHE_SIZE,
      hitRate: this.memoryCache.size > 0 ? 1 : 0, // Simplified
    };
  }
}

export const cacheManager = new CacheManager();

