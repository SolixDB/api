import { Request, Response, NextFunction } from 'express';
import { supabaseService, APIKeyInfo } from '../services/supabase';
import { logger } from '../services/logger';

// Extend Express Request to include API key info
declare global {
  namespace Express {
    interface Request {
      apiKey?: APIKeyInfo;
    }
  }
}

/**
 * Middleware to validate API key authentication
 * Extracts API key from x-api-key header or api-key query parameter
 */
export const apiKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract API key from header or query parameter
    const apiKey = req.headers['x-api-key'] as string || req.query['api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required. Provide it via x-api-key header or api-key query parameter.',
      });
      return;
    }

    // Validate API key
    const keyInfo = await supabaseService.validateAPIKey(apiKey);

    if (!keyInfo) {
      logger.warn('Invalid API key attempt', {
        ip: req.ip,
        path: req.path,
      });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or inactive API key.',
      });
      return;
    }

    // Attach API key info to request
    req.apiKey = keyInfo;

    logger.debug('API key validated', {
      userId: keyInfo.user_id,
      plan: keyInfo.plan,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.error('API key authentication error', error as Error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during authentication.',
    });
  }
};
