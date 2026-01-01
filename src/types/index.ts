export interface Transaction {
  signature: string;
  slot: number;
  blockTime: number;
  programId: string;
  protocolName: string;
  instructionType: string;
  fee: number;
  computeUnits: number;
  accountsCount: number;
  date: string;
  hour: number;
}

export interface FailedTransaction extends Transaction {
  rawData?: string;
  errorMessage?: string;
  logMessages?: string;
}

export interface ProtocolAnalytics {
  protocolName: string;
  totalTransactions: number;
  totalFees: number;
  totalComputeUnits: number;
  averageFee: number;
  averageComputeUnits: number;
  uniquePrograms: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface Stats {
  totalTransactions: number;
  totalFailedTransactions: number;
  dateRange: {
    from: string;
    to: string;
  };
  protocols: Array<{
    name: string;
    count: number;
  }>;
}

