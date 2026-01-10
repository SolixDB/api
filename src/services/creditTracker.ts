import { logger } from './logger';

export interface CreditInfo {
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  plan: 'free' | 'x402' | 'enterprise';
}

/**
 * Credit tracking service
 * Handles credit checking, deduction, and usage logging
 */
export class CreditTracker {
  /**
   * Get credit limits for a plan
   */
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

  /**
   * Get current month string (YYYY-MM-DD format, first day of month)
   */
  private getCurrentMonth(): string {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  }

  /**
   * Get Supabase client (expose a method in supabaseService or use directly)
   */
  private getClient() {
    // We need to access the Supabase client
    // Since it's private, we'll create our own client instance
    const { createClient } = require('@supabase/supabase-js');
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

  /**
   * Check if user has enough credits
   * Returns credit info and whether user has enough credits
   */
  async checkCredits(userId: string, plan: 'free' | 'x402' | 'enterprise'): Promise<{
    hasCredits: boolean;
    creditInfo: CreditInfo;
  }> {
    try {
      const client = this.getClient();
      const monthStr = this.getCurrentMonth();
      const totalCredits = this.getPlanCredits(plan);

      // Get or create monthly credits record
      const { data: existingCredits, error: selectError } = await client
        .from('monthly_credits')
        .select('*')
        .eq('user_id', userId)
        .eq('month', monthStr)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        // PGRST116 is "not found" - expected for new month
        logger.error('Error checking credits', selectError as Error, { userId, monthStr });
        throw selectError;
      }

      let usedCredits = 0;
      if (existingCredits) {
        usedCredits = existingCredits.used_credits || 0;
      } else {
        // Create new monthly credits record for this month
        const { error: insertError } = await client
          .from('monthly_credits')
          .insert({
            user_id: userId,
            month: monthStr,
            plan,
            total_credits: totalCredits,
            used_credits: 0,
          });

        if (insertError) {
          logger.error('Error creating monthly credits record', insertError as Error, { userId, monthStr });
          // Continue anyway - we'll try to create it later
        }
      }

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
   * Deduct credits and log usage
   * Credits are deducted per API call (1 credit per call)
   */
  async deductCredits(
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
      if (statusCode >= 200 && statusCode < 300) {
        // Get current monthly credits
        const { data: existingCredits } = await client
          .from('monthly_credits')
          .select('*')
          .eq('user_id', userId)
          .eq('month', monthStr)
          .single();

        if (existingCredits) {
          // Update existing record
          const { error: updateError } = await client
            .from('monthly_credits')
            .update({
              used_credits: (existingCredits.used_credits || 0) + creditsUsed,
            })
            .eq('id', existingCredits.id);

          if (updateError) {
            logger.error('Error updating monthly credits', updateError as Error, {
              userId,
              monthStr,
            });
          }
        } else {
          // Get user plan to create new record
          const { data: user } = await client
            .from('users')
            .select('plan')
            .eq('id', userId)
            .single();

          if (user) {
            const totalCredits = this.getPlanCredits(user.plan as 'free' | 'x402' | 'enterprise');
            const { error: createError } = await client
              .from('monthly_credits')
              .insert({
                user_id: userId,
                month: monthStr,
                plan: user.plan,
                total_credits: totalCredits,
                used_credits: creditsUsed,
              });

            if (createError) {
              logger.error('Error creating monthly credits', createError as Error, {
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

  /**
   * Get credit info for a user (without checking)
   */
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
}

export const creditTracker = new CreditTracker();
