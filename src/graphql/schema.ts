import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar Date
  scalar Signature
  scalar ProgramID
  scalar BigInt

  type Transaction {
    signature: Signature!
    slot: BigInt!
    blockTime: BigInt!
    programId: ProgramID!
    protocolName: String!
    instructionType: String!
    fee: BigInt!
    computeUnits: BigInt!
    accountsCount: Int!
    date: Date!
    hour: Int!
    # Aggregation fields (optional, only present when groupBy is used)
    protocol: String
    count: BigInt
    sumFee: BigInt
    avgFee: Float
    minFee: BigInt
    maxFee: BigInt
    p50Fee: Float
    p95Fee: Float
    p99Fee: Float
    sumComputeUnits: BigInt
    avgComputeUnits: Float
    minComputeUnits: BigInt
    maxComputeUnits: BigInt
    p50ComputeUnits: Float
    p95ComputeUnits: Float
    p99ComputeUnits: Float
    sumAccountsCount: BigInt
    avgAccountsCount: Float
    dayOfWeek: Int
    week: Date
    month: Date
  }

  type FailedTransaction {
    signature: Signature!
    slot: BigInt!
    blockTime: BigInt!
    programId: ProgramID!
    protocolName: String!
    instructionType: String!
    fee: BigInt!
    computeUnits: BigInt!
    accountsCount: Int!
    date: Date!
    hour: Int!
    errorMessage: String
    logMessages: String
    rawData: String
  }

  type TransactionEdge {
    node: Transaction!
    cursor: String!
  }

  type FailedTransactionEdge {
    node: FailedTransaction!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type TransactionConnection {
    edges: [TransactionEdge!]!
    nodes: [Transaction!]!
    pageInfo: PageInfo!
    totalCount: Int
  }

  type FailedTransactionConnection {
    edges: [FailedTransactionEdge!]!
    nodes: [FailedTransaction!]!
    pageInfo: PageInfo!
    totalCount: Int
  }

  type AggregationResult {
    count: BigInt
    sumFee: BigInt
    avgFee: Float
    minFee: BigInt
    maxFee: BigInt
    p50Fee: Float
    p95Fee: Float
    p99Fee: Float
    sumComputeUnits: BigInt
    avgComputeUnits: Float
    minComputeUnits: BigInt
    maxComputeUnits: BigInt
    p50ComputeUnits: Float
    p95ComputeUnits: Float
    p99ComputeUnits: Float
    sumAccountsCount: BigInt
    avgAccountsCount: Float
    protocol: String
    hour: Int
    date: Date
    programId: ProgramID
    instructionType: String
    dayOfWeek: Int
    week: Date
    month: Date
  }

  type TimeSeriesPoint {
    timestamp: String!
    value: Float!
    label: String
  }

  type ProtocolStats {
    protocolName: String!
    totalTransactions: BigInt!
    totalFees: BigInt!
    totalComputeUnits: BigInt!
    averageFee: Float!
    averageComputeUnits: Float!
    uniquePrograms: Int!
    dateFrom: Date
    dateTo: Date
  }

  type QueryComplexity {
    score: Float!
    estimatedRows: BigInt!
    baseCost: Float!
    groupByMultiplier: Float!
    aggregationCost: Float!
    recommendations: [String!]
  }

  # Input Types
  input DateRange {
    start: Date!
    end: Date!
  }

  input SlotRange {
    min: BigInt!
    max: BigInt!
  }

  input FeeRange {
    min: BigInt
    max: BigInt
  }

  input ComputeRange {
    min: BigInt
    max: BigInt
  }

  input AccountsCountRange {
    min: Int
    max: Int
  }

  input TransactionFilters {
    protocols: [String!]
    programIds: [ProgramID!]
    signatures: [Signature!]
    dateRange: DateRange
    slotRange: SlotRange
    instructionTypes: [String!]
    success: Boolean
    feeRange: FeeRange
    computeRange: ComputeRange
    accountsCount: AccountsCountRange
    errorPattern: String
    logMessage: String
  }

  enum AggregationMetric {
    COUNT
    SUM_FEE
    AVG_FEE
    MIN_FEE
    MAX_FEE
    P50_FEE
    P95_FEE
    P99_FEE
    SUM_COMPUTE_UNITS
    AVG_COMPUTE_UNITS
    MIN_COMPUTE_UNITS
    MAX_COMPUTE_UNITS
    P50_COMPUTE_UNITS
    P95_COMPUTE_UNITS
    P99_COMPUTE_UNITS
    SUM_ACCOUNTS_COUNT
    AVG_ACCOUNTS_COUNT
  }

  enum GroupByDimension {
    PROTOCOL
    HOUR
    DATE
    PROGRAM_ID
    INSTRUCTION_TYPE
    DAY_OF_WEEK
    WEEK
    MONTH
  }

  enum SortField {
    DATE
    SLOT
    FEE
    COMPUTE_UNITS
    ACCOUNTS_COUNT
    PROTOCOL
    PROGRAM_ID
    INSTRUCTION_TYPE
    # Aggregation sort fields
    COUNT
    AVG_FEE
    SUM_FEE
    P95_FEE
    P99_FEE
  }

  enum SortDirection {
    ASC
    DESC
  }

  input SortInput {
    field: SortField!
    direction: SortDirection!
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  enum TimeBucket {
    HOUR
    DAY
    WEEK
    MONTH
  }

  # Export Types
  enum ExportFormat {
    CSV
    JSONL
    PARQUET
  }

  enum SamplingStrategy {
    RANDOM
    STRATIFIED
  }

  enum ExportJobStatus {
    PENDING
    PROCESSING
    COMPLETED
    FAILED
  }

  type ExportJob {
    id: ID!
    status: ExportJobStatus!
    progress: Float
    rowCount: BigInt
    fileSize: BigInt
    filePath: String
    downloadUrl: String
    error: String
    createdAt: String!
    updatedAt: String!
    completedAt: String
  }

  input SamplingConfig {
    strategy: SamplingStrategy!
    rate: Float!
  }

  input DataSplits {
    train: Float
    test: Float
    val: Float
  }

  input PreprocessingConfig {
    normalize: [String!]
    oneHotEncode: [String!]
  }

  input ExportConfig {
    format: ExportFormat!
    filters: TransactionFilters!
    columns: [String!]!
    sampling: SamplingConfig
    splits: DataSplits
    preprocessing: PreprocessingConfig
  }

  type Query {
    """
    Flexible transactions query with filters, aggregations, grouping, sorting, and pagination
    """
    transactions(
      filters: TransactionFilters
      groupBy: [GroupByDimension!]
      metrics: [AggregationMetric!]
      sort: SortInput
      pagination: PaginationInput
    ): TransactionConnection!

    """
    Flexible failed transactions query with error pattern matching
    """
    failedTransactions(
      filters: TransactionFilters!
      groupBy: [GroupByDimension!]
      metrics: [AggregationMetric!]
      sort: SortInput
      pagination: PaginationInput
    ): FailedTransactionConnection!

    """
    Time series query with flexible temporal aggregations
    """
    timeSeries(
      filters: TransactionFilters
      bucketBy: TimeBucket!
      metrics: [AggregationMetric!] = [COUNT]
      groupBy: [GroupByDimension!]
    ): [TimeSeriesPoint!]!

    """
    Protocol/program stats with dynamic calculation based on filters
    """
    protocolStats(
      filters: TransactionFilters!
    ): ProtocolStats!

    """
    Single transaction lookup by signature
    """
    signature(signature: Signature!): Transaction

    """
    Calculate query complexity before execution
    """
    queryComplexity(
      filters: TransactionFilters!
      groupBy: [GroupByDimension!]
      metrics: [AggregationMetric!]
    ): QueryComplexity!

    """
    Get export job status
    """
    exportJob(id: ID!): ExportJob
  }

  type Mutation {
    """
    Export dataset for ML training
    """
    exportDataset(config: ExportConfig!): ExportJob!
  }
`;

