/**
 * Validates SQL queries to ensure they are read-only and safe
 */

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
];

const ALLOWED_KEYWORDS = [
  'SELECT',
  'WITH',
  'FROM',
  'WHERE',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'UNION',
  'INTERSECT',
  'EXCEPT',
  'AS',
  'JOIN',
  'INNER',
  'LEFT',
  'RIGHT',
  'FULL',
  'ON',
  'AND',
  'OR',
  'NOT',
  'IN',
  'EXISTS',
  'LIKE',
  'ILIKE',
  'BETWEEN',
  'IS',
  'NULL',
  'DISTINCT',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
];

export class QueryValidator {
  /**
   * Validates that a query is read-only and safe
   */
  static validate(query: string): { valid: boolean; error?: string } {
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
      // Use word boundaries to avoid false positives
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(query)) {
        return {
          valid: false,
          error: `Destructive operation '${keyword}' is not allowed. Only read-only queries are permitted.`,
        };
      }
    }

    // Check query length (prevent extremely long queries)
    if (query.length > 100000) {
      return { valid: false, error: 'Query is too long. Maximum length is 100,000 characters.' };
    }

    // Enforce LIMIT clause for safety (prevent accidental huge result sets)
    // Allow up to 10,000 rows by default, but require explicit LIMIT
    const hasLimit = /LIMIT\s+\d+/i.test(query);
    if (!hasLimit) {
      return {
        valid: false,
        error: 'Query must include a LIMIT clause. Maximum allowed: LIMIT 10000',
      };
    }

    // Check LIMIT value is reasonable
    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      const limitValue = parseInt(limitMatch[1], 10);
      if (limitValue > 10000) {
        return {
          valid: false,
          error: 'LIMIT value cannot exceed 10,000 rows. Please reduce the limit.',
        };
      }
    }

    // Check for semicolons (prevent multiple statements)
    const semicolonCount = (query.match(/;/g) || []).length;
    if (semicolonCount > 1) {
      return { valid: false, error: 'Multiple statements are not allowed. Use only one query.' };
    }

    // Check for comments that might hide malicious code
    // This is a basic check - more sophisticated parsing would be needed for production
    if (query.includes('--') || query.includes('/*') || query.includes('*/')) {
      // Comments are generally safe, but we'll log them
      // For now, we allow them but could restrict if needed
    }

    return { valid: true };
  }

  /**
   * Sanitizes query by removing comments and normalizing whitespace
   */
  static sanitize(query: string): string {
    // Remove single-line comments
    let sanitized = query.replace(/--.*$/gm, '');
    
    // Remove multi-line comments
    sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    return sanitized;
  }
}

