import { clickhouseService } from './clickhouse';
import { logger } from './logger';

export interface Transaction {
  signature: string;
  slot: string;
  blockTime: number;
  programId: string;
  protocolName: string;
  instructionType: string;
  fee: number;
  computeUnits: number;
  accountsCount: number;
  success: boolean;
}

export interface FailedTransaction {
  signature: string;
  slot: string;
  blockTime: number;
  programId: string;
  protocolName: string;
  errorMessage: string;
  logMessages: string;
  rawData: string;
}

export interface ProtocolStats {
  protocolName: string;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  successRate: number;
  totalFees: number;
  averageFee: number;
  totalComputeUnits: number;
  averageComputeUnits: number;
  averageAccountsCount: number;
  uniqueInstructionTypes: number;
  firstSeen: number;
  lastSeen: number;
}

export interface InstructionTypeStats {
  instructionType: string;
  protocolName: string;
  count: number;
  successRate: number;
  averageComputeUnits: number;
  averageFee: number;
}

export interface TimeSeriesDataPoint {
  timestamp: number;
  date: string;
  hour?: number;
  count: number;
  successCount: number;
  failedCount: number;
  totalFees: number;
  totalComputeUnits: number;
}

export interface ProtocolComparison {
  protocolName: string;
  totalTransactions: number;
  successRate: number;
  averageFee: number;
  averageComputeUnits: number;
  uniqueInstructionTypes: number;
}

export interface TopProtocol {
  protocolName: string;
  transactionCount: number;
  successRate: number;
  totalFees: number;
}

/**
 * RPC Service for handling JSON-RPC method calls
 * Designed specifically for SolixDB analytics on Solana transaction data
 */
export class RPCService {
  /**
   * Get transaction by signature
   */
  async getTransaction(signature: string): Promise<Transaction | null> {
    try {
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
          success
        FROM transactions
        WHERE signature = {signature:String}
        LIMIT 1
      `;

      const results = await clickhouseService.query<Transaction>(query, { signature }, 30);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      logger.error('Error in getTransaction', error as Error);
      throw error;
    }
  }

  /**
   * Get transactions with filters
   */
  async getTransactions(params: {
    filters?: {
      blockTime?: { gte?: number; lte?: number };
      status?: 'succeeded' | 'failed' | 'all';
      protocols?: string[];
      programIds?: string[];
      instructionTypes?: string[];
      signatures?: string[];
    };
    sortOrder?: 'asc' | 'desc';
    limit?: number;
  } = {}): Promise<{ data: Transaction[] }> {
    try {
      const {
        sortOrder = 'desc',
        limit = 100,
        filters = {},
      } = params;

      const conditions: string[] = [];
      const queryParams: Record<string, any> = {};

      if (filters.blockTime) {
        if (filters.blockTime.gte !== undefined) {
          conditions.push(`block_time >= {blockTimeGte:UInt64}`);
          queryParams.blockTimeGte = filters.blockTime.gte;
        }
        if (filters.blockTime.lte !== undefined) {
          conditions.push(`block_time <= {blockTimeLte:UInt64}`);
          queryParams.blockTimeLte = filters.blockTime.lte;
        }
      }

      if (filters.status && filters.status !== 'all') {
        conditions.push(`success = {success:UInt8}`);
        queryParams.success = filters.status === 'succeeded' ? 1 : 0;
      }

      if (filters.protocols && filters.protocols.length > 0) {
        conditions.push(`protocol_name IN {protocols:Array(String)}`);
        queryParams.protocols = filters.protocols;
      }

      if (filters.programIds && filters.programIds.length > 0) {
        conditions.push(`program_id IN {programIds:Array(String)}`);
        queryParams.programIds = filters.programIds;
      }

      if (filters.instructionTypes && filters.instructionTypes.length > 0) {
        conditions.push(`instruction_type IN {instructionTypes:Array(String)}`);
        queryParams.instructionTypes = filters.instructionTypes;
      }

      if (filters.signatures && filters.signatures.length > 0) {
        conditions.push(`signature IN {signatures:Array(String)}`);
        queryParams.signatures = filters.signatures;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderByClause = `ORDER BY block_time ${sortOrder.toUpperCase()}`;
      const limitClause = `LIMIT ${Math.min(limit, 10000)}`;

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
          success
        FROM transactions
        ${whereClause}
        ${orderByClause}
        ${limitClause}
      `;

      const results = await clickhouseService.query<Transaction>(query, queryParams, 30);
      return { data: results };
    } catch (error) {
      logger.error('Error in getTransactions', error as Error);
      throw error;
    }
  }

  /**
   * Get comprehensive statistics for a protocol
   */
  async getProtocolStats(params: {
    protocolName: string;
    blockTime?: { gte?: number; lte?: number };
  }): Promise<ProtocolStats> {
    try {
      const { protocolName, blockTime } = params;
      const conditions: string[] = [`protocol_name = {protocolName:String}`];
      const queryParams: Record<string, any> = { protocolName };

      if (blockTime) {
        if (blockTime.gte !== undefined) {
          conditions.push(`block_time >= {blockTimeGte:UInt64}`);
          queryParams.blockTimeGte = blockTime.gte;
        }
        if (blockTime.lte !== undefined) {
          conditions.push(`block_time <= {blockTimeLte:UInt64}`);
          queryParams.blockTimeLte = blockTime.lte;
        }
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const query = `
        SELECT 
          protocol_name as protocolName,
          count() as totalTransactions,
          sum(success) as successfulTransactions,
          count() - sum(success) as failedTransactions,
          (sum(success) / count()) * 100 as successRate,
          sum(fee) as totalFees,
          avg(fee) as averageFee,
          sum(compute_units) as totalComputeUnits,
          avg(compute_units) as averageComputeUnits,
          avg(accounts_count) as averageAccountsCount,
          uniqExact(instruction_type) as uniqueInstructionTypes,
          min(block_time) as firstSeen,
          max(block_time) as lastSeen
        FROM transactions
        ${whereClause}
        GROUP BY protocol_name
      `;

      const results = await clickhouseService.query<any>(query, queryParams, 30);
      if (results.length === 0) {
        throw new Error(`Protocol '${protocolName}' not found`);
      }

      const result = results[0];
      return {
        protocolName: result.protocolName,
        totalTransactions: Number(result.totalTransactions),
        successfulTransactions: Number(result.successfulTransactions),
        failedTransactions: Number(result.failedTransactions),
        successRate: Number(result.successRate),
        totalFees: Number(result.totalFees),
        averageFee: Number(result.averageFee),
        totalComputeUnits: Number(result.totalComputeUnits),
        averageComputeUnits: Number(result.averageComputeUnits),
        averageAccountsCount: Number(result.averageAccountsCount),
        uniqueInstructionTypes: Number(result.uniqueInstructionTypes),
        firstSeen: Number(result.firstSeen),
        lastSeen: Number(result.lastSeen),
      };
    } catch (error) {
      logger.error('Error in getProtocolStats', error as Error);
      throw error;
    }
  }

  /**
   * Compare multiple protocols side by side
   */
  async getProtocolComparison(params: {
    protocols: string[];
    blockTime?: { gte?: number; lte?: number };
  }): Promise<ProtocolComparison[]> {
    try {
      const { protocols, blockTime } = params;
      const conditions: string[] = [`protocol_name IN {protocols:Array(String)}`];
      const queryParams: Record<string, any> = { protocols };

      if (blockTime) {
        if (blockTime.gte !== undefined) {
          conditions.push(`block_time >= {blockTimeGte:UInt64}`);
          queryParams.blockTimeGte = blockTime.gte;
        }
        if (blockTime.lte !== undefined) {
          conditions.push(`block_time <= {blockTimeLte:UInt64}`);
          queryParams.blockTimeLte = blockTime.lte;
        }
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const query = `
        SELECT 
          protocol_name as protocolName,
          count() as totalTransactions,
          (sum(success) / count()) * 100 as successRate,
          avg(fee) as averageFee,
          avg(compute_units) as averageComputeUnits,
          uniqExact(instruction_type) as uniqueInstructionTypes
        FROM transactions
        ${whereClause}
        GROUP BY protocol_name
        ORDER BY totalTransactions DESC
      `;

      const results = await clickhouseService.query<any>(query, queryParams, 30);
      return results.map((r: any) => ({
        protocolName: r.protocolName,
        totalTransactions: Number(r.totalTransactions),
        successRate: Number(r.successRate),
        averageFee: Number(r.averageFee),
        averageComputeUnits: Number(r.averageComputeUnits),
        uniqueInstructionTypes: Number(r.uniqueInstructionTypes),
      }));
    } catch (error) {
      logger.error('Error in getProtocolComparison', error as Error);
      throw error;
    }
  }

  /**
   * Get instruction types for a protocol with statistics
   */
  async getInstructionTypes(params: {
    protocolName?: string;
    blockTime?: { gte?: number; lte?: number };
    limit?: number;
  }): Promise<InstructionTypeStats[]> {
    try {
      const { protocolName, blockTime, limit = 100 } = params;
      const conditions: string[] = [];
      const queryParams: Record<string, any> = {};

      if (protocolName) {
        conditions.push(`protocol_name = {protocolName:String}`);
        queryParams.protocolName = protocolName;
      }

      if (blockTime) {
        if (blockTime.gte !== undefined) {
          conditions.push(`block_time >= {blockTimeGte:UInt64}`);
          queryParams.blockTimeGte = blockTime.gte;
        }
        if (blockTime.lte !== undefined) {
          conditions.push(`block_time <= {blockTimeLte:UInt64}`);
          queryParams.blockTimeLte = blockTime.lte;
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT 
          instruction_type as instructionType,
          protocol_name as protocolName,
          count() as count,
          (sum(success) / count()) * 100 as successRate,
          avg(compute_units) as averageComputeUnits,
          avg(fee) as averageFee
        FROM transactions
        ${whereClause}
        GROUP BY instruction_type, protocol_name
        ORDER BY count DESC
        LIMIT ${Math.min(limit, 1000)}
      `;

      const results = await clickhouseService.query<any>(query, queryParams, 30);
      return results.map((r: any) => ({
        instructionType: r.instructionType,
        protocolName: r.protocolName,
        count: Number(r.count),
        successRate: Number(r.successRate),
        averageComputeUnits: Number(r.averageComputeUnits),
        averageFee: Number(r.averageFee),
      }));
    } catch (error) {
      logger.error('Error in getInstructionTypes', error as Error);
      throw error;
    }
  }

  /**
   * Get time-series activity data for protocols
   */
  async getProtocolActivity(params: {
    protocolName?: string;
    blockTime: { gte: number; lte: number };
    interval?: 'hour' | 'day';
  }): Promise<TimeSeriesDataPoint[]> {
    try {
      const { protocolName, blockTime, interval = 'hour' } = params;
      const conditions: string[] = [
        `block_time >= {blockTimeGte:UInt64}`,
        `block_time <= {blockTimeLte:UInt64}`,
      ];
      const queryParams: Record<string, any> = {
        blockTimeGte: blockTime.gte,
        blockTimeLte: blockTime.lte,
      };

      if (protocolName) {
        conditions.push(`protocol_name = {protocolName:String}`);
        queryParams.protocolName = protocolName;
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;
      const groupByField = interval === 'hour' ? 'hour' : 'date';
      const selectField = interval === 'hour' 
        ? 'toStartOfHour(toDateTime(block_time)) as timestamp, date, hour'
        : 'toStartOfDay(toDateTime(block_time)) as timestamp, date';

      const query = `
        SELECT 
          ${selectField},
          count() as count,
          sum(success) as successCount,
          count() - sum(success) as failedCount,
          sum(fee) as totalFees,
          sum(compute_units) as totalComputeUnits
        FROM transactions
        ${whereClause}
        GROUP BY ${groupByField === 'hour' ? 'date, hour' : 'date'}
        ORDER BY timestamp ASC
      `;

      const results = await clickhouseService.query<any>(query, queryParams, 30);
      return results.map((r: any) => ({
        timestamp: Number(r.timestamp),
        date: r.date,
        ...(interval === 'hour' && { hour: Number(r.hour) }),
        count: Number(r.count),
        successCount: Number(r.successCount),
        failedCount: Number(r.failedCount),
        totalFees: Number(r.totalFees),
        totalComputeUnits: Number(r.totalComputeUnits),
      }));
    } catch (error) {
      logger.error('Error in getProtocolActivity', error as Error);
      throw error;
    }
  }

  /**
   * Get top protocols by transaction count
   */
  async getTopProtocols(params: {
    blockTime?: { gte?: number; lte?: number };
    limit?: number;
    sortBy?: 'transactions' | 'fees' | 'successRate';
  }): Promise<TopProtocol[]> {
    try {
      const { blockTime, limit = 10, sortBy = 'transactions' } = params;
      const conditions: string[] = [];
      const queryParams: Record<string, any> = {};

      if (blockTime) {
        if (blockTime.gte !== undefined) {
          conditions.push(`block_time >= {blockTimeGte:UInt64}`);
          queryParams.blockTimeGte = blockTime.gte;
        }
        if (blockTime.lte !== undefined) {
          conditions.push(`block_time <= {blockTimeLte:UInt64}`);
          queryParams.blockTimeLte = blockTime.lte;
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      let orderBy = 'count DESC';
      if (sortBy === 'fees') {
        orderBy = 'totalFees DESC';
      } else if (sortBy === 'successRate') {
        orderBy = 'successRate DESC';
      }

      const query = `
        SELECT 
          protocol_name as protocolName,
          count() as transactionCount,
          (sum(success) / count()) * 100 as successRate,
          sum(fee) as totalFees
        FROM transactions
        ${whereClause}
        GROUP BY protocol_name
        ORDER BY ${orderBy}
        LIMIT ${Math.min(limit, 100)}
      `;

      const results = await clickhouseService.query<any>(query, queryParams, 30);
      return results.map((r: any) => ({
        protocolName: r.protocolName,
        transactionCount: Number(r.transactionCount),
        successRate: Number(r.successRate),
        totalFees: Number(r.totalFees),
      }));
    } catch (error) {
      logger.error('Error in getTopProtocols', error as Error);
      throw error;
    }
  }

  /**
   * Get failed transactions with error details
   */
  async getFailedTransactions(params: {
    protocolName?: string;
    programId?: string;
    blockTime?: { gte?: number; lte?: number };
    limit?: number;
  }): Promise<{ data: FailedTransaction[] }> {
    try {
      const { protocolName, programId, blockTime, limit = 100 } = params;
      const conditions: string[] = [];
      const queryParams: Record<string, any> = {};

      if (protocolName) {
        conditions.push(`protocol_name = {protocolName:String}`);
        queryParams.protocolName = protocolName;
      }

      if (programId) {
        conditions.push(`program_id = {programId:String}`);
        queryParams.programId = programId;
      }

      if (blockTime) {
        if (blockTime.gte !== undefined) {
          conditions.push(`block_time >= {blockTimeGte:UInt64}`);
          queryParams.blockTimeGte = blockTime.gte;
        }
        if (blockTime.lte !== undefined) {
          conditions.push(`block_time <= {blockTimeLte:UInt64}`);
          queryParams.blockTimeLte = blockTime.lte;
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT 
          signature,
          slot,
          block_time as blockTime,
          program_id as programId,
          protocol_name as protocolName,
          error_message as errorMessage,
          log_messages as logMessages,
          raw_data as rawData
        FROM failed_transactions
        ${whereClause}
        ORDER BY block_time DESC
        LIMIT ${Math.min(limit, 1000)}
      `;

      const results = await clickhouseService.query<FailedTransaction>(query, queryParams, 30);
      return { data: results };
    } catch (error) {
      logger.error('Error in getFailedTransactions', error as Error);
      throw error;
    }
  }

  /**
   * Get protocol performance metrics
   */
  async getProtocolPerformance(params: {
    protocolName: string;
    blockTime?: { gte?: number; lte?: number };
  }): Promise<{
    protocolName: string;
    successRate: number;
    averageComputeUnits: number;
    averageFee: number;
    p50ComputeUnits: number;
    p95ComputeUnits: number;
    p99ComputeUnits: number;
    averageAccountsCount: number;
    totalVolume: number;
  }> {
    try {
      const { protocolName, blockTime } = params;
      const conditions: string[] = [`protocol_name = {protocolName:String}`];
      const queryParams: Record<string, any> = { protocolName };

      if (blockTime) {
        if (blockTime.gte !== undefined) {
          conditions.push(`block_time >= {blockTimeGte:UInt64}`);
          queryParams.blockTimeGte = blockTime.gte;
        }
        if (blockTime.lte !== undefined) {
          conditions.push(`block_time <= {blockTimeLte:UInt64}`);
          queryParams.blockTimeLte = blockTime.lte;
        }
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const query = `
        SELECT 
          protocol_name as protocolName,
          (sum(success) / count()) * 100 as successRate,
          avg(compute_units) as averageComputeUnits,
          quantile(0.5)(compute_units) as p50ComputeUnits,
          quantile(0.95)(compute_units) as p95ComputeUnits,
          quantile(0.99)(compute_units) as p99ComputeUnits,
          avg(fee) as averageFee,
          avg(accounts_count) as averageAccountsCount,
          count() as totalVolume
        FROM transactions
        ${whereClause}
        GROUP BY protocol_name
      `;

      const results = await clickhouseService.query<any>(query, queryParams, 30);
      if (results.length === 0) {
        throw new Error(`Protocol '${protocolName}' not found`);
      }

      const result = results[0];
      return {
        protocolName: result.protocolName,
        successRate: Number(result.successRate),
        averageComputeUnits: Number(result.averageComputeUnits),
        averageFee: Number(result.averageFee),
        p50ComputeUnits: Number(result.p50ComputeUnits),
        p95ComputeUnits: Number(result.p95ComputeUnits),
        p99ComputeUnits: Number(result.p99ComputeUnits),
        averageAccountsCount: Number(result.averageAccountsCount),
        totalVolume: Number(result.totalVolume),
      };
    } catch (error) {
      logger.error('Error in getProtocolPerformance', error as Error);
      throw error;
    }
  }

  /**
   * Get available protocols list
   */
  async getProtocols(): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT protocol_name as protocolName
        FROM transactions
        WHERE protocol_name != ''
        ORDER BY protocol_name ASC
      `;

      const results = await clickhouseService.query<{ protocolName: string }>(query, {}, 30);
      return results.map((r) => r.protocolName);
    } catch (error) {
      logger.error('Error in getProtocols', error as Error);
      throw error;
    }
  }
}

export const rpcService = new RPCService();
