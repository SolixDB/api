// GraphQL Input Types
export interface DateRange {
  start: string;
  end: string;
}

export interface SlotRange {
  min: number;
  max: number;
}

export interface FeeRange {
  min?: number;
  max?: number;
}

export interface ComputeRange {
  min?: number;
  max?: number;
}

export interface TransactionFilters {
  protocols?: string[];
  programIds?: string[];
  signatures?: string[];
  dateRange?: DateRange;
  slotRange?: SlotRange;
  instructionTypes?: string[];
  success?: boolean;
  feeRange?: FeeRange;
  computeRange?: ComputeRange;
  accountsCount?: {
    min?: number;
    max?: number;
  };
  errorPattern?: string;
  logMessage?: string;
}

export enum AggregationMetric {
  COUNT = 'COUNT',
  SUM_FEE = 'SUM_FEE',
  AVG_FEE = 'AVG_FEE',
  MIN_FEE = 'MIN_FEE',
  MAX_FEE = 'MAX_FEE',
  P50_FEE = 'P50_FEE',
  P95_FEE = 'P95_FEE',
  P99_FEE = 'P99_FEE',
  SUM_COMPUTE_UNITS = 'SUM_COMPUTE_UNITS',
  AVG_COMPUTE_UNITS = 'AVG_COMPUTE_UNITS',
  MIN_COMPUTE_UNITS = 'MIN_COMPUTE_UNITS',
  MAX_COMPUTE_UNITS = 'MAX_COMPUTE_UNITS',
  P50_COMPUTE_UNITS = 'P50_COMPUTE_UNITS',
  P95_COMPUTE_UNITS = 'P95_COMPUTE_UNITS',
  P99_COMPUTE_UNITS = 'P99_COMPUTE_UNITS',
  SUM_ACCOUNTS_COUNT = 'SUM_ACCOUNTS_COUNT',
  AVG_ACCOUNTS_COUNT = 'AVG_ACCOUNTS_COUNT',
}

export enum GroupByDimension {
  PROTOCOL = 'PROTOCOL',
  HOUR = 'HOUR',
  DATE = 'DATE',
  PROGRAM_ID = 'PROGRAM_ID',
  INSTRUCTION_TYPE = 'INSTRUCTION_TYPE',
  DAY_OF_WEEK = 'DAY_OF_WEEK',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

export enum SortField {
  DATE = 'DATE',
  SLOT = 'SLOT',
  FEE = 'FEE',
  COMPUTE_UNITS = 'COMPUTE_UNITS',
  ACCOUNTS_COUNT = 'ACCOUNTS_COUNT',
  PROTOCOL = 'PROTOCOL',
  PROGRAM_ID = 'PROGRAM_ID',
  INSTRUCTION_TYPE = 'INSTRUCTION_TYPE',
}

export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export interface SortInput {
  field: SortField;
  direction: SortDirection;
}

export interface PaginationInput {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

// Transaction type is defined by GraphQL schema, not TypeScript
// Using any here since GraphQL handles type validation
export interface TransactionEdge {
  node: any;
  cursor: string;
}

export interface TransactionConnection {
  edges: TransactionEdge[];
  nodes: any[];
  pageInfo: PageInfo;
  totalCount?: number;
}

export interface FailedTransactionEdge {
  node: any;
  cursor: string;
}

export interface FailedTransactionConnection {
  edges: FailedTransactionEdge[];
  nodes: any[];
  pageInfo: PageInfo;
  totalCount?: number;
}

export interface QueryComplexity {
  score: number;
  estimatedRows: number;
  baseCost: number;
  groupByMultiplier: number;
  aggregationCost: number;
  recommendations?: string[];
}

// Export Types
export enum ExportFormat {
  CSV = 'CSV',
  JSONL = 'JSONL',
  PARQUET = 'PARQUET',
}

export enum SamplingStrategy {
  RANDOM = 'RANDOM',
  STRATIFIED = 'STRATIFIED',
}

export interface SamplingConfig {
  strategy: SamplingStrategy;
  rate: number;
}

export interface DataSplits {
  train?: number;
  test?: number;
  val?: number;
}

export interface PreprocessingConfig {
  normalize?: string[];
  oneHotEncode?: string[];
}

export interface ExportConfig {
  format: ExportFormat;
  filters: TransactionFilters;
  columns: string[];
  sampling?: SamplingConfig;
  splits?: DataSplits;
  preprocessing?: PreprocessingConfig;
}

export enum ExportJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface ExportJob {
  id: string;
  status: ExportJobStatus;
  config: ExportConfig;
  progress?: number;
  rowCount?: number;
  fileSize?: number;
  filePath?: string;
  downloadUrl?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

