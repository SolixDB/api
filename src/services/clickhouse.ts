import { createClient, ClickHouseClient } from '@clickhouse/client';
import { config } from '../config';

export class ClickHouseService {
  private client: ClickHouseClient;

  constructor() {
    this.client = createClient({
      url: config.clickhouse.url,
      database: config.clickhouse.database,
      username: config.clickhouse.user,
      password: config.clickhouse.password,
    });
  }

  async query<T = any>(query: string, params?: Record<string, any>): Promise<T[]> {
    try {
      const result = await this.client.query({
        query,
        query_params: params || {},
        format: 'JSONEachRow',
      });

      const data = await result.json<T[]>();
      return data;
    } catch (error) {
      console.error('ClickHouse query error:', error);
      throw error;
    }
  }

  async queryOne<T = any>(query: string, params?: Record<string, any>): Promise<T | null> {
    const results = await this.query<T>(query, params);
    return results[0] || null;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export const clickhouseService = new ClickHouseService();

