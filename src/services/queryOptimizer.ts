import { TransactionFilters } from '../types';
import { logger } from './logger';
import { QuerySecurity } from './querySecurity';

export interface OptimizedQuery {
  whereClause: string;
  queryParams: Record<string, any>;
  filterOrder: string[];
}

export class QueryOptimizer {
  /**
   * Optimizes query by applying filters in hardcoded order of selectivity
   * Order: signature > program_id > date > slot > protocol_name > everything else
   */
  optimizeFilters(filters: TransactionFilters, table: 'transactions' | 'failed_transactions' = 'transactions'): OptimizedQuery {
    // SECURITY: Validate table name (table is type-constrained but validate at runtime for safety)
    QuerySecurity.sanitizeTableName(table);

    const conditions: string[] = [];
    const queryParams: Record<string, any> = {};
    const filterOrder: string[] = [];

    // 1. signature = (bloom filter, super selective)
    if (filters.signatures && filters.signatures.length > 0) {
      if (filters.signatures.length === 1) {
        conditions.push('signature = {signature:String}');
        queryParams.signature = filters.signatures[0];
      } else {
        conditions.push('signature IN {signatures:Array(String)}');
        queryParams.signatures = filters.signatures;
      }
      filterOrder.push('signature');
    }

    // 2. program_id IN (bloom filter, very selective)
    if (filters.programIds && filters.programIds.length > 0) {
      if (filters.programIds.length === 1) {
        conditions.push('program_id = {programId:String}');
        queryParams.programId = filters.programIds[0];
      } else {
        conditions.push('program_id IN {programIds:Array(String)}');
        queryParams.programIds = filters.programIds;
      }
      filterOrder.push('program_id');
    }

    // 3. date BETWEEN (partition pruning)
    if (filters.dateRange) {
      conditions.push('date >= {dateFrom:String}');
      conditions.push('date <= {dateTo:String}');
      queryParams.dateFrom = filters.dateRange.start;
      queryParams.dateTo = filters.dateRange.end;
      filterOrder.push('date');
    }

    // 4. slot BETWEEN (somewhat selective)
    if (filters.slotRange) {
      conditions.push('slot >= {slotMin:UInt64}');
      conditions.push('slot <= {slotMax:UInt64}');
      queryParams.slotMin = filters.slotRange.min;
      queryParams.slotMax = filters.slotRange.max;
      filterOrder.push('slot');
    }

    // 5. protocol_name IN (bloom filter but less selective)
    if (filters.protocols && filters.protocols.length > 0) {
      if (filters.protocols.length === 1) {
        conditions.push('protocol_name = {protocolName:String}');
        queryParams.protocolName = filters.protocols[0];
      } else {
        conditions.push('protocol_name IN {protocols:Array(String)}');
        queryParams.protocols = filters.protocols;
      }
      filterOrder.push('protocol_name');
    }

    // 6. Everything else
    if (filters.instructionTypes && filters.instructionTypes.length > 0) {
      if (filters.instructionTypes.length === 1) {
        conditions.push('instruction_type = {instructionType:String}');
        queryParams.instructionType = filters.instructionTypes[0];
      } else {
        conditions.push('instruction_type IN {instructionTypes:Array(String)}');
        queryParams.instructionTypes = filters.instructionTypes;
      }
      filterOrder.push('instruction_type');
    }

    if (filters.success !== undefined) {
      conditions.push('success = {success:UInt8}');
      queryParams.success = filters.success ? 1 : 0;
      filterOrder.push('success');
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
      if (filters.feeRange.min !== undefined || filters.feeRange.max !== undefined) {
        filterOrder.push('fee');
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
      if (filters.computeRange.min !== undefined || filters.computeRange.max !== undefined) {
        filterOrder.push('compute_units');
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
      if (filters.accountsCount.min !== undefined || filters.accountsCount.max !== undefined) {
        filterOrder.push('accounts_count');
      }
    }

    // Failed transactions specific filters
    if (table === 'failed_transactions') {
      if (filters.errorPattern) {
        conditions.push('error_message LIKE {errorPattern:String}');
        queryParams.errorPattern = `%${filters.errorPattern}%`;
        filterOrder.push('error_pattern');
      }

      if (filters.logMessage) {
        conditions.push('log_messages LIKE {logMessage:String}');
        queryParams.logMessage = `%${filters.logMessage}%`;
        filterOrder.push('log_message');
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return {
      whereClause,
      queryParams,
      filterOrder,
    };
  }

  /**
   * Logs query execution for materialized view analysis
   */
  logQuery(
    query: string,
    complexity: number,
    estimatedRows: number,
    executionTime: number,
    filterOrder: string[],
    groupBy?: string[]
  ) {
    logger.logQuery(query, complexity, estimatedRows, executionTime, {
      filterOrder: filterOrder.join(','),
      groupBy: groupBy?.join(','),
    });

    // Log slow queries (>2s) with more detail
    if (executionTime > 2000) {
      logger.warn('Slow query detected', {
        executionTime,
        complexity,
        estimatedRows,
        filterOrder: filterOrder.join(','),
        groupBy: groupBy?.join(','),
        query: query.substring(0, 500),
      });
    }
  }
}

export const queryOptimizer = new QueryOptimizer();

