import {
  TransactionFilters,
  GroupByDimension,
  AggregationMetric,
  SortInput,
  PaginationInput,
} from '../types';
import { queryOptimizer } from './queryOptimizer';
import { QuerySecurity } from './querySecurity';

export interface QueryBuilderOptions {
  filters: TransactionFilters;
  groupBy?: GroupByDimension[];
  metrics?: AggregationMetric[];
  sort?: SortInput;
  pagination?: PaginationInput;
  table?: 'transactions' | 'failed_transactions';
  limit?: number;
  offset?: number;
}

export interface BuiltQuery {
  query: string;
  queryParams: Record<string, any>;
  isAggregation: boolean;
}

export class GraphQLQueryBuilder {
  /**
   * Maps GroupByDimension to ClickHouse expression
   */
  private getGroupByExpression(dimension: GroupByDimension): string {
    switch (dimension) {
      case GroupByDimension.PROTOCOL:
        return 'protocol_name';
      case GroupByDimension.HOUR:
        return 'hour';
      case GroupByDimension.DATE:
        return 'date';
      case GroupByDimension.PROGRAM_ID:
        return 'program_id';
      case GroupByDimension.INSTRUCTION_TYPE:
        return 'instruction_type';
      case GroupByDimension.DAY_OF_WEEK:
        return 'toDayOfWeek(toDate(date))';
      case GroupByDimension.WEEK:
        return 'toStartOfWeek(toDate(date))';
      case GroupByDimension.MONTH:
        return 'toStartOfMonth(toDate(date))';
      default:
        return String(dimension).toLowerCase();
    }
  }

  /**
   * Maps AggregationMetric to ClickHouse aggregation function
   */
  private getAggregationExpression(metric: AggregationMetric): string {
    switch (metric) {
      case AggregationMetric.COUNT:
        return 'count()';
      case AggregationMetric.SUM_FEE:
        return 'sum(fee)';
      case AggregationMetric.AVG_FEE:
        return 'avg(fee)';
      case AggregationMetric.MIN_FEE:
        return 'min(fee)';
      case AggregationMetric.MAX_FEE:
        return 'max(fee)';
      case AggregationMetric.P50_FEE:
        return 'quantile(0.5)(fee)';
      case AggregationMetric.P95_FEE:
        return 'quantile(0.95)(fee)';
      case AggregationMetric.P99_FEE:
        return 'quantile(0.99)(fee)';
      case AggregationMetric.SUM_COMPUTE_UNITS:
        return 'sum(compute_units)';
      case AggregationMetric.AVG_COMPUTE_UNITS:
        return 'avg(compute_units)';
      case AggregationMetric.MIN_COMPUTE_UNITS:
        return 'min(compute_units)';
      case AggregationMetric.MAX_COMPUTE_UNITS:
        return 'max(compute_units)';
      case AggregationMetric.P50_COMPUTE_UNITS:
        return 'quantile(0.5)(compute_units)';
      case AggregationMetric.P95_COMPUTE_UNITS:
        return 'quantile(0.95)(compute_units)';
      case AggregationMetric.P99_COMPUTE_UNITS:
        return 'quantile(0.99)(compute_units)';
      case AggregationMetric.SUM_ACCOUNTS_COUNT:
        return 'sum(accounts_count)';
      case AggregationMetric.AVG_ACCOUNTS_COUNT:
        return 'avg(accounts_count)';
      default:
        throw new Error(`Unknown aggregation metric: ${metric}`);
    }
  }

  /**
   * Gets the alias for an aggregation metric
   */
  private getAggregationAlias(metric: AggregationMetric): string {
    return metric.toLowerCase().replace(/_/g, '');
  }

  /**
   * Builds ORDER BY clause
   */
  private getOrderByClause(sort?: SortInput, groupBy?: GroupByDimension[]): string {
    if (!sort) {
      // Default ordering
      if (groupBy && groupBy.length > 0) {
        // Order by first group by dimension
        return `ORDER BY ${this.getGroupByExpression(groupBy[0])} DESC`;
      }
      return 'ORDER BY date DESC, slot DESC, signature DESC';
    }

    let field: string;
    switch (sort.field) {
      case 'DATE':
        field = 'date';
        break;
      case 'SLOT':
        field = 'slot';
        break;
      case 'FEE':
        field = 'fee';
        break;
      case 'COMPUTE_UNITS':
        field = 'compute_units';
        break;
      case 'ACCOUNTS_COUNT':
        field = 'accounts_count';
        break;
      case 'PROTOCOL':
        field = 'protocol_name';
        break;
      case 'PROGRAM_ID':
        field = 'program_id';
        break;
      case 'INSTRUCTION_TYPE':
        field = 'instruction_type';
        break;
      default:
        field = 'date';
    }

    const direction = sort.direction === 'ASC' ? 'ASC' : 'DESC';
    return `ORDER BY ${field} ${direction}`;
  }

  /**
   * Decodes cursor for pagination (format: slot:signature)
   */
  private decodeCursor(cursor: string): { slot: number; signature: string } | null {
    try {
      const [slot, ...signatureParts] = cursor.split(':');
      if (!slot || signatureParts.length === 0) {
        return null;
      }
      return {
        slot: parseInt(slot, 10),
        signature: signatureParts.join(':'),
      };
    } catch {
      return null;
    }
  }

  /**
   * Encodes cursor for pagination (format: slot:signature)
   */
  encodeCursor(slot: number, signature: string): string {
    return Buffer.from(`${slot}:${signature}`).toString('base64');
  }

  /**
   * Encode cursor for aggregation results (uses groupBy dimensions)
   */
  encodeAggregationCursor(node: any, groupBy?: GroupByDimension[]): string {
    const cursorParts: string[] = [];
    if (groupBy && groupBy.length > 0) {
      groupBy.forEach((dim) => {
        const fieldName = dim.toLowerCase();
        if (node[fieldName] !== undefined && node[fieldName] !== null) {
          cursorParts.push(`${fieldName}:${node[fieldName]}`);
        }
      });
    }
    // Add a hash of all aggregation values as fallback
    const nodeStr = JSON.stringify(node);
    cursorParts.push(`hash:${this.simpleHash(nodeStr)}`);
    return Buffer.from(cursorParts.join('|')).toString('base64');
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Builds pagination conditions for cursor-based pagination
   */
  private getPaginationConditions(
    pagination?: PaginationInput,
    sort?: SortInput
  ): { conditions: string[]; queryParams: Record<string, any> } {
    const conditions: string[] = [];
    const queryParams: Record<string, any> = {};

    if (!pagination) {
      return { conditions, queryParams };
    }

    // For cursor-based pagination, we need to handle after/before
    if (pagination.after) {
      const cursor = this.decodeCursor(pagination.after);
      if (cursor) {
        // For DESC ordering (default), we want records before this cursor
        if (!sort || sort.direction === 'DESC') {
          conditions.push('(slot < {afterSlot:UInt64} OR (slot = {afterSlot:UInt64} AND signature < {afterSignature:String}))');
          queryParams.afterSlot = cursor.slot;
          queryParams.afterSignature = cursor.signature;
        } else {
          conditions.push('(slot > {afterSlot:UInt64} OR (slot = {afterSlot:UInt64} AND signature > {afterSignature:String}))');
          queryParams.afterSlot = cursor.slot;
          queryParams.afterSignature = cursor.signature;
        }
      }
    }

    if (pagination.before) {
      const cursor = this.decodeCursor(pagination.before);
      if (cursor) {
        // For DESC ordering, we want records after this cursor
        if (!sort || sort.direction === 'DESC') {
          conditions.push('(slot > {beforeSlot:UInt64} OR (slot = {beforeSlot:UInt64} AND signature > {beforeSignature:String}))');
          queryParams.beforeSlot = cursor.slot;
          queryParams.beforeSignature = cursor.signature;
        } else {
          conditions.push('(slot < {beforeSlot:UInt64} OR (slot = {beforeSlot:UInt64} AND signature < {beforeSignature:String}))');
          queryParams.beforeSlot = cursor.slot;
          queryParams.beforeSignature = cursor.signature;
        }
      }
    }

    return { conditions, queryParams };
  }

  /**
   * Builds a ClickHouse query from GraphQL inputs
   */
  buildQuery(options: QueryBuilderOptions): BuiltQuery {
    const {
      filters,
      groupBy,
      metrics: aggregationMetrics,
      sort,
      pagination,
      table = 'transactions',
      limit = 100,
    } = options;

    // SECURITY: Validate and sanitize table name
    const safeTable = QuerySecurity.sanitizeTableName(table);

    const isAggregation = Boolean((groupBy && groupBy.length > 0) || (aggregationMetrics && aggregationMetrics.length > 0));

    // Optimize filters
    const { whereClause: optimizedWhere, queryParams: optimizedParams } = queryOptimizer.optimizeFilters(
      filters,
      table
    );

    // Build SELECT clause
    let selectClause: string;
    if (isAggregation) {
      // Aggregation query
      const selectParts: string[] = [];

      // Add GROUP BY dimensions
      if (groupBy && groupBy.length > 0) {
        groupBy.forEach((dim) => {
          const expr = this.getGroupByExpression(dim);
          selectParts.push(`${expr} as ${dim.toLowerCase()}`);
        });
      }

      // Add aggregations
      if (aggregationMetrics && aggregationMetrics.length > 0) {
        aggregationMetrics.forEach((metric) => {
          const expr = this.getAggregationExpression(metric);
          const alias = this.getAggregationAlias(metric);
          selectParts.push(`${expr} as ${alias}`);
        });
      } else {
        // Default to count if no metrics specified
        selectParts.push('count() as count');
      }

      selectClause = `SELECT ${selectParts.join(', ')}`;
    } else {
      // Regular query
      selectClause = `
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
      `;
    }

    // Build WHERE clause with pagination conditions
    const { conditions: paginationConditions, queryParams: paginationParams } = this.getPaginationConditions(
      pagination,
      sort
    );

    let whereClause = optimizedWhere;
    if (paginationConditions.length > 0) {
      if (whereClause) {
        whereClause += ` AND ${paginationConditions.join(' AND ')}`;
      } else {
        whereClause = `WHERE ${paginationConditions.join(' AND ')}`;
      }
    }

    // Build GROUP BY clause
    let groupByClause = '';
    if (groupBy && groupBy.length > 0) {
      const groupByExpressions = groupBy.map((dim) => this.getGroupByExpression(dim));
      groupByClause = `GROUP BY ${groupByExpressions.join(', ')}`;
    }

    // Build ORDER BY clause
    const orderByClause = this.getOrderByClause(sort, groupBy);

    // Build LIMIT clause
    const limitClause = pagination?.first || pagination?.last || limit;
    const limitValue = Math.min(limitClause, 1000); // Max 1000 per page

    // For cursor pagination, fetch one extra to detect hasNextPage
    const limitWithExtra = pagination ? limitValue + 1 : limitValue;

    // Build OFFSET clause (only for non-cursor pagination)
    // Note: offset is not used in cursor-based pagination
    let offsetClause = '';

    // Combine all parts
    // SECURITY: Use validated table name (not user input)
    const query = `
      ${selectClause}
      FROM ${safeTable}
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT {limit:UInt64}
      ${offsetClause}
    `.trim();

    // Merge all query params
    const queryParams = {
      ...optimizedParams,
      ...paginationParams,
      limit: limitWithExtra,
    };

    return {
      query,
      queryParams,
      isAggregation,
    };
  }
}

export const graphqlQueryBuilder = new GraphQLQueryBuilder();

