import { Router, Request, Response } from 'express';
import { transactionsService } from '../services/transactions';
import {
  transactionsQuerySchema,
  protocolAnalyticsQuerySchema,
  timeSeriesQuerySchema,
  feesQuerySchema,
} from '../validators';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const validated = transactionsQuerySchema.parse(req.query);
    const transactions = await transactionsService.getTransactions({
      protocolName: validated.protocol_name,
      programId: validated.program_id,
      dateFrom: validated.date_from,
      dateTo: validated.date_to,
      signature: validated.signature,
      limit: validated.limit,
      offset: validated.offset,
    });

    res.json({
      data: transactions,
      count: transactions.length,
      limit: validated.limit,
      offset: validated.offset,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:signature', async (req: Request, res: Response) => {
  try {
    const { signature } = req.params;
    const transaction = await transactionsService.getTransactionBySignature(signature);

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.json({ data: transaction });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

