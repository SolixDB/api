import { gql } from 'graphql-tag';

export const typeDefs = gql`
  type Transaction {
    signature: String!
    slot: Int!
    blockTime: Int!
    programId: String!
    protocolName: String!
    instructionType: String!
    fee: Int!
    computeUnits: Int!
    accountsCount: Int!
    date: String!
    hour: Int!
  }

  type ProtocolAnalytics {
    protocolName: String!
    totalTransactions: Int!
    totalFees: Int!
    totalComputeUnits: Int!
    averageFee: Float!
    averageComputeUnits: Float!
    uniquePrograms: Int!
    dateFrom: String
    dateTo: String
  }

  type TimeSeriesPoint {
    timestamp: String!
    value: Int!
    label: String
  }

  type FeeAnalytics {
    minFee: Int!
    maxFee: Int!
    avgFee: Float!
    medianFee: Float!
    p95Fee: Float!
    p99Fee: Float!
    totalFees: Int!
  }

  type Stats {
    totalTransactions: Int!
    totalFailedTransactions: Int!
    dateRange: DateRange!
    protocols: [ProtocolCount!]!
  }

  type DateRange {
    from: String!
    to: String!
  }

  type ProtocolCount {
    name: String!
    count: Int!
  }

  type Query {
    transactions(
      protocolName: String
      programId: String
      dateFrom: String
      dateTo: String
      signature: String
      limit: Int = 100
      offset: Int = 0
    ): [Transaction!]!

    transaction(signature: String!): Transaction

    protocolAnalytics(
      protocolName: String!
      dateFrom: String
      dateTo: String
    ): ProtocolAnalytics!

    timeSeries(
      protocolName: String
      dateFrom: String!
      dateTo: String!
      granularity: String! = "hour"
    ): [TimeSeriesPoint!]!

    feeAnalytics(
      protocolName: String
      dateFrom: String
      dateTo: String
    ): FeeAnalytics!

    stats: Stats!
  }
`;

