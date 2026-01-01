import { Router, Request, Response } from 'express';
import { clickhouseService } from '../services/clickhouse';
import { QueryValidator } from '../services/queryValidator';
import { z } from 'zod';

const router = Router();

const querySchema = z.object({
  query: z.string().min(1).max(100000),
  format: z.enum(['json', 'csv']).optional().default('json'),
});

/**
 * POST /api/v1/query
 * Execute a read-only SQL query against ClickHouse
 * 
 * Body: {
 *   query: string (SQL SELECT query)
 *   format?: 'json' | 'csv' (default: 'json')
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validated = querySchema.parse(req.body);
    const { query, format } = validated;

    // Validate query is read-only and safe
    const validation = QueryValidator.validate(query);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Invalid query',
        message: validation.error,
      });
      return;
    }

    // Sanitize query
    const sanitizedQuery = QueryValidator.sanitize(query);

    // Execute query with timeout (30 seconds max)
    const results = await clickhouseService.query(sanitizedQuery, {}, 30);

    // Return results in requested format
    if (format === 'csv') {
      // Convert to CSV
      if (results.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        return res.send('');
      }

      const headers = Object.keys(results[0]);
      const csvRows = [
        headers.join(','),
        ...results.map((row: any) =>
          headers.map((header) => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? '';
          }).join(',')
        ),
      ];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="query-results.csv"');
      return res.send(csvRows.join('\n'));
    }

    // Default: JSON format
    res.json({
      data: results,
      count: results.length,
      query: sanitizedQuery,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    console.error('Query execution error:', error);
    res.status(500).json({
      error: 'Query execution failed',
      message: error.message || 'An error occurred while executing the query',
    });
  }
});

export default router;

