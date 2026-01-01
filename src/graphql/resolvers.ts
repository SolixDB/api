import { transactionsService } from '../services/transactions';
import { Transaction, ProtocolAnalytics, TimeSeriesPoint } from '../types';

export const resolvers = {
  Query: {
    transactions: async (
      _: any,
      args: {
        protocolName?: string;
        programId?: string;
        dateFrom?: string;
        dateTo?: string;
        signature?: string;
        limit?: number;
        offset?: number;
      }
    ): Promise<Transaction[]> => {
      return transactionsService.getTransactions(args);
    },

    transaction: async (_: any, args: { signature: string }): Promise<Transaction | null> => {
      return transactionsService.getTransactionBySignature(args.signature);
    },

    protocolAnalytics: async (
      _: any,
      args: {
        protocolName: string;
        dateFrom?: string;
        dateTo?: string;
      }
    ): Promise<ProtocolAnalytics> => {
      return transactionsService.getProtocolAnalytics(args);
    },

    timeSeries: async (
      _: any,
      args: {
        protocolName?: string;
        dateFrom: string;
        dateTo: string;
        granularity: 'hour' | 'day';
      }
    ): Promise<TimeSeriesPoint[]> => {
      return transactionsService.getTimeSeries({
        ...args,
        granularity: args.granularity || 'hour',
      });
    },

    feeAnalytics: async (
      _: any,
      args: {
        protocolName?: string;
        dateFrom?: string;
        dateTo?: string;
      }
    ): Promise<any> => {
      return transactionsService.getFeeAnalytics(args);
    },

    stats: async () => {
      return transactionsService.getStats();
    },
  },
};

