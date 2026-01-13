import cron from 'node-cron';
import { creditTracker } from './creditTracker';
import { logger } from './logger';

/**
 * Cron scheduler service
 * Handles scheduled tasks like monthly credit resets
 */
export class CronScheduler {
  private tasks: cron.ScheduledTask[] = [];

  /**
   * Start all scheduled tasks
   */
  start(): void {
    // Reset credits on the 1st day of every month at 00:00 UTC
    // Cron format: minute hour day month day-of-week
    // '0 0 1 * *' = At 00:00 on day-of-month 1
    const creditResetTask = cron.schedule('0 0 1 * *', async () => {
      logger.info('Monthly credit reset cron job triggered');
      try {
        await creditTracker.resetMonthlyCredits();
        logger.info('Monthly credit reset completed successfully');
      } catch (error) {
        logger.error('Monthly credit reset cron job failed', error as Error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC',
    });

    this.tasks.push(creditResetTask);
    logger.info('Cron scheduler started - Monthly credit reset scheduled for 1st of each month at 00:00 UTC');
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    logger.info('Cron scheduler stopped');
  }
}

export const cronScheduler = new CronScheduler();
