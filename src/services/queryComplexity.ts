import { clickhouseService } from './clickhouse';
import { TransactionFilters, GroupByDimension, AggregationMetric, QueryComplexity } from '../types';
import { logger } from './logger';
import { metrics } from './metrics';
import { QuerySecurity } from './querySecurity';

export class QueryComplexityService {
  /**
   * Estimates row count by querying ClickHouse with a fast count query
   */
  private async estimateRowCount(
    filters: TransactionFilters,
    table: 'transactions' | 'failed_transactions' = 'transactions'
  ): Promise<number> {
    // SECURITY: Validate table name
    const safeTable = QuerySecurity.sanitizeTableName(table);

    const conditions: string[] = [];
    const queryParams: Record<string, any> = {};

    // Build WHERE clause from filters (simplified version for estimation)
    if (filters.signatures && filters.signatures.length > 0) {
      conditions.push('signature IN {signatures:Array(String)}');
      queryParams.signatures = filters.signatures;
    }

    if (filters.programIds && filters.programIds.length > 0) {
      conditions.push('program_id IN {programIds:Array(String)}');
      queryParams.programIds = filters.programIds;
    }

    if (filters.dateRange) {
      conditions.push('date >= {dateFrom:String}');
      conditions.push('date <= {dateTo:String}');
      queryParams.dateFrom = filters.dateRange.start;
      queryParams.dateTo = filters.dateRange.end;
    }

    if (filters.slotRange) {
      conditions.push('slot >= {slotMin:UInt64}');
      conditions.push('slot <= {slotMax:UInt64}');
      queryParams.slotMin = filters.slotRange.min;
      queryParams.slotMax = filters.slotRange.max;
    }

    if (filters.protocols && filters.protocols.length > 0) {
      conditions.push('protocol_name IN {protocols:Array(String)}');
      queryParams.protocols = filters.protocols;
    }

    if (filters.instructionTypes && filters.instructionTypes.length > 0) {
      conditions.push('instruction_type IN {instructionTypes:Array(String)}');
      queryParams.instructionTypes = filters.instructionTypes;
    }

    if (filters.success !== undefined) {
      conditions.push('success = {success:UInt8}');
      queryParams.success = filters.success ? 1 : 0;
    }

    if (filters.feeRange) {
      if (filters.feeRange.min !== undefined) {
        conditions.push('fee >= {feeMin:UInt64}');
        queryParams.feeMin = filters.feeRange.min;
      }
      if (filters.feeRange.max !== undefined) {
        conditions.push('fee <= {feeMax:UInt64}');
        queryParams.feeMax = filters.feeRange.max;
      }
    }

    if (filters.computeRange) {
      if (filters.computeRange.min !== undefined) {
        conditions.push('compute_units >= {computeMin:UInt64}');
        queryParams.computeMin = filters.computeRange.min;
      }
      if (filters.computeRange.max !== undefined) {
        conditions.push('compute_units <= {computeMax:UInt64}');
        queryParams.computeMax = filters.computeRange.max;
      }
    }

    if (filters.accountsCount) {
      if (filters.accountsCount.min !== undefined) {
        conditions.push('accounts_count >= {accountsMin:UInt8}');
        queryParams.accountsMin = filters.accountsCount.min;
      }
      if (filters.accountsCount.max !== undefined) {
        conditions.push('accounts_count <= {accountsMax:UInt8}');
        queryParams.accountsMax = filters.accountsCount.max;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // SECURITY: Use validated table name
    const countQuery = `
      SELECT count() as count
      FROM ${safeTable}
      ${whereClause}
      SETTINGS max_execution_time = 1
    `;

    try {
      const startTime = Date.now();
      const result = await clickhouseService.queryOne<{ count: number }>(countQuery, queryParams);
      const executionTime = Date.now() - startTime;

      metrics.clickhouseQueryDuration.observe({ query_type: 'count_estimate' }, executionTime / 1000);

      const estimatedRows = result?.count || 0;
      logger.debug('Row count estimate', {
        estimatedRows,
        executionTime,
        table,
      });

      return estimatedRows;
    } catch (error) {
      logger.error('Failed to estimate row count', error as Error, { table });
      // On error, return a conservative estimate
      return 1000000; // 1M rows as fallback
    }
  }

  /**
   * Calculates query complexity based on real row estimates
   */
  async calculateComplexity(
    filters: TransactionFilters,
    groupBy?: GroupByDimension[],
    metrics?: AggregationMetric[],
    table: 'transactions' | 'failed_transactions' = 'transactions'
  ): Promise<QueryComplexity> {
    const estimatedRows = await this.estimateRowCount(filters, table);

    // Base cost: estimated_rows / 10000
    const baseCost = estimatedRows / 10000;

    // GROUP BY multiplier: 2x for each dimension
    const groupByMultiplier = groupBy ? Math.pow(2, groupBy.length) : 1;

    // Aggregation cost: +10% for each aggregation
    const aggregationCount = metrics?.length || 0;
    const aggregationCost = baseCost * 0.1 * aggregationCount;

    // Final complexity score
    const score = baseCost * groupByMultiplier + aggregationCost;

    const recommendations: string[] = [];

    if (estimatedRows > 5000000 && !filters.signatures) {
      recommendations.push('Query may return >5M rows. Consider adding pagination or narrowing filters.');
    }

    if (score > 1000) {
      recommendations.push('Query complexity too high. Consider: (1) narrower date range, (2) fewer GROUP BY dimensions, or (3) use exportDataset mutation for background processing');
    }

    if (groupBy && groupBy.length > 3) {
      recommendations.push('Multiple GROUP BY dimensions may result in large result sets. Consider reducing dimensions.');
    }

    const complexity: QueryComplexity = {
      score: Math.round(score * 100) / 100, // Round to 2 decimal places
      estimatedRows,
      baseCost: Math.round(baseCost * 100) / 100,
      groupByMultiplier,
      aggregationCost: Math.round(aggregationCost * 100) / 100,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    };

    return complexity;
  }

  /**
   * Gets the timeout for a query based on its complexity
   */
  getTimeout(complexity: number): number {
    if (complexity < 100) {
      return 10; // 10 seconds for simple queries
    } else if (complexity < 500) {
      return 30; // 30 seconds for medium queries
    } else if (complexity < 1000) {
      return 90; // 90 seconds for heavy queries
    } else {
      return 90; // Max 90 seconds even for very complex queries
    }
  }

  /**
   * Gets the rate limit tier for a query based on its complexity
   */
  getRateLimitTier(complexity: number): string {
    if (complexity < 50) {
      return 'cost50';
    } else if (complexity < 100) {
      return 'cost100';
    } else if (complexity < 200) {
      return 'cost200';
    } else if (complexity < 500) {
      return 'cost500';
    } else if (complexity < 1000) {
      return 'cost1000';
    } else {
      return 'too_complex';
    }
  }
}

export const queryComplexityService = new QueryComplexityService();

