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
    logger.info('🔵 deductCredits called', {
      userId,
      apiKeyId,
      endpoint,
      method,
      statusCode,
      responseTimeMs,
      creditsUsed,
      errorMessage,
    });

    // Fire and forget - don't await, process in background
    this.deductCreditsAsync(userId, apiKeyId, endpoint, method, statusCode, responseTimeMs, creditsUsed, errorMessage)
      .catch((error) => {
        // Log errors but don't throw - credit tracking shouldn't break the API
        logger.error('❌ Error in background credit deduction', error as Error, {
          userId,
          apiKeyId,
          endpoint,
          statusCode,
          creditsUsed,
        });
      });
  }

  /**
   * Internal async method that actually performs the credit deduction
   * Simplified: Get user, get monthly credits, increment used_credits by 1
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
    const startTime = Date.now();
    logger.info('🟢 deductCreditsAsync started', {
      userId,
      apiKeyId,
      endpoint,
      method,
      statusCode,
      responseTimeMs,
      creditsUsed,
      errorMessage,
    });

    try {
      const client = this.getClient();
      const monthStr = this.getCurrentMonth();
      logger.info('📅 Current month string', { monthStr });

      // Only increment credits for successful requests
      if (statusCode >= 200 && statusCode < 300 && creditsUsed > 0) {
        logger.info('✅ Processing credit deduction (successful request)', {
          userId,
          statusCode,
          creditsUsed,
        });

        // Get user to get their plan
        logger.info('👤 Fetching user', { userId });
        const { data: user, error: userError } = await client
          .from('users')
          .select('plan')
          .eq('id', userId)
          .single();

        if (userError) {
          logger.error('❌ Error fetching user', userError as Error, {
            userId,
            monthStr,
            errorCode: (userError as any).code,
            errorMessage: (userError as any).message,
          });
          return;
        }

        if (!user) {
          logger.error('❌ User not found when updating credits', new Error('User not found'), {
            userId,
            monthStr,
          });
          return;
        }

        logger.info('👤 User found', {
          userId,
          plan: user.plan,
        });

        // Get monthly credits record
        logger.info('💰 Fetching monthly credits', {
          userId,
          monthStr,
        });
        const { data: monthlyCredits, error: creditsError } = await client
          .from('monthly_credits')
          .select('used_credits, id, total_credits')
          .eq('user_id', userId)
          .eq('month', monthStr)
          .single();

        if (creditsError) {
          const errorCode = (creditsError as any).code;
          logger.info('📊 Monthly credits query result', {
            userId,
            monthStr,
            errorCode,
            isNotFound: errorCode === 'PGRST116',
            errorMessage: (creditsError as any).message,
          });
        }

        if (monthlyCredits) {
          // Record exists - increment used_credits by 1
          const oldUsedCredits = monthlyCredits.used_credits || 0;
          const newUsedCredits = oldUsedCredits + 1;

          logger.info('📈 Updating existing monthly credits record', {
            userId,
            monthStr,
            recordId: monthlyCredits.id,
            oldUsedCredits,
            newUsedCredits,
            totalCredits: monthlyCredits.total_credits,
          });

          const { data: updatedData, error: updateError } = await client
            .from('monthly_credits')
            .update({
              used_credits: newUsedCredits,
            })
            .eq('id', monthlyCredits.id)
            .select('used_credits, total_credits')
            .single();

          if (updateError) {
            logger.error('❌ Error updating monthly credits', updateError as Error, {
              userId,
              monthStr,
              recordId: monthlyCredits.id,
              oldUsedCredits,
              newUsedCredits,
              errorCode: (updateError as any).code,
              errorMessage: (updateError as any).message,
            });
          } else {
            logger.info('✅ Successfully updated monthly credits', {
              userId,
              monthStr,
              recordId: monthlyCredits.id,
              oldUsedCredits,
              newUsedCredits: updatedData?.used_credits,
              totalCredits: updatedData?.total_credits,
            });
          }
        } else {
          // Record doesn't exist - create it with used_credits = 1
          const totalCredits = this.getPlanCredits(user.plan as 'free' | 'x402' | 'enterprise');
          
          logger.info('🆕 Creating new monthly credits record', {
            userId,
            monthStr,
            plan: user.plan,
            totalCredits,
            initialUsedCredits: 1,
          });

          const { data: insertedData, error: insertError } = await client
            .from('monthly_credits')
            .insert({
              user_id: userId,
              month: monthStr,
              plan: user.plan,
              total_credits: totalCredits,
              used_credits: 1,
            })
            .select('id, used_credits, total_credits')
            .single();

          if (insertError) {
            logger.error('❌ Error creating monthly credits record', insertError as Error, {
              userId,
              monthStr,
              plan: user.plan,
              totalCredits,
              errorCode: (insertError as any).code,
              errorMessage: (insertError as any).message,
            });
          } else {
            logger.info('✅ Successfully created monthly credits record', {
              userId,
              monthStr,
              recordId: insertedData?.id,
              usedCredits: insertedData?.used_credits,
              totalCredits: insertedData?.total_credits,
            });
          }
        }
      } else {
        logger.info('⏭️ Skipping credit update', {
          userId,
          statusCode,
          creditsUsed,
          reason: statusCode < 200 || statusCode >= 300 ? 'unsuccessful_status' : 'no_credits_to_deduct',
        });
      }

      // Log usage (non-blocking, fire and forget)
      logger.info('📝 Logging usage', {
        userId,
        apiKeyId,
        endpoint,
        method,
        statusCode,
        responseTimeMs,
        creditsUsed,
      });

      Promise.resolve(
        client
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
          })
      )
        .then(() => {
          logger.info('✅ Usage logged successfully', {
            userId,
            apiKeyId,
            endpoint,
          });
        })
        .catch((logError: any) => {
          logger.error('❌ Error logging usage', logError as Error, {
            userId,
            apiKeyId,
            endpoint,
            errorCode: (logError as any).code,
            errorMessage: (logError as any).message,
          });
        });

      // Update API key last_used_at (non-blocking)
      logger.info('🔑 Updating API key last_used_at', { apiKeyId });
      Promise.resolve(
        client
          .from('api_keys')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', apiKeyId)
      )
        .then(() => {
          logger.info('✅ API key last_used_at updated', { apiKeyId });
        })
        .catch((updateError: any) => {
          logger.error('❌ Error updating API key last_used_at', updateError as Error, {
            apiKeyId,
            errorCode: (updateError as any).code,
          });
        });

      const duration = Date.now() - startTime;
      logger.info('🟢 deductCreditsAsync completed', {
        userId,
        apiKeyId,
        endpoint,
        durationMs: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('❌ Error deducting credits', error as Error, {
        userId,
        apiKeyId,
        endpoint,
        statusCode,
        creditsUsed,
        durationMs: duration,
        errorStack: (error as Error).stack,
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
