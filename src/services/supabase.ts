import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';
import crypto from 'crypto';

export interface APIKeyInfo {
  id: string;
  user_id: string;
  plan: 'free' | 'x402' | 'enterprise';
  name: string;
  is_active: boolean;
}

/**
 * Hash an API key using SHA-256
 */
export function hashAPIKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Supabase service for API key validation
 */
class SupabaseService {
  private client;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }

    this.client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Validate an API key and return associated user info
   */
  async validateAPIKey(apiKey: string): Promise<APIKeyInfo | null> {
    try {
      const keyHash = hashAPIKey(apiKey);

      // Query the api_keys table with user plan
      const { data: apiKeyData, error: apiKeyError } = await this.client
        .from('api_keys')
        .select('id, user_id, is_active, name')
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single();

      if (apiKeyError || !apiKeyData) {
        logger.debug('API key validation failed', { error: apiKeyError?.message });
        return null;
      }

      // Get user plan
      const { data: userData } = await this.client
        .from('users')
        .select('plan')
        .eq('id', apiKeyData.user_id)
        .single();

      const plan = (userData?.plan || 'free') as 'free' | 'x402' | 'enterprise';

      // Update last_used_at timestamp
      await this.client
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', apiKeyData.id);

      return {
        id: apiKeyData.id,
        user_id: apiKeyData.user_id,
        plan,
        name: apiKeyData.name,
        is_active: apiKeyData.is_active,
      };
    } catch (error) {
      logger.error('Error validating API key', error as Error);
      return null;
    }
  }

  /**
   * Get user plan by user_id
   */
  async getUserPlan(userId: string): Promise<'free' | 'x402' | 'enterprise'> {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('plan')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return 'free';
      }

      return data.plan || 'free';
    } catch (error) {
      logger.error('Error getting user plan', error as Error);
      return 'free';
    }
  }
}

export const supabaseService = new SupabaseService();
