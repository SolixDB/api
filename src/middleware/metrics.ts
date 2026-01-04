import { Request, Response, NextFunction } from 'express';
import { metrics } from '../services/metrics';

export const metricsMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/metrics') {
    try {
      const metricsData = await metrics.getMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metricsData);
    } catch (error) {
      res.status(500).send('Error generating metrics');
    }
  } else {
    next();
  }
};

