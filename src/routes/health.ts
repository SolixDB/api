import { Router, Request, Response } from 'express';
import { clickhouseService } from '../services/clickhouse';
import { redisService } from '../services/redis';

const router: Router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const [clickhouseHealthy, redisHealthy] = await Promise.all([
    clickhouseService.healthCheck(),
    redisService.healthCheck(),
  ]);

  const healthy = clickhouseHealthy && redisHealthy;
  const status = healthy ? 200 : 503;

  res.status(status).json({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      clickhouse: clickhouseHealthy ? 'up' : 'down',
      redis: redisHealthy ? 'up' : 'down',
    },
  });
});

export default router;

