import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';
import { exportService } from './exportService';
import { ExportJob, ExportJobStatus } from '../types';
import { logger } from './logger';

export class JobQueueService {
  private exportQueue: Queue;
  private exportWorker: Worker;

  constructor() {
    const connection = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
    };

    // Create queue
    this.exportQueue = new Queue('export-dataset', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    // Create worker
    this.exportWorker = new Worker(
      'export-dataset',
      async (job: Job) => {
        const exportJob = job.data as ExportJob;
        logger.info('Processing export job', { jobId: exportJob.id });

        // Update job progress
        await job.updateProgress(0);

        // Process export
        const result = await exportService.processExportJob(exportJob);

        // Update job progress
        await job.updateProgress(100);

        return result;
      },
      {
        connection,
        concurrency: 2, // Process 2 exports concurrently
      }
    );

    // Worker event handlers
    this.exportWorker.on('completed', (job) => {
      logger.info('Export job completed', { jobId: job.id });
    });

    this.exportWorker.on('failed', (job, err) => {
      logger.error('Export job failed', err, { jobId: job?.id });
    });

    this.exportWorker.on('error', (err) => {
      logger.error('Export worker error', err);
    });
  }

  /**
   * Add export job to queue
   */
  async addExportJob(exportJob: ExportJob): Promise<string> {
    const job = await this.exportQueue.add('export-dataset', exportJob, {
      jobId: exportJob.id,
    });

    logger.info('Export job added to queue', { jobId: exportJob.id, queueId: job.id });
    return job.id!;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<ExportJob | null> {
    try {
      const job = await this.exportQueue.getJob(jobId);
      if (!job) {
        return null;
      }

      const state = await job.getState();
      const progress = job.progress as number;

      const exportJob = job.data as ExportJob;
      exportJob.status = this.mapJobStateToStatus(state);
      exportJob.progress = progress;

      return exportJob;
    } catch (error) {
      logger.error('Failed to get job status', error as Error, { jobId });
      return null;
    }
  }

  /**
   * Map BullMQ job state to ExportJobStatus
   */
  private mapJobStateToStatus(state: string): ExportJobStatus {
    switch (state) {
      case 'waiting':
      case 'delayed':
        return ExportJobStatus.PENDING;
      case 'active':
        return ExportJobStatus.PROCESSING;
      case 'completed':
        return ExportJobStatus.COMPLETED;
      case 'failed':
        return ExportJobStatus.FAILED;
      default:
        return ExportJobStatus.PENDING;
    }
  }

  /**
   * Cleanup on shutdown
   */
  async close() {
    await this.exportWorker.close();
    await this.exportQueue.close();
  }
}

export const jobQueueService = new JobQueueService();

