import { GraphQLError } from 'graphql';
import {
  TransactionFilters,
  GroupByDimension,
  AggregationMetric,
  SortInput,
  PaginationInput,
  TransactionConnection,
  FailedTransactionConnection,
  PageInfo,
  TransactionEdge,
  QueryComplexity,
} from '../types';
import { graphqlQueryBuilder } from '../services/graphqlQueryBuilder';
import { queryComplexityService } from '../services/queryComplexity';
import { clickhouseService } from '../services/clickhouse';
import { cacheManager } from '../services/cacheManager';
import { queryOptimizer } from '../services/queryOptimizer';
import { logger } from '../services/logger';
import { metrics } from '../services/metrics';
import { config } from '../config';
import { DateScalar, SignatureScalar, ProgramIDScalar, BigIntScalar } from './scalars';

// Helper to convert GraphQL input to TypeScript types
function convertFilters(filters: any): TransactionFilters {
  if (!filters) return {};
  return {
    protocols: filters.protocols,
    programIds: filters.programIds,
    signatures: filters.signatures,
    dateRange: filters.dateRange,
    slotRange: filters.slotRange,
    instructionTypes: filters.instructionTypes,
    success: filters.success,
    feeRange: filters.feeRange,
    computeRange: filters.computeRange,
    accountsCount: filters.accountsCount,
    errorPattern: filters.errorPattern,
    logMessage: filters.logMessage,
  };
}

function convertGroupBy(groupBy: string[] | undefined): GroupByDimension[] | undefined {
  if (!groupBy) return undefined;
  return groupBy.map((g) => g as GroupByDimension);
}

function convertMetrics(metrics: string[] | undefined): AggregationMetric[] | undefined {
  if (!metrics) return undefined;
  return metrics.map((m) => m as AggregationMetric);
}

export const resolvers = {
  // Custom scalars
  Date: DateScalar,
  Signature: SignatureScalar,
  ProgramID: ProgramIDScalar,
  BigInt: BigIntScalar,

  Query: {
    transactions: async (
      _: any,
      args: {
        filters?: any;
        groupBy?: string[];
        metrics?: string[];
        sort?: SortInput;
        pagination?: PaginationInput;
      }
    ): Promise<TransactionConnection> => {
      const filters = convertFilters(args.filters);
      const groupBy = convertGroupBy(args.groupBy);
      const aggregationMetrics = convertMetrics(args.metrics);
      const isAggregation = (groupBy && groupBy.length > 0) || (aggregationMetrics && aggregationMetrics.length > 0);

      try {
        // Calculate complexity
        const complexity = await queryComplexityService.calculateComplexity(
          filters,
          groupBy,
          aggregationMetrics,
          'transactions'
        );

        // Check complexity limits
        if (complexity.score > config.graphql.maxComplexity) {
          throw new GraphQLError(
            `Query complexity too high: ${complexity.score}. Maximum allowed: ${config.graphql.maxComplexity}. ${complexity.recommendations?.join(' ')}`,
            {
              extensions: {
                code: 'QUERY_COMPLEXITY_TOO_HIGH',
                complexity: complexity.score,
                recommendations: complexity.recommendations,
              },
            }
          );
        }

        // Check estimated rows for non-aggregation queries
        if (!isAggregation && complexity.estimatedRows > 10000) {
          if (!args.pagination?.first && !args.pagination?.last) {
            throw new GraphQLError(
              `Query may return >10k rows (estimated: ${complexity.estimatedRows}). Pagination required. Use pagination: { first: <number> }`,
              {
                extensions: {
                  code: 'PAGINATION_REQUIRED',
                  estimatedRows: complexity.estimatedRows,
                },
              }
            );
          }
        }

        // Check aggregation group limit
        if (isAggregation && groupBy && groupBy.length > 0) {
          // Estimate max groups (simplified - in production, you'd want a better estimate)
          const estimatedGroups = Math.min(complexity.estimatedRows, 10000);
          if (estimatedGroups > 10000) {
            throw new GraphQLError(
              `Aggregation may produce >10k groups (estimated: ${estimatedGroups}). Please narrow your filters or reduce GROUP BY dimensions.`,
              {
                extensions: {
                  code: 'TOO_MANY_GROUPS',
                  estimatedGroups,
                },
              }
            );
          }
        }

        // Generate cache key
        const cacheKey = cacheManager.generateCacheKey('transactions', {
          filters,
          groupBy,
          metrics: aggregationMetrics,
          sort: args.sort,
          pagination: args.pagination,
        });

        // Try cache
        const cached = await cacheManager.get<TransactionConnection>(cacheKey);
        if (cached) {
          metrics.graphqlQueryTotal.inc({ query: 'transactions', status: 'cached' });
          return cached;
        }

        // Build query
        const { query, queryParams, isAggregation: isAgg } = graphqlQueryBuilder.buildQuery({
          filters,
          groupBy,
          metrics: aggregationMetrics,
          sort: args.sort,
          pagination: args.pagination,
          table: 'transactions',
          limit: args.pagination?.first || args.pagination?.last || 100,
        });

        // Execute query
        const queryStartTime = Date.now();
        const timeout = queryComplexityService.getTimeout(complexity.score);
        const results = await clickhouseService.query<any>(query, queryParams, timeout, complexity.score);
        const executionTime = Date.now() - queryStartTime;

        // Log query
        queryOptimizer.logQuery(
          query,
          complexity.score,
          complexity.estimatedRows,
          executionTime,
          queryOptimizer.optimizeFilters(filters, 'transactions').filterOrder,
          groupBy?.map((g) => g.toString())
        );

        // Update metrics
        metrics.graphqlQueryDuration.observe(
          {
            query: 'transactions',
            complexity_tier: queryComplexityService.getRateLimitTier(complexity.score),
          },
          executionTime / 1000
        );
        metrics.graphqlQueryTotal.inc({ query: 'transactions', status: 'success' });
        metrics.graphqlQueryComplexity.observe({ query: 'transactions' }, complexity.score);
        metrics.graphqlQueryEstimatedRows.observe({ query: 'transactions' }, complexity.estimatedRows);

        // Handle pagination
        const limit = args.pagination?.first || args.pagination?.last || 100;
        const hasNextPage = results.length > limit;
        const nodes = hasNextPage ? results.slice(0, limit) : results;

        // Build edges with cursors
        const edges: TransactionEdge[] = nodes.map((node: any) => {
          // For aggregation results, use groupBy dimensions for cursor
          let cursor: string;
          if (isAgg) {
            cursor = graphqlQueryBuilder.encodeAggregationCursor(node, groupBy);
          } else {
            // Regular transaction: use slot and signature
            cursor = graphqlQueryBuilder.encodeCursor(node.slot || 0, node.signature || '');
          }
          return {
            node,
            cursor,
          };
        });

        // Build pageInfo
        const pageInfo: PageInfo = {
          hasNextPage,
          hasPreviousPage: !!args.pagination?.before,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor,
        };

        const connection: TransactionConnection = {
          edges,
          nodes,
          pageInfo,
        };

        // Cache result (non-blocking - fire and forget)
        const ttl = cacheManager.getCacheTTL(cacheKey, isAgg, filters.dateRange);
        // Don't await - let it cache in background to avoid blocking response
        cacheManager.set(cacheKey, connection, ttl, isAgg, filters.dateRange).catch((err) => {
          logger.error('Background cache set failed', err as Error, { cacheKey });
        });

        return connection;
      } catch (error: any) {
        metrics.graphqlQueryTotal.inc({ query: 'transactions', status: 'error' });
        logger.error('Transactions query error', error, {
          filters,
          groupBy,
          metrics: aggregationMetrics,
        });

        if (error instanceof GraphQLError) {
          throw error;
        }

        throw new GraphQLError(error.message || 'Failed to execute query', {
          extensions: {
            code: 'QUERY_EXECUTION_ERROR',
          },
        });
      }
    },

    failedTransactions: async (
      _: any,
      _args: {
        filters: any;
        groupBy?: string[];
        metrics?: string[];
        sort?: SortInput;
        pagination?: PaginationInput;
      }
    ): Promise<FailedTransactionConnection> => {
      // Similar implementation to transactions but for failed_transactions table
      // Implementation omitted for brevity - follows same pattern
      throw new GraphQLError('Not yet implemented', {
        extensions: { code: 'NOT_IMPLEMENTED' },
      });
    },

    timeSeries: async (
      _: any,
      _args: {
        filters?: any;
        bucketBy: string;
        metrics?: string[];
        groupBy?: string[];
      }
    ) => {
      // Implementation for time series query
      throw new GraphQLError('Not yet implemented', {
        extensions: { code: 'NOT_IMPLEMENTED' },
      });
    },

    protocolStats: async (_: any, _args: { filters: any }) => {
      // Implementation for protocol stats
      throw new GraphQLError('Not yet implemented', {
        extensions: { code: 'NOT_IMPLEMENTED' },
      });
    },

    signature: async (_: any, args: { signature: string }) => {
      const cacheKey = `transaction:${args.signature}`;
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }

      const filters: TransactionFilters = {
        signatures: [args.signature],
      };

      const { query, queryParams } = graphqlQueryBuilder.buildQuery({
        filters,
        table: 'transactions',
        limit: 1,
      });

      const results = await clickhouseService.query(query, queryParams, 10);
      const transaction = results[0] || null;

      if (transaction) {
        // Cache result (non-blocking)
        cacheManager.set(cacheKey, transaction, config.cache.historicalDataTTL).catch((err) => {
          logger.error('Background cache set failed', err as Error, { cacheKey });
        });
      }

      return transaction;
    },

    queryComplexity: async (
      _: any,
      args: {
        filters: any;
        groupBy?: string[];
        metrics?: string[];
      }
    ): Promise<QueryComplexity> => {
      const filters = convertFilters(args.filters);
      const groupBy = convertGroupBy(args.groupBy);
      const metrics = convertMetrics(args.metrics);

      return queryComplexityService.calculateComplexity(filters, groupBy, metrics, 'transactions');
    },

    exportJob: async (_: any, args: { id: string }) => {
      const { exportResolvers } = await import('./resolvers/exportResolvers');
      return exportResolvers.Query.exportJob(_, args);
    },
  },

  Mutation: {
    exportDataset: async (_: any, args: { config: any }) => {
      const { exportResolvers } = await import('./resolvers/exportResolvers');
      return exportResolvers.Mutation.exportDataset(_, args);
    },
  },
};
