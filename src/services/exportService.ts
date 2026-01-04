import * as fs from 'fs';
import * as path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { clickhouseService } from './clickhouse';
import { config } from '../config';
import { logger } from './logger';
import { metrics } from './metrics';
import { ExportConfig, ExportFormat, ExportJob, ExportJobStatus } from '../types';
import { graphqlQueryBuilder } from './graphqlQueryBuilder';
import { v4 as uuidv4 } from 'uuid';

export class ExportService {
  /**
   * Check available disk space
   */
  private async checkDiskSpace(): Promise<{ available: number; sufficient: boolean }> {
    try {
      // Ensure export directory exists
      if (!fs.existsSync(config.export.dir)) {
        fs.mkdirSync(config.export.dir, { recursive: true });
      }

      // Use a simple approach: try to write a test file
      // In production, you might want to use a library like 'check-disk-space'
      const testFile = path.join(config.export.dir, '.space-check');
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      } catch {
        // If we can't write, assume insufficient space
        return { available: 0, sufficient: false };
      }

      // For now, assume sufficient space if we can write
      // In production, use a proper disk space checking library
      const available = config.export.minFreeSpaceGB * 2; // Conservative estimate
      const sufficient = true;

      // Update metrics with a placeholder value
      metrics.diskSpaceAvailable.set({ path: config.export.dir }, available * 1024 * 1024 * 1024);

      return {
        available,
        sufficient,
      };
    } catch (error) {
      logger.error('Failed to check disk space', error as Error);
      return { available: 0, sufficient: false };
    }
  }

  /**
   * Get total size of export directory
   */
  private async getExportDirectorySize(): Promise<number> {
    try {
      let totalSize = 0;

      const files = fs.readdirSync(config.export.dir, { withFileTypes: true });
      for (const file of files) {
        const filePath = path.join(config.export.dir, file.name);
        if (file.isDirectory()) {
          const subFiles = fs.readdirSync(filePath, { recursive: true });
          for (const subFile of subFiles) {
            const subFilePath = path.join(filePath, subFile as string);
            try {
              const stats = fs.statSync(subFilePath);
              totalSize += stats.size;
            } catch {
              // Skip files that can't be accessed
            }
          }
        } else {
          try {
            const stats = fs.statSync(filePath);
            totalSize += stats.size;
          } catch {
            // Skip files that can't be accessed
          }
        }
      }

      return totalSize / (1024 * 1024 * 1024); // Return in GB
    } catch (error) {
      logger.error('Failed to get export directory size', error as Error);
      return 0;
    }
  }

  /**
   * Cleanup old files (FIFO)
   */
  private async cleanupOldFiles(): Promise<number> {
    try {
      const files: Array<{ path: string; mtime: number }> = [];

      const dirs = fs.readdirSync(config.export.dir, { withFileTypes: true });
      for (const dir of dirs) {
        if (dir.isDirectory()) {
          const dirPath = path.join(config.export.dir, dir.name);
          const subFiles = fs.readdirSync(dirPath, { recursive: true });
          for (const subFile of subFiles) {
            const filePath = path.join(dirPath, subFile as string);
            try {
              const stats = fs.statSync(filePath);
              files.push({ path: filePath, mtime: stats.mtime.getTime() });
            } catch {
              // Skip files that can't be accessed
            }
          }
        }
      }

      // Sort by modification time (oldest first)
      files.sort((a, b) => a.mtime - b.mtime);

      let deletedCount = 0;
      let freedSpace = 0;

      for (const file of files) {
        try {
          const stats = fs.statSync(file.path);
          const fileSize = stats.size;
          fs.unlinkSync(file.path);
          deletedCount++;
          freedSpace += fileSize;

          // Check if we've freed enough space
          const currentSize = await this.getExportDirectorySize();
          if (currentSize < config.export.maxTotalSizeGB * 0.8) {
            break;
          }
        } catch (error) {
          logger.warn('Failed to delete file', { file: file.path, error });
        }
      }

      logger.info('Export cleanup completed', { deletedCount, freedSpaceGB: freedSpace / (1024 * 1024 * 1024) });
      return deletedCount;
    } catch (error) {
      logger.error('Export cleanup error', error as Error);
      return 0;
    }
  }

  /**
   * Create export job
   */
  async createExportJob(exportConfig: ExportConfig): Promise<ExportJob> {
    // Check disk space
    const { available, sufficient } = await this.checkDiskSpace();
    if (!sufficient) {
      throw new Error(
        `Insufficient disk space. Available: ${available.toFixed(2)}GB, Required: ${config.export.minFreeSpaceGB}GB`
      );
    }

    // Check total directory size
    const totalSize = await this.getExportDirectorySize();
    if (totalSize > config.export.maxTotalSizeGB) {
      // Cleanup old files
      await this.cleanupOldFiles();
    }

    const jobId = uuidv4();
    const job: ExportJob = {
      id: jobId,
      status: ExportJobStatus.PENDING,
      config: exportConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    metrics.exportJobsTotal.inc({ status: ExportJobStatus.PENDING });

    return job;
  }

  /**
   * Process export job
   */
  async processExportJob(job: ExportJob): Promise<ExportJob> {
    const startTime = Date.now();
    job.status = ExportJobStatus.PROCESSING;
    job.updatedAt = new Date();

    try {
      // Create job directory
      const jobDir = path.join(config.export.dir, job.id);
      fs.mkdirSync(jobDir, { recursive: true });

      // Determine file extension
      const extension = job.config.format.toLowerCase();
      const filename = `export.${extension}.gz`;
      const filePath = path.join(jobDir, filename);

      // Build query
      const { query, queryParams } = graphqlQueryBuilder.buildQuery({
        filters: job.config.filters,
        table: 'transactions',
        limit: 50000, // Process in chunks
      });

      // Determine ClickHouse format
      let clickhouseFormat: string;
      switch (job.config.format) {
        case ExportFormat.CSV:
          clickhouseFormat = 'CSV';
          break;
        case ExportFormat.JSONL:
          clickhouseFormat = 'JSONEachRow';
          break;
        case ExportFormat.PARQUET:
          clickhouseFormat = 'Parquet';
          break;
        default:
          clickhouseFormat = 'CSV';
      }

      // Create write stream with gzip
      const writeStream = fs.createWriteStream(filePath);
      const gzipStream = createGzip();

      let rowCount = 0;
      let offset = 0;

        // Process in chunks
        let hasMore = true;
        while (hasMore) {
          const chunkQuery = `${query} OFFSET {offset:UInt64}`;
          const chunkParams = { ...queryParams, offset };

          // Query ClickHouse with native format
          const result = await clickhouseService.query<any>(
            chunkQuery.replace('JSONEachRow', clickhouseFormat),
            chunkParams,
            600 // 10 minutes per chunk
          );

          // Convert result to stream and write
          const resultStream = Readable.from(JSON.stringify(result));
          await pipeline(resultStream, gzipStream, writeStream);

          const chunkRows = result.length;
          rowCount += chunkRows;
          offset += chunkRows;

          job.progress = Math.min(100, (rowCount / (job.rowCount || 1000000)) * 100);
          job.updatedAt = new Date();

          // Check if we've processed all rows
          if (chunkRows < 50000) {
            hasMore = false;
          }
        }

      writeStream.end();

      // Get file size
      const stats = fs.statSync(filePath);
      job.fileSize = stats.size;
      job.filePath = filePath;
      job.rowCount = rowCount;
      job.status = ExportJobStatus.COMPLETED;
      job.completedAt = new Date();
      job.updatedAt = new Date();

      const executionTime = Date.now() - startTime;
      metrics.exportJobDuration.observe({ format: job.config.format }, executionTime / 1000);
      metrics.exportFileSize.observe({ format: job.config.format }, job.fileSize);
      metrics.exportJobsTotal.inc({ status: ExportJobStatus.COMPLETED });

      logger.info('Export job completed', {
        jobId: job.id,
        rowCount,
        fileSize: job.fileSize,
        executionTime,
      });

      return job;
    } catch (error) {
      job.status = ExportJobStatus.FAILED;
      job.error = (error as Error).message;
      job.updatedAt = new Date();

      metrics.exportJobsTotal.inc({ status: ExportJobStatus.FAILED });
      logger.error('Export job failed', error as Error, { jobId: job.id });

      throw error;
    }
  }

  /**
   * Generate signed download URL
   */
  generateDownloadUrl(jobId: string, filename: string): string {
    // In production, use JWT for signed URLs
    // For now, return a simple path
    return `/exports/${jobId}/${filename}`;
  }

  /**
   * Cleanup expired exports
   */
  async cleanupExpiredExports(): Promise<number> {
    const expirationTime = Date.now() - config.export.expirationHours * 60 * 60 * 1000;
    let deletedCount = 0;

    try {
      const dirs = fs.readdirSync(config.export.dir, { withFileTypes: true });
      for (const dir of dirs) {
        if (dir.isDirectory()) {
          const dirPath = path.join(config.export.dir, dir.name);
          try {
            const stats = fs.statSync(dirPath);
            if (stats.mtime.getTime() < expirationTime) {
              fs.rmSync(dirPath, { recursive: true, force: true });
              deletedCount++;
            }
          } catch {
            // Skip directories that can't be accessed
          }
        }
      }

      logger.info('Expired exports cleanup completed', { deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Expired exports cleanup error', error as Error);
      return 0;
    }
  }
}

export const exportService = new ExportService();

