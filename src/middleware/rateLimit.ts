import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redis';
import { config } from '../config';
import { metrics } from '../services/metrics';

/**
 * Plan-based rate limiting using API key plan tier
 * Separate from system metrics (RAM, etc.)
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

  // Get API key info from request (set by apiKeyAuth middleware)
  const apiKeyInfo = req.apiKey;
  if (!apiKeyInfo) {
    // If no API key, this shouldn't happen if middleware is applied correctly
    // But we'll allow it to pass through for now
    next();
    return;
  }

  // Get plan-based rate limit
  const plan = apiKeyInfo.plan || 'free';
  const limit = getRateLimitForPlan(plan);
  const windowMs = 60000; // 60 seconds sliding window

  // Use API key ID as identifier (not IP address)
  const identifier = `api_key:${apiKeyInfo.id}`;
  const rateLimitKey = `rate_limit:${identifier}`;

  // Get current request count in sliding window
  const currentCount = await redisService.get<number>(rateLimitKey) || 0;

  // Check if limit exceeded
  if (currentCount >= limit) {
    const retryAfter = Math.ceil(windowMs / 1000);
    metrics.rateLimitHitsTotal.inc({ plan });

    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());
    res.setHeader('Retry-After', retryAfter.toString());

    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded for plan '${plan}'. Limit: ${limit} requests/minute, Used: ${currentCount}. Retry after ${retryAfter} seconds.`,
      plan,
      limit,
      used: currentCount,
      retryAfter,
    });
    return;
  }

  // Increment request count
  await redisService.set(rateLimitKey, currentCount + 1, Math.ceil(windowMs / 1000));

  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - (currentCount + 1)).toString());
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());
  res.setHeader('X-RateLimit-Plan', plan);

  next();
};

function getRateLimitForPlan(plan: string): number {
  switch (plan) {
    case 'free':
      return config.api.rateLimitTiers.free;
    case 'x402':
      return config.api.rateLimitTiers.x402;
    case 'enterprise':
      return config.api.rateLimitTiers.enterprise;
    default:
      return config.api.rateLimitTiers.free; // Default to free tier
  }
}

