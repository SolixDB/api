import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import v8 from 'v8';

export interface LoggerContext {
  correlationId?: string;
  querySignature?: string;
  complexity?: number;
  estimatedRows?: number;
  executionTime?: number;
  [key: string]: any;
}

class LoggerService {
  private logger: pino.Logger;
  private correlationId: string | undefined;

  constructor() {
    this.logger = pino({
      level: config.server.nodeEnv === 'production' ? 'info' : 'debug',
      transport:
        config.server.nodeEnv !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
              },
            }
          : undefined,
    });
  }

  setCorrelationId(id: string) {
    this.correlationId = id;
  }

  getCorrelationId(): string {
    if (!this.correlationId) {
      this.correlationId = uuidv4();
    }
    return this.correlationId;
  }

  private createChild(context: LoggerContext): pino.Logger {
    return this.logger.child({
      correlationId: context.correlationId || this.correlationId || uuidv4(),
      ...context,
    });
  }

  info(message: string, context?: LoggerContext) {
    this.createChild(context || {}).info(message);
  }

  error(message: string, error?: Error, context?: LoggerContext) {
    const child = this.createChild(context || {});
    if (error) {
      child.error({ err: error, stack: error.stack }, message);
    } else {
      child.error(message);
    }
  }

  warn(message: string, context?: LoggerContext) {
    this.createChild(context || {}).warn(message);
  }

  debug(message: string, context?: LoggerContext) {
    this.createChild(context || {}).debug(message);
  }

  logQuery(
    query: string,
    complexity: number,
    estimatedRows: number,
    executionTime: number,
    context?: LoggerContext
  ) {
    const child = this.createChild({
      ...context,
      querySignature: this.getQuerySignature(query),
      complexity,
      estimatedRows,
      executionTime,
    });

    if (executionTime > 2000) {
      child.warn('Slow query detected', {
        query: query.substring(0, 500), // Truncate for logging
      });
    } else {
      child.info('Query executed', {
        query: query.substring(0, 500),
      });
    }
  }

  logMemoryUsage() {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);
    const externalMB = Math.round(usage.external / 1024 / 1024);
    
    // Get max heap limit for more meaningful percentage
    const heapStats = v8.getHeapStatistics();
    const maxHeapMB = Math.round(heapStats.heap_size_limit / 1024 / 1024);
    
    // Percentage of currently allocated heap (can be high when heap is small)
    const heapUsedPercentOfAllocated = Math.round((usage.heapUsed / usage.heapTotal) * 100);
    // Percentage of max heap limit (more meaningful metric)
    const heapUsedPercentOfMax = Math.round((usage.heapUsed / heapStats.heap_size_limit) * 100);

    // Create a human-readable summary
    const summary = `Heap: ${heapUsedMB}MB used / ${heapTotalMB}MB allocated / ${maxHeapMB}MB max | ${heapUsedPercentOfAllocated}% of allocated, ${heapUsedPercentOfMax.toFixed(2)}% of max | RSS: ${rssMB}MB`;

    this.info('Memory usage', {
      heap: {
        usedMB: heapUsedMB,
        allocatedMB: heapTotalMB,
        maxMB: maxHeapMB,
        usedPercentOfAllocated: heapUsedPercentOfAllocated,
        usedPercentOfMax: parseFloat(heapUsedPercentOfMax.toFixed(2)),
      },
      rssMB,
      externalMB,
      summary,
    });

    // Only warn if heap is actually large (> 1GB) and usage is high
    // Use max heap percentage for warnings, not allocated heap percentage
    const isLargeHeap = maxHeapMB > 1024;
    if (isLargeHeap && heapUsedPercentOfMax > config.memory.rejectThresholdPercent) {
      this.warn(`Memory usage high: ${heapUsedPercentOfMax.toFixed(2)}% of max heap (${heapUsedMB}MB / ${maxHeapMB}MB)`, {
        heapUsedMB,
        heapTotalMB,
        maxHeapMB,
        heapUsedPercentOfMax: parseFloat(heapUsedPercentOfMax.toFixed(2)),
        threshold: config.memory.rejectThresholdPercent,
      });
    } else if (maxHeapMB < 100 && heapUsedPercentOfAllocated > config.memory.rejectThresholdPercent) {
      // For small heaps, just log at debug level (not warning)
      this.debug(`Small heap with high usage (configuration issue): ${heapUsedPercentOfAllocated}% of allocated`, {
        heapUsedMB,
        heapTotalMB,
        maxHeapMB,
        note: 'This is likely due to NODE_OPTIONS not being set. Requests will not be rejected.',
      });
    }
  }

  private getQuerySignature(query: string): string {
    // Create a simple signature from the query structure
    const normalized = query
      .replace(/\s+/g, ' ')
      .replace(/\{[^}]+\}/g, '?')
      .toLowerCase()
      .trim();
    return normalized.substring(0, 100);
  }
}

export const logger = new LoggerService();

