import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

// In production, this should query a database or use a service
// For now, we'll use environment variables or a simple in-memory store
const validApiKeys = new Set<string>(
  (process.env.VALID_API_KEYS || '').split(',').filter(Boolean)
);

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
}

export const authenticateApiKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers[config.api.keyHeader.toLowerCase()] as string;

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required',
    });
    return;
  }

  // In production, validate against a database
  // For now, accept any non-empty key or check against env var
  if (validApiKeys.size > 0 && !validApiKeys.has(apiKey)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
    });
    return;
  }

  req.apiKey = apiKey;
  next();
};

