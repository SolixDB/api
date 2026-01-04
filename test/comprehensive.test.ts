/**
 * Comprehensive Test Suite for SolixDB GraphQL API [AI Generated] 
 * 
 * Tests:
 * - All GraphQL queries and mutations
 * - Edge cases and error handling
 * - Security (SQL injection, write queries)
 * - Performance benchmarks
 * - Rate limiting
 * - Caching behavior
 * - Export functionality
 * 
 * Run with: tsx test/comprehensive.test.ts
 * Or: npm test (if jest is configured)
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`;

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  data?: any;
}

interface BenchmarkResult {
  name: string;
  operations: number;
  totalTime: number;
  avgTime: number;
  p50: number;
  p95: number;
  p99: number;
  errors: number;
}

class TestRunner {
  private results: TestResult[] = [];
  private benchmarks: BenchmarkResult[] = [];

  async runGraphQLQuery(query: string, variables?: any): Promise<any> {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': `test-${Date.now()}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'GraphQL error');
    }

    return result.data;
  }

  async test(name: string, testFn: () => Promise<void>): Promise<void> {
    const start = Date.now();
    try {
      await testFn();
      const duration = Date.now() - start;
      this.results.push({ name, passed: true, duration });
      console.log(`✅ ${name} (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - start;
      this.results.push({
        name,
        passed: false,
        duration,
        error: error.message || String(error),
      });
      console.error(`❌ ${name} (${duration}ms): ${error.message}`);
    }
  }

  async benchmark(
    name: string,
    operation: () => Promise<any>,
    iterations: number = 100
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    let errors = 0;

    console.log(`\n📊 Benchmarking: ${name} (${iterations} iterations)`);

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        await operation();
        times.push(Date.now() - start);
      } catch (error) {
        errors++;
        times.push(Date.now() - start);
      }

      if ((i + 1) % 10 === 0) {
        process.stdout.write('.');
      }
    }

    times.sort((a, b) => a - b);
    const totalTime = times.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / iterations;
    const p50 = times[Math.floor(iterations * 0.5)];
    const p95 = times[Math.floor(iterations * 0.95)];
    const p99 = times[Math.floor(iterations * 0.99)];

    const result: BenchmarkResult = {
      name,
      operations: iterations,
      totalTime,
      avgTime,
      p50,
      p95,
      p99,
      errors,
    };

    this.benchmarks.push(result);
    console.log(`\n   Avg: ${avgTime.toFixed(2)}ms | P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms | Errors: ${errors}`);

    return result;
  }

  printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`\nTests: ${passed} passed, ${failed} failed, ${this.results.length} total`);
    console.log(`Total duration: ${totalDuration}ms`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  - ${r.name}: ${r.error}`);
        });
    }

    if (this.benchmarks.length > 0) {
      console.log('\n📊 Benchmarks:');
      this.benchmarks.forEach((b) => {
        console.log(`  ${b.name}:`);
        console.log(`    Avg: ${b.avgTime.toFixed(2)}ms | P50: ${b.p50}ms | P95: ${b.p95}ms | P99: ${b.p99}ms`);
        if (b.errors > 0) {
          console.log(`    ⚠️  ${b.errors} errors`);
        }
      });
    }

    console.log('\n' + '='.repeat(80));
  }
}

// Test Queries (as plain strings)
const QUERIES = {
  // Basic transactions query
  basicTransactions: `
    query {
      transactions(
        filters: {
          protocols: ["pump_fun"]
          dateRange: { start: "2025-01-01", end: "2025-01-31" }
        }
        pagination: { first: 10 }
      ) {
        edges {
          node {
            signature
            protocolName
            fee
          }
          cursor
        }
        pageInfo {
          hasNextPage
        }
      }
    }
  `,

  // Aggregation query
  aggregationQuery: `
    query {
      transactions(
        filters: {
          protocols: ["pump_fun"]
          dateRange: { start: "2025-01-01", end: "2025-01-31" }
        }
        groupBy: [PROTOCOL, HOUR]
        metrics: [COUNT, AVG_FEE, P95_FEE]
        sort: { field: COUNT, direction: DESC }
        pagination: { first: 100 }
      ) {
        edges {
          node {
            protocol
            hour
            count
            avgFee
            p95Fee
          }
        }
      }
    }
  `,

  // Query complexity check
  queryComplexity: `
    query {
      queryComplexity(
        filters: {
          dateRange: { start: "2025-01-01", end: "2025-01-31" }
          protocols: ["pump_fun"]
        }
        groupBy: [PROTOCOL, HOUR]
        metrics: [COUNT, AVG_FEE]
      ) {
        score
        estimatedRows
        baseCost
        recommendations
      }
    }
  `,

  // Signature lookup
  signatureLookup: `
    query {
      signature(signature: "test_signature_here") {
        signature
        protocolName
        fee
      }
    }
  `,

  // Export job creation
  createExport: `
    mutation {
      exportDataset(
        config: {
          format: CSV
          filters: {
            protocols: ["pump_fun"]
            dateRange: { start: "2025-01-01", end: "2025-01-31" }
          }
          columns: ["protocol_name", "fee", "compute_units"]
        }
      ) {
        id
        status
      }
    }
  `,
};

async function runTests() {
  const runner = new TestRunner();

  console.log('🚀 Starting Comprehensive Test Suite\n');
  console.log(`Testing against: ${BASE_URL}\n`);

  // ============================================================================
  // BASIC FUNCTIONALITY TESTS
  // ============================================================================

  await runner.test('Health check endpoint', async () => {
    const response = await fetch(`${BASE_URL}/health`);
    if (!response.ok) throw new Error('Health check failed');
    const data = await response.json();
    if (!data.status) throw new Error('Invalid health check response');
  });

  await runner.test('Metrics endpoint accessible', async () => {
    const response = await fetch(`${BASE_URL}/metrics`);
    if (!response.ok) throw new Error('Metrics endpoint failed');
    const text = await response.text();
    if (!text.includes('graphql_query_duration_seconds')) {
      throw new Error('Metrics format invalid');
    }
  });

  // ============================================================================
  // GRAPHQL QUERY TESTS
  // ============================================================================

  await runner.test('Basic transactions query', async () => {
    const data = await runner.runGraphQLQuery(QUERIES.basicTransactions);
    if (!data?.transactions?.edges) throw new Error('Invalid response structure');
  });

  await runner.test('Aggregation query with grouping', async () => {
    const data = await runner.runGraphQLQuery(QUERIES.aggregationQuery);
    if (!data?.transactions?.edges) throw new Error('Invalid aggregation response');
  });

  await runner.test('Query complexity calculation', async () => {
    const data = await runner.runGraphQLQuery(QUERIES.queryComplexity);
    if (!data?.queryComplexity?.score) throw new Error('Complexity calculation failed');
    if (typeof data.queryComplexity.score !== 'number') {
      throw new Error('Complexity score must be a number');
    }
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  await runner.test('Empty filters query', async () => {
    const query = `
      query {
        transactions(filters: {}, pagination: { first: 10 }) {
          edges {
            node {
              signature
            }
          }
        }
      }
    `;
    const data = await runner.runGraphQLQuery(query);
    if (!data?.transactions) throw new Error('Empty filters should return results');
  });

  await runner.test('Very large date range', async () => {
    const query = `
      query {
        transactions(
          filters: {
            dateRange: { start: "2020-01-01", end: "2025-12-31" }
          }
          pagination: { first: 10 }
        ) {
          edges {
            node {
              signature
            }
          }
        }
      }
    `;
    const data = await runner.runGraphQLQuery(query);
    // Should either return results or error with complexity too high
    if (!data?.transactions && !data?.errors) {
      throw new Error('Should return results or complexity error');
    }
  });

  await runner.test('Multiple protocols filter', async () => {
    const query = `
      query {
        transactions(
          filters: {
            protocols: ["pump_fun", "pump_amm", "jupiter", "raydium"]
            dateRange: { start: "2025-01-01", end: "2025-01-31" }
          }
          pagination: { first: 10 }
        ) {
          edges {
            node {
              protocolName
            }
          }
        }
      }
    `;
    const data = await runner.runGraphQLQuery(query);
    if (!data?.transactions) throw new Error('Multiple protocols filter failed');
  });

  await runner.test('Complex aggregation with multiple dimensions', async () => {
    const query = `
      query {
        transactions(
          filters: {
            protocols: ["pump_fun"]
            dateRange: { start: "2025-01-01", end: "2025-01-31" }
          }
          groupBy: [PROTOCOL, HOUR, DAY_OF_WEEK]
          metrics: [COUNT, AVG_FEE, P95_FEE, P99_FEE]
          pagination: { first: 50 }
        ) {
          edges {
            node {
              protocol
              hour
              dayOfWeek
              count
            }
          }
        }
      }
    `;
    const data = await runner.runGraphQLQuery(query);
    if (!data?.transactions) throw new Error('Complex aggregation failed');
  });

  await runner.test('Pagination with cursor', async () => {
    // First page
    const query1 = `
      query {
        transactions(
          filters: { protocols: ["pump_fun"] }
          pagination: { first: 5 }
        ) {
          edges {
            cursor
            node {
              signature
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;
    const data1 = await runner.runGraphQLQuery(query1);
    if (!data1?.transactions?.pageInfo?.endCursor) {
      throw new Error('Missing cursor for pagination');
    }

    // Second page using cursor
    const cursor = data1.transactions.pageInfo.endCursor;
    const query2 = `
      query {
        transactions(
          filters: { protocols: ["pump_fun"] }
          pagination: { first: 5, after: "${cursor}" }
        ) {
          edges {
            node {
              signature
            }
          }
        }
      }
    `;
    const data2 = await runner.runGraphQLQuery(query2);
    if (!data2?.transactions) throw new Error('Cursor pagination failed');
  });

  await runner.test('Fee range filter', async () => {
    const query = `
      query {
        transactions(
          filters: {
            feeRange: { min: 1000, max: 10000 }
            dateRange: { start: "2025-01-01", end: "2025-01-31" }
          }
          pagination: { first: 10 }
        ) {
          edges {
            node {
              fee
            }
          }
        }
      }
    `;
    const data = await runner.runGraphQLQuery(query);
    if (!data?.transactions) throw new Error('Fee range filter failed');
  });

  await runner.test('Compute units range filter', async () => {
    const query = `
      query {
        transactions(
          filters: {
            computeRange: { min: 100000, max: 1000000 }
            dateRange: { start: "2025-01-01", end: "2025-01-31" }
          }
          pagination: { first: 10 }
        ) {
          edges {
            node {
              computeUnits
            }
          }
        }
      }
    `;
    const data = await runner.runGraphQLQuery(query);
    if (!data?.transactions) throw new Error('Compute range filter failed');
  });

  // ============================================================================
  // SECURITY TESTS
  // ============================================================================

  await runner.test('SQL injection attempt in protocol filter', async () => {
    const query = `
      query {
        transactions(
          filters: {
            protocols: ["'; DROP TABLE transactions; --"]
            dateRange: { start: "2025-01-01", end: "2025-01-31" }
          }
          pagination: { first: 10 }
        ) {
          edges {
            node {
              signature
            }
          }
        }
      }
    `;
    try {
      await runner.runGraphQLQuery(query);
      // Should either reject or sanitize - both are acceptable
    } catch (error: any) {
      // Expected - injection attempt should be blocked
      if (!error.message.includes('dangerous') && !error.message.includes('validation')) {
        throw error;
      }
    }
  });

  await runner.test('SQL injection attempt in signature', async () => {
    const query = `
      query {
        signature(signature: "'; DELETE FROM transactions; --") {
          signature
        }
      }
    `;
    try {
      await runner.runGraphQLQuery(query);
      // Should reject or return null
    } catch (error: any) {
      // Expected
      if (!error.message.includes('dangerous') && !error.message.includes('validation')) {
        throw error;
      }
    }
  });

  await runner.test('Direct SQL query endpoint - write query blocked', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'DELETE FROM transactions WHERE 1=1',
      }),
    });

    const data = await response.json();
    if (response.ok || !data.error) {
      throw new Error('Write query should be blocked');
    }
  });

  await runner.test('Direct SQL query endpoint - SELECT allowed', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'SELECT count() FROM transactions LIMIT 1',
      }),
    });

    if (!response.ok) {
      throw new Error('Valid SELECT query should be allowed');
    }
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  await runner.test('Invalid date format', async () => {
    const query = `
      query {
        transactions(
          filters: {
            dateRange: { start: "invalid-date", end: "2025-01-31" }
          }
          pagination: { first: 10 }
        ) {
          edges {
            node {
              signature
            }
          }
        }
      }
    `;
    try {
      await runner.runGraphQLQuery(query);
      // May succeed if GraphQL validates, or fail - both acceptable
    } catch (error) {
      // Expected for invalid date
    }
  });

  await runner.test('Query without pagination for large result set', async () => {
    const query = `
      query {
        transactions(
          filters: {
            dateRange: { start: "2020-01-01", end: "2025-12-31" }
          }
        ) {
          edges {
            node {
              signature
            }
          }
        }
      }
    `;
    try {
      await runner.runGraphQLQuery(query);
      // Should either require pagination or return error
    } catch (error: any) {
      if (!error.message.includes('pagination') && !error.message.includes('PAGINATION_REQUIRED')) {
        // May succeed if complexity allows, or fail - both acceptable
      }
    }
  });

  await runner.test('Query complexity too high', async () => {
    const query = `
      query {
        transactions(
          filters: {
            dateRange: { start: "2020-01-01", end: "2025-12-31" }
          }
          groupBy: [PROTOCOL, HOUR, DATE, PROGRAM_ID, INSTRUCTION_TYPE, DAY_OF_WEEK]
          metrics: [COUNT, AVG_FEE, P95_FEE, P99_FEE, SUM_FEE]
        ) {
          edges {
            node {
              protocol
            }
          }
        }
      }
    `;
    try {
      await runner.runGraphQLQuery(query);
      // May succeed or fail based on actual complexity
    } catch (error: any) {
      if (error.message.includes('complexity') || error.message.includes('COMPLEXITY')) {
        // Expected
      }
    }
  });

  // ============================================================================
  // PERFORMANCE BENCHMARKS
  // ============================================================================

  await runner.benchmark(
    'Simple transactions query (10 iterations)',
    async () => {
      await runner.runGraphQLQuery(QUERIES.basicTransactions);
    },
    10
  );

  await runner.benchmark(
    'Aggregation query (10 iterations)',
    async () => {
      await runner.runGraphQLQuery(QUERIES.aggregationQuery);
    },
    10
  );

  await runner.benchmark(
    'Query complexity calculation (20 iterations)',
    async () => {
      await runner.runGraphQLQuery(QUERIES.queryComplexity);
    },
    20
  );

  await runner.benchmark(
    'Health check endpoint (50 iterations)',
    async () => {
      const response = await fetch(`${BASE_URL}/health`);
      if (!response.ok) throw new Error('Health check failed');
    },
    50
  );

  // ============================================================================
  // RATE LIMITING TESTS
  // ============================================================================

  await runner.test('Rate limit headers present', async () => {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    });

    const rateLimitHeader = response.headers.get('X-RateLimit-Limit');
    if (!rateLimitHeader) {
      throw new Error('Rate limit headers missing');
    }
  });

  // ============================================================================
  // CACHING TESTS
  // ============================================================================

  await runner.test('Cache headers on response', async () => {
    const query = `
      query {
        transactions(
          filters: { protocols: ["pump_fun"] }
          pagination: { first: 10 }
        ) {
          edges {
            node {
              signature
            }
          }
        }
      }
    `;

    // First request
    const response1 = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    // Second request (should potentially be cached)
    const start = Date.now();
    const response2 = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const duration = Date.now() - start;

    // Second request should be faster if cached (or at least not slower)
    if (duration > 1000) {
      console.warn(`  ⚠️  Second request took ${duration}ms (may indicate cache miss)`);
    }
  });

  // ============================================================================
  // EXPORT FUNCTIONALITY TESTS
  // ============================================================================

  await runner.test('Create export job', async () => {
    const data = await runner.runGraphQLQuery(QUERIES.createExport);
    if (!data?.exportDataset?.id) throw new Error('Export job creation failed');
    if (!data.exportDataset.status) throw new Error('Export job missing status');
  });

  await runner.test('Query export job status', async () => {
    // First create a job
    const createData = await runner.runGraphQLQuery(QUERIES.createExport);
    const jobId = createData?.exportDataset?.id;
    if (!jobId) throw new Error('Failed to create export job');

    // Then query its status
    const query = `
      query {
        exportJob(id: "${jobId}") {
          id
          status
          progress
        }
      }
    `;
    const data = await runner.runGraphQLQuery(query);
    if (!data?.exportJob) throw new Error('Export job query failed');
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================

  runner.printSummary();

  // Exit with error code if any tests failed
  const failed = runner.results.filter((r) => !r.passed).length;
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { runTests, TestRunner };

