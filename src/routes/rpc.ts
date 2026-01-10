import { Router, Request, Response } from 'express';
import { rpcService } from '../services/rpcService';
import { logger } from '../services/logger';
import { z } from 'zod';

const router: Router = Router();

// JSON-RPC 2.0 request schema
const rpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.union([z.array(z.any()), z.object({}).passthrough()]).optional(),
});

/**
 * @swagger
 * /v1/rpc:
 *   post:
 *     operationId: executeRPC
 *     summary: Execute a JSON-RPC 2.0 method call
 *     description: |
 *       Execute JSON-RPC 2.0 method calls against the SolixDB API.
 *       
 *       **Available Methods:**
 *       - `getTransaction` - Get a single transaction by signature
 *       - `getTransactions` - Get transactions with filters
 *       - `getProtocolStats` - Get comprehensive statistics for a protocol
 *       - `getProtocolComparison` - Compare multiple protocols side by side
 *       - `getInstructionTypes` - Get instruction types with statistics
 *       - `getProtocolActivity` - Get time-series activity data
 *       - `getTopProtocols` - Get top protocols by various metrics
 *       - `getFailedTransactions` - Get failed transactions with error details
 *       - `getProtocolPerformance` - Get performance metrics for a protocol
 *       - `getProtocols` - Get list of available protocols
 *     tags: [RPC]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jsonrpc
 *               - id
 *               - method
 *             properties:
 *               jsonrpc:
 *                 type: string
 *                 enum: ["2.0"]
 *               id:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *               method:
 *                 type: string
 *                 enum: [
 *                   "getTransaction",
 *                   "getTransactions",
 *                   "getProtocolStats",
 *                   "getProtocolComparison",
 *                   "getInstructionTypes",
 *                   "getProtocolActivity",
 *                   "getTopProtocols",
 *                   "getFailedTransactions",
 *                   "getProtocolPerformance",
 *                   "getProtocols"
 *                 ]
 *               params:
 *                 oneOf:
 *                   - type: array
 *                   - type: object
 *                 description: Method parameters (varies by method)
 *           examples:
 *             getTransaction:
 *               summary: Get transaction by signature
 *               value:
 *                 jsonrpc: "2.0"
 *                 id: 1
 *                 method: "getTransaction"
 *                 params: ["5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4LjF3ZdUi2gEB9M2K3j3gv6q"]
 *             getProtocolStats:
 *               summary: Get protocol statistics
 *               value:
 *                 jsonrpc: "2.0"
 *                 id: 2
 *                 method: "getProtocolStats"
 *                 params:
 *                   protocolName: "drift_v2"
 *                   blockTime:
 *                     gte: 1735689600
 *                     lte: 1738368000
 *             getTopProtocols:
 *               summary: Get top protocols
 *               value:
 *                 jsonrpc: "2.0"
 *                 id: 3
 *                 method: "getTopProtocols"
 *                 params:
 *                   limit: 10
 *                   sortBy: "transactions"
 *     responses:
 *       200:
 *         description: JSON-RPC response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jsonrpc:
 *                   type: string
 *                   example: "2.0"
 *                 id:
 *                   oneOf:
 *                     - type: string
 *                     - type: number
 *                 result:
 *                   type: object
 *       400:
 *         description: Invalid JSON-RPC request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jsonrpc:
 *                   type: string
 *                   example: "2.0"
 *                 id:
 *                   oneOf:
 *                     - type: string
 *                     - type: number
 *                     - type: "null"
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: number
 *                     message:
 *                       type: string
 *       500:
 *         description: Internal server error
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate JSON-RPC request
    const validation = rpcRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        jsonrpc: '2.0',
        id: req.body.id ?? null,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: validation.error.errors,
        },
      });
      return;
    }

    const { id, method, params = [] } = validation.data;

    // Handle different methods
    let result: any;

    try {
      switch (method) {
        case 'getTransaction': {
          if (!Array.isArray(params) || params.length < 1) {
            throw new Error('getTransaction requires signature as first parameter');
          }
          const signature = params[0] as string;
          result = await rpcService.getTransaction(signature);
          break;
        }

        case 'getTransactions': {
          const options = (Array.isArray(params) ? params[0] : params) as any;
          result = await rpcService.getTransactions(options);
          break;
        }

        case 'getProtocolStats': {
          const options = (Array.isArray(params) ? params[0] : params) as any;
          if (!options || !options.protocolName) {
            throw new Error('getProtocolStats requires protocolName parameter');
          }
          result = await rpcService.getProtocolStats(options);
          break;
        }

        case 'getProtocolComparison': {
          const options = (Array.isArray(params) ? params[0] : params) as any;
          if (!options || !options.protocols || !Array.isArray(options.protocols)) {
            throw new Error('getProtocolComparison requires protocols array parameter');
          }
          result = await rpcService.getProtocolComparison(options);
          break;
        }

        case 'getInstructionTypes': {
          const options = (Array.isArray(params) ? params[0] : params) as any;
          result = await rpcService.getInstructionTypes(options || {});
          break;
        }

        case 'getProtocolActivity': {
          const options = (Array.isArray(params) ? params[0] : params) as any;
          if (!options || !options.blockTime) {
            throw new Error('getProtocolActivity requires blockTime parameter with gte and lte');
          }
          result = await rpcService.getProtocolActivity(options);
          break;
        }

        case 'getTopProtocols': {
          const options = (Array.isArray(params) ? params[0] : params) as any;
          result = await rpcService.getTopProtocols(options || {});
          break;
        }

        case 'getFailedTransactions': {
          const options = (Array.isArray(params) ? params[0] : params) as any;
          result = await rpcService.getFailedTransactions(options || {});
          break;
        }

        case 'getProtocolPerformance': {
          const options = (Array.isArray(params) ? params[0] : params) as any;
          if (!options || !options.protocolName) {
            throw new Error('getProtocolPerformance requires protocolName parameter');
          }
          result = await rpcService.getProtocolPerformance(options);
          break;
        }

        case 'getProtocols': {
          result = await rpcService.getProtocols();
          break;
        }

        default:
          res.status(400).json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: 'Method not found',
              data: `Method '${method}' is not supported. Available methods: getTransaction, getTransactions, getProtocolStats, getProtocolComparison, getInstructionTypes, getProtocolActivity, getTopProtocols, getFailedTransactions, getProtocolPerformance, getProtocols`,
            },
          });
          return;
      }

      // Return successful response
      res.json({
        jsonrpc: '2.0',
        id,
        result,
      });
    } catch (methodError: any) {
      // Method execution error
      logger.error('RPC method execution error', methodError, {
        method,
        params: JSON.stringify(params).substring(0, 500),
      });

      res.status(500).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32000,
          message: 'Server error',
          data: methodError.message || 'An error occurred while executing the method',
        },
      });
    }
  } catch (error: any) {
    logger.error('RPC endpoint error', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id ?? null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message || 'An internal error occurred',
      },
    });
  }
});

export default router;
