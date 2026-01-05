import { Router, Request, Response } from 'express';
import { clickhouseService } from '../services/clickhouse';
import { QueryValidator } from '../services/queryValidator';
import { z } from 'zod';

const router: Router = Router();

const querySchema = z.object({
  query: z.string().min(1).max(100000),
  format: z.enum(['json', 'csv']).optional().default('json'),
});

/**
 * @swagger
 * /api/v1/query:
 *   post:
 *     operationId: executeQuery
 *     summary: Execute a read-only SQL query
 *     description: |
 *       Execute a read-only SQL SELECT query against ClickHouse.
 *       Write operations (INSERT, UPDATE, DELETE, DROP, etc.) are blocked for security.
 *       Queries are validated and sanitized before execution.
 *     tags: [Query]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QueryRequest'
 *           examples:
 *             simple:
 *               summary: Simple query
 *               value:
 *                 query: "SELECT * FROM transactions LIMIT 10"
 *                 format: "json"
 *             csv:
 *               summary: Query with CSV format
 *               value:
 *                 query: "SELECT protocol_name, COUNT(*) as count FROM transactions GROUP BY protocol_name"
 *                 format: "csv"
 *     responses:
 *       200:
 *         description: Query executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QueryResponse'
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted results
 *       400:
 *         description: Invalid query or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalidQuery:
 *                 summary: Write query blocked
 *                 value:
 *                   error: "Invalid query"
 *                   message: "Write operations are not allowed"
 *               validationError:
 *                 summary: Validation error
 *                 value:
 *                   error: "Validation error"
 *                   details: [{"path": ["query"], "message": "Required"}]
 *       500:
 *         description: Query execution failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
        res.send('');
        return;
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
      res.send(csvRows.join('\n'));
      return;
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
    return;
  }
});

export default router;

