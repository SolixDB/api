import { redisService } from './redis';
import { clickhouseService } from './clickhouse';
import { config } from '../config';
import { logger } from './logger';
import { metrics } from './metrics';

export class CacheManager {
  private maxBlockTime: number | null = null;
  private invalidationInterval: NodeJS.Timeout | null = null;
  private queryHitCounts: Map<string, number> = new Map();

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
   * Get cache value
   */
  async get<T>(cacheKey: string): Promise<T | null> {
    try {
      metrics.redisOperationsTotal.inc({ operation: 'get' });
      const value = await redisService.get<T>(cacheKey);
      if (value) {
        return value;
      }
      metrics.cacheMissesTotal.inc();
      return null;
    } catch (error) {
      logger.error('Cache get error', error as Error, { cacheKey });
      metrics.cacheMissesTotal.inc();
      return null;
    }
  }

  /**
   * Set cache value with appropriate TTL
   */
  async set(
    cacheKey: string,
    value: any,
    ttl: number,
    isAggregation: boolean = false,
    dateRange?: { start?: string; end?: string }
  ): Promise<void> {
    try {
      const finalTTL = ttl || this.getCacheTTL(cacheKey, isAggregation, dateRange);
      metrics.redisOperationsTotal.inc({ operation: 'set' });
      await redisService.set(cacheKey, value, finalTTL);
    } catch (error) {
      logger.error('Cache set error', error as Error, { cacheKey });
    }
  }

  /**
   * Delete cache key
   */
  async del(cacheKey: string): Promise<void> {
    try {
      metrics.redisOperationsTotal.inc({ operation: 'del' });
      await redisService.del(cacheKey);
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
  }
}

export const cacheManager = new CacheManager();

