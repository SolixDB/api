import { clickhouseService } from './clickhouse';
import { redisService } from './redis';
import { config } from '../config';
import { Transaction, ProtocolAnalytics, TimeSeriesPoint, Stats } from '../types';

export class TransactionsService {
  private getCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  }

  async getTransactions(params: {
    protocolName?: string;
    programId?: string;
    dateFrom?: string;
    dateTo?: string;
    signature?: string;
    limit?: number;
    offset?: number;
  }): Promise<Transaction[]> {
    const {
      protocolName,
      programId,
      dateFrom,
      dateTo,
      signature,
      limit = 100,
      offset = 0,
    } = params;

    const cacheKey = this.getCacheKey('transactions', params);
    const cached = await redisService.get<Transaction[]>(cacheKey);
    if (cached) return cached;

    const conditions: string[] = [];
    const queryParams: Record<string, any> = { limit, offset };

    if (protocolName) {
      conditions.push('protocol_name = {protocolName:String}');
      queryParams.protocolName = protocolName;
    }

    if (programId) {
      conditions.push('program_id = {programId:String}');
      queryParams.programId = programId;
    }

    if (dateFrom) {
      conditions.push('date >= {dateFrom:String}');
      queryParams.dateFrom = dateFrom;
    }

    if (dateTo) {
      conditions.push('date <= {dateTo:String}');
      queryParams.dateTo = dateTo;
    }

    if (signature) {
      conditions.push('signature = {signature:String}');
      queryParams.signature = signature;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        signature,
        slot,
        block_time as blockTime,
        program_id as programId,
        protocol_name as protocolName,
        instruction_type as instructionType,
        fee,
        compute_units as computeUnits,
        accounts_count as accountsCount,
        date,
        hour
      FROM transactions
      ${whereClause}
      ORDER BY date DESC, slot DESC, signature DESC
      LIMIT {limit:UInt64}
      OFFSET {offset:UInt64}
    `;

    const results = await clickhouseService.query<Transaction>(query, queryParams);
    await redisService.set(cacheKey, results, config.redis.ttl);
    return results;
  }

  async getTransactionBySignature(signature: string): Promise<Transaction | null> {
    const cacheKey = `transaction:${signature}`;
    const cached = await redisService.get<Transaction>(cacheKey);
    if (cached) return cached;

    const results = await this.getTransactions({ signature, limit: 1 });
    const transaction = results[0] || null;

    if (transaction) {
      await redisService.set(cacheKey, transaction, config.redis.ttl);
    }

    return transaction;
  }

  async getProtocolAnalytics(params: {
    protocolName: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ProtocolAnalytics> {
    const { protocolName, dateFrom, dateTo } = params;
    const cacheKey = this.getCacheKey('analytics:protocol', params);
    const cached = await redisService.get<ProtocolAnalytics>(cacheKey);
    if (cached) return cached;

    const conditions: string[] = ['protocol_name = {protocolName:String}'];
    const queryParams: Record<string, any> = { protocolName };

    if (dateFrom) {
      conditions.push('date >= {dateFrom:String}');
      queryParams.dateFrom = dateFrom;
    }

    if (dateTo) {
      conditions.push('date <= {dateTo:String}');
      queryParams.dateTo = dateTo;
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT 
        protocol_name as protocolName,
        count() as totalTransactions,
        sum(fee) as totalFees,
        sum(compute_units) as totalComputeUnits,
        avg(fee) as averageFee,
        avg(compute_units) as averageComputeUnits,
        uniqExact(program_id) as uniquePrograms
      FROM transactions
      WHERE ${whereClause}
    `;

    const result = await clickhouseService.queryOne<ProtocolAnalytics>(query, queryParams);
    
    // If no data found, return default values
    if (!result) {
      const analytics: ProtocolAnalytics = {
        protocolName,
        totalTransactions: 0,
        totalFees: 0,
        totalComputeUnits: 0,
        averageFee: 0,
        averageComputeUnits: 0,
        uniquePrograms: 0,
        dateFrom,
        dateTo,
      };
      await redisService.set(cacheKey, analytics, config.redis.ttl);
      return analytics;
    }

    const analytics: ProtocolAnalytics = {
      ...result,
      dateFrom,
      dateTo,
    };

    await redisService.set(cacheKey, analytics, config.redis.ttl);
    return analytics;
  }

  async getTimeSeries(params: {
    protocolName?: string;
    dateFrom: string;
    dateTo: string;
    granularity: 'hour' | 'day';
  }): Promise<TimeSeriesPoint[]> {
    const { protocolName, dateFrom, dateTo, granularity } = params;
    const cacheKey = this.getCacheKey('analytics:timeseries', params);
    const cached = await redisService.get<TimeSeriesPoint[]>(cacheKey);
    if (cached) return cached;

    const conditions: string[] = [];
    const queryParams: Record<string, any> = { dateFrom, dateTo };

    if (protocolName) {
      conditions.push('protocol_name = {protocolName:String}');
      queryParams.protocolName = protocolName;
    }

    conditions.push('date >= {dateFrom:String}');
    conditions.push('date <= {dateTo:String}');

    const whereClause = conditions.join(' AND ');
    const groupBy = granularity === 'hour' ? 'toStartOfHour(toDateTime(block_time))' : 'date';

    const query = `
      SELECT 
        ${groupBy} as timestamp,
        count() as value
      FROM transactions
      WHERE ${whereClause}
      GROUP BY timestamp
      ORDER BY timestamp ASC
    `;

    const results = await clickhouseService.query<TimeSeriesPoint>(query, queryParams);
    await redisService.set(cacheKey, results, config.redis.ttl);
    return results;
  }

  async getFeeAnalytics(params: {
    protocolName?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<any> {
    const { protocolName, dateFrom, dateTo } = params;
    const cacheKey = this.getCacheKey('analytics:fees', params);
    const cached = await redisService.get<any>(cacheKey);
    if (cached) return cached;

    const conditions: string[] = [];
    const queryParams: Record<string, any> = {};

    if (protocolName) {
      conditions.push('protocol_name = {protocolName:String}');
      queryParams.protocolName = protocolName;
    }

    if (dateFrom) {
      conditions.push('date >= {dateFrom:String}');
      queryParams.dateFrom = dateFrom;
    }

    if (dateTo) {
      conditions.push('date <= {dateTo:String}');
      queryParams.dateTo = dateTo;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        min(fee) as minFee,
        max(fee) as maxFee,
        avg(fee) as avgFee,
        quantile(0.5)(fee) as medianFee,
        quantile(0.95)(fee) as p95Fee,
        quantile(0.99)(fee) as p99Fee,
        sum(fee) as totalFees
      FROM transactions
      ${whereClause}
    `;

    const result = await clickhouseService.queryOne<any>(query, queryParams);
    await redisService.set(cacheKey, result, config.redis.ttl);
    return result;
  }

  async getStats(): Promise<Stats> {
    const cacheKey = 'stats:global';
    const cached = await redisService.get<Stats>(cacheKey);
    if (cached) return cached;

    const [totalResult, failedResult, dateRangeResult, protocolsResult] = await Promise.all([
      clickhouseService.queryOne<{ count: number }>('SELECT count() as count FROM transactions'),
      clickhouseService.queryOne<{ count: number }>('SELECT count() as count FROM failed_transactions'),
      clickhouseService.queryOne<{ min: string; max: string }>(
        'SELECT min(date) as min, max(date) as max FROM transactions'
      ),
      clickhouseService.query<{ name: string; count: number }>(
        `SELECT protocol_name as name, count() as count 
         FROM transactions 
         GROUP BY protocol_name 
         ORDER BY count DESC 
         LIMIT 10`
      ),
    ]);

    const stats: Stats = {
      totalTransactions: totalResult?.count || 0,
      totalFailedTransactions: failedResult?.count || 0,
      dateRange: {
        from: dateRangeResult?.min || '',
        to: dateRangeResult?.max || '',
      },
      protocols: protocolsResult || [],
    };

    await redisService.set(cacheKey, stats, 300); // Cache for 5 minutes
    return stats;
  }
}

export const transactionsService = new TransactionsService();

