import { logger } from './logger';
import { createClient } from '@supabase/supabase-js';

export interface CreditInfo {
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  plan: 'free' | 'x402' | 'enterprise';
}

export class CreditTracker {
  private getPlanCredits(plan: 'free' | 'x402' | 'enterprise'): number {
    switch (plan) {
      case 'free':
        return 1000;
      case 'x402':
        return 25000;
      case 'enterprise':
        return 100000;
      default:
        return 1000;
    }
  }

  private getCurrentMonth(): string {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  }

  private getClient() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async checkCredits(userId: string, plan: 'free' | 'x402' | 'enterprise'): Promise<{
    hasCredits: boolean;
    creditInfo: CreditInfo;
  }> {
    try {
      const client = this.getClient();
      const monthStr = this.getCurrentMonth();
      const totalCredits = this.getPlanCredits(plan);

      // Only read existing monthly credits record (don't create)
      const { data: existingCredits, error: selectError } = await client
        .from('monthly_credits')
        .select('*')
        .eq('user_id', userId)
        .eq('month', monthStr)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        // PGRST116 is "not found" - expected for new month, not an error
        logger.error('Error checking credits', selectError as Error, { userId, monthStr });
        // On error, allow the request but log it
        // This prevents credit system from blocking legitimate requests
        return {
          hasCredits: true,
          creditInfo: {
            totalCredits,
            usedCredits: 0,
            remainingCredits: totalCredits,
            plan,
          },
        };
      }

      // If no record exists, assume 0 used credits (will be created on first deduction)
      const usedCredits = existingCredits?.used_credits || 0;
      const remainingCredits = totalCredits - usedCredits;
      const hasCredits = remainingCredits > 0;

      return {
        hasCredits,
        creditInfo: {
          totalCredits,
          usedCredits,
          remainingCredits,
          plan,
        },
      };
    } catch (error) {
      logger.error('Error checking credits', error as Error, { userId });
      // On error, allow the request but log it
      // This prevents credit system from blocking legitimate requests
      const totalCredits = this.getPlanCredits(plan);
      return {
        hasCredits: true, // Allow request on error
        creditInfo: {
          totalCredits,
          usedCredits: 0,
          remainingCredits: totalCredits,
          plan,
        },
      };
    }
  }

  /**
   * Deduct credits asynchronously (non-blocking)
   * This method returns immediately and processes credits in the background
   * to avoid delaying API responses
   */
  deductCredits(
    userId: string,
    apiKeyId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs: number,
    creditsUsed: number = 1,
    errorMessage?: string
  ): void {
    // Fire and forget - don't await, process in background
    this.deductCreditsAsync(userId, apiKeyId, endpoint, method, statusCode, responseTimeMs, creditsUsed, errorMessage)
      .catch((error) => {
        // Log errors but don't throw - credit tracking shouldn't break the API
        logger.error('Error in background credit deduction', error as Error, {
          userId,
          apiKeyId,
          endpoint,
        });
      });
  }

  /**
   * Internal async method that actually performs the credit deduction
   */
  private async deductCreditsAsync(
    userId: string,
    apiKeyId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs: number,
    creditsUsed: number = 1,
    errorMessage?: string
  ): Promise<void> {
    try {
      const client = this.getClient();
      const monthStr = this.getCurrentMonth();

      // Insert usage log
      const { error: logError } = await client
        .from('usage_logs')
        .insert({
          user_id: userId,
          api_key_id: apiKeyId,
          endpoint,
          method,
          status_code: statusCode,
          response_time_ms: responseTimeMs,
          credits_used: creditsUsed,
          error_message: errorMessage,
        });

      if (logError) {
        logger.error('Error logging usage', logError as Error, {
          userId,
          apiKeyId,
          endpoint,
        });
        // Don't throw - logging failure shouldn't break the API
      }

      // Update monthly credits (only if request was successful)
      if (statusCode >= 200 && statusCode < 300 && creditsUsed > 0) {
        logger.debug('Processing credit deduction', {
          userId,
          monthStr,
          statusCode,
          creditsUsed,
        });
      } else {
        logger.debug('Skipping credit update', {
          userId,
          monthStr,
          statusCode,
          creditsUsed,
          reason: statusCode < 200 || statusCode >= 300 ? 'unsuccessful_status' : 'no_credits_to_deduct',
        });
      }

      if (statusCode >= 200 && statusCode < 300 && creditsUsed > 0) {

        // Get user plan to determine total credits
        const { data: user } = await client
          .from('users')
          .select('plan')
          .eq('id', userId)
          .single();

        if (!user) {
          logger.error('User not found when updating credits', new Error('User not found'), {
            userId,
            monthStr,
          });
          return;
        }

        const totalCredits = this.getPlanCredits(user.plan as 'free' | 'x402' | 'enterprise');

        // Check if record exists
        const { data: existingCredits, error: selectError } = await client
          .from('monthly_credits')
          .select('used_credits')
          .eq('user_id', userId)
          .eq('month', monthStr)
          .single();

        // PGRST116 is "not found" - expected when no record exists
        const recordExists = existingCredits && (!selectError || selectError.code !== 'PGRST116');

        if (recordExists && existingCredits) {
          // Update existing record by incrementing used_credits
          const newUsedCredits = (existingCredits.used_credits || 0) + creditsUsed;
          
          logger.debug('Updating monthly credits', {
            userId,
            monthStr,
            oldUsedCredits: existingCredits.used_credits || 0,
            creditsUsed,
            newUsedCredits,
          });

          const { data: updatedData, error: updateError } = await client
            .from('monthly_credits')
            .update({
              used_credits: newUsedCredits,
            })
            .eq('user_id', userId)
            .eq('month', monthStr)
            .select('used_credits')
            .single();

          if (updateError) {
            logger.error('Error updating monthly credits', updateError as Error, {
              userId,
              monthStr,
              usedCredits: existingCredits.used_credits,
              creditsUsed,
            });
          } else if (updatedData) {
            logger.info('Successfully updated monthly credits', {
              userId,
              monthStr,
              oldUsedCredits: existingCredits.used_credits || 0,
              creditsUsed,
              newUsedCredits: updatedData.used_credits,
            });
          } else {
            logger.warn('Update completed but no data returned', {
              userId,
              monthStr,
              newUsedCredits,
            });
          }
        } else {
          // Record doesn't exist, create it
          // Since duplicates are prevented at DB level, simple insert is safe
          logger.debug('Creating new monthly credits record', {
            userId,
            monthStr,
            plan: user.plan,
            totalCredits,
            creditsUsed,
          });

          const { error: insertError } = await client
            .from('monthly_credits')
            .insert({
              user_id: userId,
              month: monthStr,
              plan: user.plan,
              total_credits: totalCredits,
              used_credits: creditsUsed,
            });

          if (insertError) {
            // If insert fails (e.g., race condition), try to update instead
            if (insertError.code === '23505') {
              // Duplicate key - record was created by another request, update it
              const { data: raceConditionCredits } = await client
                .from('monthly_credits')
                .select('used_credits')
                .eq('user_id', userId)
                .eq('month', monthStr)
                .single();

              if (raceConditionCredits) {
                const { error: updateError } = await client
                  .from('monthly_credits')
                  .update({
                    used_credits: (raceConditionCredits.used_credits || 0) + creditsUsed,
                  })
                  .eq('user_id', userId)
                  .eq('month', monthStr);

                if (updateError) {
                  logger.error('Error updating monthly credits after race condition', updateError as Error, {
                    userId,
                    monthStr,
                  });
                }
              }
            } else {
              logger.error('Error inserting monthly credits', insertError as Error, {
                userId,
                monthStr,
              });
            }
          }
        }
      }

      // Update API key last_used_at
      await client
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', apiKeyId);
    } catch (error) {
      logger.error('Error deducting credits', error as Error, {
        userId,
        apiKeyId,
        endpoint,
      });
      // Don't throw - credit deduction failure shouldn't break the API response
    }
  }

  async getCreditInfo(userId: string, plan: 'free' | 'x402' | 'enterprise'): Promise<CreditInfo> {
    try {
      const client = this.getClient();
      const monthStr = this.getCurrentMonth();
      const totalCredits = this.getPlanCredits(plan);

      const { data: existingCredits } = await client
        .from('monthly_credits')
        .select('*')
        .eq('user_id', userId)
        .eq('month', monthStr)
        .single();

      const usedCredits = existingCredits?.used_credits || 0;

      return {
        totalCredits,
        usedCredits,
        remainingCredits: totalCredits - usedCredits,
        plan,
      };
    } catch (error) {
      logger.error('Error getting credit info', error as Error, { userId });
      const totalCredits = this.getPlanCredits(plan);
      return {
        totalCredits,
        usedCredits: 0,
        remainingCredits: totalCredits,
        plan,
      };
    }
  }

  /**
   * Reset credits for all users at the start of a new month
   * Creates new monthly_credits records with used_credits = 0 for the current month
   */
  async resetMonthlyCredits(): Promise<void> {
    try {
      const client = this.getClient();
      const monthStr = this.getCurrentMonth();
      
      logger.info('Starting monthly credit reset', { monthStr });

      // Get all active users
      const { data: users, error: usersError } = await client
        .from('users')
        .select('id, plan');

      if (usersError) {
        logger.error('Error fetching users for credit reset', usersError as Error);
        throw usersError;
      }

      if (!users || users.length === 0) {
        logger.info('No users found for credit reset');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      // Reset credits for each user
      for (const user of users) {
        try {
          const totalCredits = this.getPlanCredits(user.plan as 'free' | 'x402' | 'enterprise');

          // Check if record already exists for this month
          const { data: existingCredits } = await client
            .from('monthly_credits')
            .select('id')
            .eq('user_id', user.id)
            .eq('month', monthStr)
            .single();

          if (existingCredits) {
            // Update existing record to reset used_credits to 0
            const { error: updateError } = await client
              .from('monthly_credits')
              .update({
                used_credits: 0,
                total_credits: totalCredits, // Update total in case plan changed
                plan: user.plan,
              })
              .eq('id', existingCredits.id);

            if (updateError) {
              logger.error('Error updating credits for user', updateError as Error, {
                userId: user.id,
                monthStr,
              });
              errorCount++;
            } else {
              successCount++;
            }
          } else {
            // Create new record for this month
            const { error: insertError } = await client
              .from('monthly_credits')
              .insert({
                user_id: user.id,
                month: monthStr,
                plan: user.plan,
                total_credits: totalCredits,
                used_credits: 0,
              });

            if (insertError) {
              logger.error('Error creating credits for user', insertError as Error, {
                userId: user.id,
                monthStr,
              });
              errorCount++;
            } else {
              successCount++;
            }
          }
        } catch (error) {
          logger.error('Error processing user credit reset', error as Error, {
            userId: user.id,
          });
          errorCount++;
        }
      }

      logger.info('Monthly credit reset completed', {
        monthStr,
        totalUsers: users.length,
        successCount,
        errorCount,
      });
    } catch (error) {
      logger.error('Error resetting monthly credits', error as Error);
      throw error;
    }
  }
}

export const creditTracker = new CreditTracker();
