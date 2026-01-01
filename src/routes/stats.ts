import { Router, Request, Response } from 'express';
import { transactionsService } from '../services/transactions';

const router: Router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const stats = await transactionsService.getStats();
    res.json({ data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

