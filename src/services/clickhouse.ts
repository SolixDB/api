import { createClient, ClickHouseClient } from '@clickhouse/client';
import { config } from '../config';
import { logger } from './logger';
import { metrics } from './metrics';
import { QuerySecurity } from './querySecurity';

export class ClickHouseService {
  private clients: ClickHouseClient[] = [];
  private currentIndex = 0;
  private poolSize = 0;

  constructor() {
    // Initialize connection pool
    this.initializePool();
  }

  private initializePool() {
    const poolMin = config.clickhouse.pool.min;

    // Create minimum number of connections
    for (let i = 0; i < poolMin; i++) {
      this.clients.push(this.createClient());
    }
    this.poolSize = poolMin;

    // Update metrics
    metrics.clickhousePoolSize.set(this.poolSize);
    metrics.activeConnections.set(this.poolSize);
  }

  private createClient(): ClickHouseClient {
    return createClient({
      host: config.clickhouse.url,
      database: config.clickhouse.database,
      username: config.clickhouse.user,
      password: config.clickhouse.password,
      request_timeout: config.clickhouse.pool.connectionTimeout,
      compression: {
        response: true,
        request: false,
      },
    });
  }

  private getClient(): ClickHouseClient {
    // Simple round-robin for now
    // In production, you might want to track which clients are busy
    const client = this.clients[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.clients.length;
    return client;
  }

  private async acquireClient(): Promise<ClickHouseClient> {
    // If pool is not at max, create a new connection if needed
    if (this.poolSize < config.clickhouse.pool.max) {
      const newClient = this.createClient();
      this.clients.push(newClient);
      this.poolSize++;
      metrics.clickhousePoolSize.set(this.poolSize);
      metrics.activeConnections.set(this.poolSize);
      return newClient;
    }

    // Otherwise, use round-robin
    return this.getClient();
  }

  async query<T = any>(
    query: string,
    params?: Record<string, any>,
    timeout?: number,
    complexity?: number
  ): Promise<T[]> {
    // SECURITY: Validate query is read-only
    const validation = QuerySecurity.validateReadOnly(query);
    if (!validation.valid) {
      logger.error('Blocked potentially dangerous query', new Error(validation.error || 'Invalid query'), {
        query: query.substring(0, 500),
      });
      throw new Error(validation.error || 'Query validation failed');
    }

    // SECURITY: Validate query parameters for SQL injection attempts
    if (params) {
      const paramValidation = QuerySecurity.validateQueryParams(params);
      if (!paramValidation.valid) {
        logger.error('Blocked query with dangerous parameters', new Error(paramValidation.error || 'Invalid parameters'), {
          query: query.substring(0, 500),
        });
        throw new Error(paramValidation.error || 'Parameter validation failed');
      }
    }

    const startTime = Date.now();
    const client = await this.acquireClient();

    // Determine timeout based on complexity if not provided
    let queryTimeout = timeout;
    if (!queryTimeout && complexity !== undefined) {
      if (complexity < 100) {
        queryTimeout = 10;
      } else if (complexity < 500) {
        queryTimeout = 30;
      } else if (complexity < 1000) {
        queryTimeout = 90;
      } else {
        queryTimeout = 90;
      }
    } else if (!queryTimeout) {
      queryTimeout = 30; // Default
    }

    try {
      const result = await client.query({
        query,
        query_params: params || {},
        format: 'JSONEachRow',
        clickhouse_settings: {
          max_execution_time: queryTimeout.toString(),
        } as any,
      });

      const data = await result.json<T[]>();
      const executionTime = Date.now() - startTime;

      // Update metrics
      metrics.clickhouseQueryDuration.observe({ query_type: 'select' }, executionTime / 1000);

      return data;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('ClickHouse query error', error as Error, {
        query: query.substring(0, 500),
        executionTime,
      });
      throw error;
    }
  }

  async queryOne<T = any>(query: string, params?: Record<string, any>, timeout?: number, complexity?: number): Promise<T | null> {
    const results = await this.query<T>(query, params, timeout, complexity);
    return results[0] || null;
  }

  async queryStream(
    query: string,
    params?: Record<string, any>,
    timeout?: number
  ): Promise<NodeJS.ReadableStream> {
    // SECURITY: Validate query is read-only
    const validation = QuerySecurity.validateReadOnly(query);
    if (!validation.valid) {
      logger.error('Blocked potentially dangerous stream query', new Error(validation.error || 'Invalid query'), {
        query: query.substring(0, 500),
      });
      throw new Error(validation.error || 'Query validation failed');
    }

    // SECURITY: Validate query parameters
    if (params) {
      const paramValidation = QuerySecurity.validateQueryParams(params);
      if (!paramValidation.valid) {
        logger.error('Blocked stream query with dangerous parameters', new Error(paramValidation.error || 'Invalid parameters'), {
          query: query.substring(0, 500),
        });
        throw new Error(paramValidation.error || 'Parameter validation failed');
      }
    }

    const client = await this.acquireClient();
    const queryTimeout = timeout || 300; // 5 minutes for streaming queries

    try {
      const result = await client.query({
        query,
        query_params: params || {},
        format: 'JSONEachRow',
        clickhouse_settings: {
          max_execution_time: queryTimeout.toString(),
        } as any,
      });

      return result.stream() as NodeJS.ReadableStream;
    } catch (error) {
      logger.error('ClickHouse stream query error', error as Error, {
        query: query.substring(0, 500),
      });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1', {}, 5);
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await Promise.all(this.clients.map((client) => client.close()));
    this.clients = [];
    this.poolSize = 0;
    metrics.clickhousePoolSize.set(0);
    metrics.activeConnections.set(0);
  }

  getPoolSize(): number {
    return this.poolSize;
  }
}

export const clickhouseService = new ClickHouseService();

