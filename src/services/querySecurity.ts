/**
 * Security utilities for query validation and SQL injection prevention
 */

// Whitelist of allowed table names
const ALLOWED_TABLES = ['transactions', 'failed_transactions'] as const;

// Destructive SQL keywords that should never appear in queries
const DESTRUCTIVE_KEYWORDS = [
  'DROP',
  'DELETE',
  'UPDATE',
  'INSERT',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'REPLACE',
  'MERGE',
  'GRANT',
  'REVOKE',
  'KILL',
  'OPTIMIZE',
  'ATTACH',
  'DETACH',
  'EXCHANGE',
  'RENAME',
  'SYSTEM',
  'SHOW',
  'DESCRIBE',
  'EXPLAIN',
] as const;

export class QuerySecurity {
  /**
   * Validates table name against whitelist
   */
  static validateTableName(table: string): boolean {
    return ALLOWED_TABLES.includes(table as any);
  }

  /**
   * Validates that a query is read-only (SELECT only)
   */
  static validateReadOnly(query: string): { valid: boolean; error?: string } {
    if (!query || typeof query !== 'string') {
      return { valid: false, error: 'Query must be a non-empty string' };
    }

    const normalizedQuery = query.trim().toUpperCase();

    // Must start with SELECT or WITH (for CTEs)
    if (!normalizedQuery.startsWith('SELECT') && !normalizedQuery.startsWith('WITH')) {
      return { valid: false, error: 'Only SELECT queries are allowed' };
    }

    // Check for destructive keywords
    for (const keyword of DESTRUCTIVE_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(query)) {
        return {
          valid: false,
          error: `Destructive operation '${keyword}' is not allowed. Only read-only queries are permitted.`,
        };
      }
    }

    // Prevent UNION with potentially dangerous queries
    // Allow UNION but log it for review
    if (normalizedQuery.includes('UNION')) {
      // This is allowed but should be monitored
    }

    return { valid: true };
  }

  /**
   * Sanitizes table name - returns whitelisted table or throws error
   */
  static sanitizeTableName(table: string): 'transactions' | 'failed_transactions' {
    if (!this.validateTableName(table)) {
      throw new Error(`Invalid table name: ${table}. Allowed tables: ${ALLOWED_TABLES.join(', ')}`);
    }
    return table as 'transactions' | 'failed_transactions';
  }

  /**
   * Validates that query parameters don't contain SQL injection attempts
   */
  static validateQueryParams(params: Record<string, any>): { valid: boolean; error?: string } {
    for (const [key, value] of Object.entries(params)) {
      // Check for SQL injection patterns in string values
      if (typeof value === 'string') {
        const dangerousPatterns = [
          /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)/i,
          /'\s*OR\s*'1'\s*=\s*'1/i,
          /'\s*UNION\s*SELECT/i,
          /\/\*.*\*\//,
          /--/,
        ];

        for (const pattern of dangerousPatterns) {
          if (pattern.test(value)) {
            return {
              valid: false,
              error: `Potentially dangerous value detected in parameter '${key}'`,
            };
          }
        }
      }

      // For arrays, check each element
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') {
            const dangerousPatterns = [
              /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)/i,
              /'\s*OR\s*'1'\s*=\s*'1/i,
              /'\s*UNION\s*SELECT/i,
            ];

            for (const pattern of dangerousPatterns) {
              if (pattern.test(item)) {
                return {
                  valid: false,
                  error: `Potentially dangerous value detected in array parameter '${key}'`,
                };
              }
            }
          }
        }
      }
    }

    return { valid: true };
  }

  /**
   * Validates column names against allowed patterns
   */
  static validateColumnName(column: string): boolean {
    // Allow alphanumeric, underscore, and dot (for table.column)
    return /^[a-zA-Z0-9_\.]+$/.test(column);
  }
}

