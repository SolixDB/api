import { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redis';
import { config } from '../config';

export const rateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Rate limit by IP address
  const identifier = req.ip || req.socket.remoteAddress || 'unknown';
  const windowMs = config.api.rateLimitWindowMs;
  const maxRequests = config.api.rateLimitMaxRequests;

  const key = `rate_limit:${identifier}`;
  const count = await redisService.increment(key, Math.ceil(windowMs / 1000));

  res.setHeader('X-RateLimit-Limit', maxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

  if (count > maxRequests) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
    });
    return;
  }

  next();
};

