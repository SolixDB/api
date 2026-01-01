import { Router, Request, Response } from 'express';
import { transactionsService } from '../services/transactions';
import {
  protocolAnalyticsQuerySchema,
  timeSeriesQuerySchema,
  feesQuerySchema,
} from '../validators';

const router: Router = Router();

router.get('/protocols', async (req: Request, res: Response) => {
  try {
    const validated = protocolAnalyticsQuerySchema.parse(req.query);
    const analytics = await transactionsService.getProtocolAnalytics({
      protocolName: validated.protocol_name,
      dateFrom: validated.date_from,
      dateTo: validated.date_to,
    });

    res.json({ data: analytics });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Error fetching protocol analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/time-series', async (req: Request, res: Response) => {
  try {
    const validated = timeSeriesQuerySchema.parse(req.query);
    const timeSeries = await transactionsService.getTimeSeries({
      protocolName: validated.protocol_name,
      dateFrom: validated.date_from,
      dateTo: validated.date_to,
      granularity: validated.granularity,
    });

    res.json({ data: timeSeries });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Error fetching time series:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/fees', async (req: Request, res: Response) => {
  try {
    const validated = feesQuerySchema.parse(req.query);
    const feeAnalytics = await transactionsService.getFeeAnalytics({
      protocolName: validated.protocol_name,
      dateFrom: validated.date_from,
      dateTo: validated.date_to,
    });

    res.json({ data: feeAnalytics });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Error fetching fee analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

