import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

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
    const heapUsedPercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

    this.createChild({
      memory: {
        heapUsedMB,
        heapTotalMB,
        heapUsedPercent,
        rssMB: Math.round(usage.rss / 1024 / 1024),
        externalMB: Math.round(usage.external / 1024 / 1024),
      },
    }).info('Memory usage');

    if (heapUsedPercent > config.memory.rejectThresholdPercent) {
      this.warn(`Memory usage high: ${heapUsedPercent}%`, {
        heapUsedMB,
        heapTotalMB,
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

