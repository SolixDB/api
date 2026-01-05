import { Router, Request, Response } from 'express';
import { clickhouseService } from '../services/clickhouse';
import { redisService } from '../services/redis';

const router: Router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API and its dependencies (ClickHouse, Redis)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: All services are healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               status: "healthy"
 *               timestamp: "2025-01-01T00:00:00.000Z"
 *               services:
 *                 clickhouse: "up"
 *                 redis: "up"
 *       503:
 *         description: One or more services are unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               status: "unhealthy"
 *               timestamp: "2025-01-01T00:00:00.000Z"
 *               services:
 *                 clickhouse: "down"
 *                 redis: "up"
 */
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

