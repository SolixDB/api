import { Request, Response, NextFunction } from 'express';
import { creditTracker } from '../services/creditTracker';
import { logger } from '../services/logger';

/**
 * Middleware to check if user has enough credits before processing request
 * Should be placed after apiKeyAuth middleware
 */
export const creditCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKeyInfo = req.apiKey;
    if (!apiKeyInfo) {
      // If no API key, skip credit check (shouldn't happen if middleware order is correct)
      next();
      return;
    }

    // Check if user has credits
    const { hasCredits, creditInfo } = await creditTracker.checkCredits(
      apiKeyInfo.user_id,
      apiKeyInfo.plan
    );

    // Attach credit info to request for later use
    (req as any).creditInfo = creditInfo;

    if (!hasCredits) {
      logger.warn('Insufficient credits', {
        userId: apiKeyInfo.user_id,
        plan: apiKeyInfo.plan,
        used: creditInfo.usedCredits,
        total: creditInfo.totalCredits,
      });

      res.status(402).json({
        error: 'Payment Required',
        message: `Insufficient credits. You have used ${creditInfo.usedCredits} of ${creditInfo.totalCredits} credits this month. Please upgrade your plan or wait for next month's reset.`,
        credits: {
          used: creditInfo.usedCredits,
          total: creditInfo.totalCredits,
          remaining: creditInfo.remainingCredits,
          plan: creditInfo.plan,
        },
      });
      return;
    }

    // Add credit headers to response
    res.setHeader('X-Credits-Remaining', creditInfo.remainingCredits.toString());
    res.setHeader('X-Credits-Used', creditInfo.usedCredits.toString());
    res.setHeader('X-Credits-Total', creditInfo.totalCredits.toString());
    res.setHeader('X-Credits-Plan', creditInfo.plan);

    next();
  } catch (error) {
    logger.error('Credit check error', error as Error);
    // On error, allow request to proceed (fail open)
    // This prevents credit system from blocking legitimate requests
    next();
  }
};
