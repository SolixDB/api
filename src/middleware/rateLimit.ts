import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redis';
import { config } from '../config';
import { metrics } from '../services/metrics';

/**
 * Sliding window rate limiting with complexity-based tiers
 */
export const rateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Check if rate limiting is enabled
  if (!config.api.enableRateLimit) {
    next();
    return;
  }

  // Rate limit by IP address
  const identifier = req.ip || req.socket.remoteAddress || 'unknown';
  const windowMs = 60000; // 60 seconds sliding window

  // Get query complexity from request (set by GraphQL middleware)
  const complexity = (req as any).queryComplexity || 0;
  const tier = getRateLimitTier(complexity);
  const limit = getRateLimitForTier(tier);

  // Sliding window: track total cost used in last 60 seconds
  const costKey = `rate_limit_cost:${identifier}`;

  // Get current cost usage
  const currentCost = await redisService.get<number>(costKey) || 0;

  // Check if limit exceeded
  if (currentCost + complexity > limit) {
    const retryAfter = Math.ceil(windowMs / 1000);
    metrics.rateLimitHitsTotal.inc({ tier });

    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());
    res.setHeader('Retry-After', retryAfter.toString());

    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Complexity: ${complexity}, Limit: ${limit}, Used: ${currentCost}. Retry after ${retryAfter} seconds.`,
      extensions: {
        code: 'RATE_LIMIT_EXCEEDED',
        complexity,
        limit,
        used: currentCost,
        tier,
        retryAfter,
      },
    });
    return;
  }

  // Increment cost usage
  await redisService.set(costKey, currentCost + complexity, Math.ceil(windowMs / 1000));

  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - (currentCost + complexity)).toString());
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

  next();
};

function getRateLimitTier(complexity: number): string {
  if (complexity < 50) return 'cost50';
  if (complexity < 100) return 'cost100';
  if (complexity < 200) return 'cost200';
  if (complexity < 500) return 'cost500';
  if (complexity < 1000) return 'cost1000';
  return 'too_complex';
}

function getRateLimitForTier(tier: string): number {
  switch (tier) {
    case 'cost50':
      return config.api.rateLimitTiers.cost50;
    case 'cost100':
      return config.api.rateLimitTiers.cost100;
    case 'cost200':
      return config.api.rateLimitTiers.cost200;
    case 'cost500':
      return config.api.rateLimitTiers.cost500;
    case 'cost1000':
      return config.api.rateLimitTiers.cost1000;
    default:
      return 0; // Reject
  }
}

