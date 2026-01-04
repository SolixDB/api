import { GraphQLError } from 'graphql';
import { exportService } from '../../services/exportService';
import { jobQueueService } from '../../services/jobQueue';
import { ExportConfig, ExportJob } from '../../types';
import { logger } from '../../services/logger';
import { metrics } from '../../services/metrics';

export const exportResolvers = {
  Mutation: {
    exportDataset: async (_: any, args: { config: any }): Promise<ExportJob> => {
      try {
        // Convert GraphQL input to TypeScript type
        const exportConfig: ExportConfig = {
          format: args.config.format,
          filters: args.config.filters,
          columns: args.config.columns,
          sampling: args.config.sampling,
          splits: args.config.splits,
          preprocessing: args.config.preprocessing,
        };

        // Create export job
        const job = await exportService.createExportJob(exportConfig);

        // Add to queue
        await jobQueueService.addExportJob(job);

        logger.info('Export dataset mutation', { jobId: job.id });
        metrics.exportJobsTotal.inc({ status: 'PENDING' });

        return job;
      } catch (error: any) {
        logger.error('Export dataset mutation error', error);
        throw new GraphQLError(error.message || 'Failed to create export job', {
          extensions: {
            code: 'EXPORT_JOB_CREATION_ERROR',
          },
        });
      }
    },
  },

  Query: {
    exportJob: async (_: any, args: { id: string }): Promise<ExportJob | null> => {
      try {
        const job = await jobQueueService.getJobStatus(args.id);
        if (!job) {
          return null;
        }

        // Generate download URL if completed
        if (job.status === 'COMPLETED' && job.filePath) {
          const filename = job.filePath.split('/').pop() || 'export';
          job.downloadUrl = exportService.generateDownloadUrl(job.id, filename);
        }

        return job;
      } catch (error: any) {
        logger.error('Get export job error', error);
        throw new GraphQLError(error.message || 'Failed to get export job', {
          extensions: {
            code: 'EXPORT_JOB_QUERY_ERROR',
          },
        });
      }
    },
  },
};

