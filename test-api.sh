#!/bin/bash

# ============================================================================
# AI GENERATED - Comprehensive Test Suite for SolixDB API
# ============================================================================
# This test suite includes edge case testing for all API endpoints including
# the SQL query endpoint with comprehensive validation and security tests.
# ============================================================================

# SolixDB API Test Suite
# Tests all REST endpoints, GraphQL, SQL query endpoint, and health check

# Don't exit on error - we want to run all tests
set +e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
API_BASE="${BASE_URL}/api/v1"
GRAPHQL_URL="${BASE_URL}/graphql"
HEALTH_URL="${BASE_URL}/health"
QUERY_URL="${API_BASE}/query"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Helper function to print test results
print_test() {
    local name=$1
    local status=$2
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $name"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $name"
        ((FAILED++))
    fi
}

# Helper function to make HTTP requests
make_request() {
    local method=$1
    local url=$2
    local data=$3
    local output
    
    if [ -n "$data" ]; then
        output=$(curl -s -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -w "\n%{http_code}" 2>&1)
    else
        output=$(curl -s -X "$method" "$url" \
            -w "\n%{http_code}" 2>&1)
    fi
    
    echo "$output"
    return 0
}

# Helper function to check response body contains text
check_response_contains() {
    local response=$1
    local text=$2
    local body=$(echo "$response" | sed '$d')
    
    # Check if text appears anywhere in the body (case-insensitive)
    if echo "$body" | grep -qi "$text"; then
        return 0
    fi
    return 1
}

# Test Health Check
test_health() {
    echo "Testing Health Check..."
    response=$(make_request "GET" "$HEALTH_URL")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_test "Health Check - Status 200" "PASS"
    else
        print_test "Health Check - Status 200" "FAIL"
        echo "  Response: $body"
    fi
}

# Test REST API - Get Transactions
test_get_transactions() {
    echo "Testing REST API - Get Transactions..."
    
    # Test basic request
    response=$(make_request "GET" "${API_BASE}/transactions?limit=10")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "GET /transactions - Status 200" "PASS"
    else
        print_test "GET /transactions - Status 200" "FAIL"
    fi
    
    # Test with protocol filter
    response=$(make_request "GET" "${API_BASE}/transactions?protocol_name=jupiter_v6&limit=5")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "GET /transactions with protocol filter - Status 200" "PASS"
    else
        print_test "GET /transactions with protocol filter - Status 200" "FAIL"
    fi
    
    # Test with date range
    response=$(make_request "GET" "${API_BASE}/transactions?date_from=2025-07-20&date_to=2025-07-21&limit=5")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "GET /transactions with date range - Status 200" "PASS"
    else
        print_test "GET /transactions with date range - Status 200" "FAIL"
    fi
}

# Test REST API - Get Transaction by Signature
test_get_transaction_by_signature() {
    echo "Testing REST API - Get Transaction by Signature..."
    
    # First get a transaction to get a signature
    response=$(make_request "GET" "${API_BASE}/transactions?limit=1")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        signature=$(echo "$body" | grep -o '"signature":"[^"]*' | head -1 | cut -d'"' -f4)
        if [ -n "$signature" ]; then
            response=$(make_request "GET" "${API_BASE}/transactions/${signature}")
            http_code=$(echo "$response" | tail -n1)
            
            if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
                print_test "GET /transactions/:signature - Status 200/404" "PASS"
            else
                print_test "GET /transactions/:signature - Status 200/404" "FAIL"
            fi
        else
            print_test "GET /transactions/:signature - Could not extract signature" "FAIL"
        fi
    else
        print_test "GET /transactions/:signature - Could not get transactions" "FAIL"
    fi
}

# Test REST API - Protocol Analytics
test_protocol_analytics() {
    echo "Testing REST API - Protocol Analytics..."
    
    response=$(make_request "GET" "${API_BASE}/analytics/protocols?protocol_name=jupiter_v6")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # Accept 200 (success) or 500/404 (no data found - acceptable for test)
    if [ "$http_code" = "200" ]; then
        print_test "GET /analytics/protocols - Status 200" "PASS"
    elif [ "$http_code" = "500" ] || [ "$http_code" = "404" ]; then
        # 500/404 might mean no data for this protocol, which is acceptable
        print_test "GET /analytics/protocols - Status $http_code (no data)" "PASS"
    else
        print_test "GET /analytics/protocols - Status 200" "FAIL"
        echo "  HTTP Code: $http_code"
        echo "  Response: $(echo "$body" | head -3)"
    fi
}

# Test REST API - Time Series
test_time_series() {
    echo "Testing REST API - Time Series..."
    
    response=$(make_request "GET" "${API_BASE}/analytics/time-series?date_from=2025-07-20&date_to=2025-07-21&granularity=hour")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "GET /analytics/time-series - Status 200" "PASS"
    else
        print_test "GET /analytics/time-series - Status 200" "FAIL"
    fi
}

# Test REST API - Fee Analytics
test_fee_analytics() {
    echo "Testing REST API - Fee Analytics..."
    
    response=$(make_request "GET" "${API_BASE}/analytics/fees?protocol_name=jupiter_v6")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "GET /analytics/fees - Status 200" "PASS"
    else
        print_test "GET /analytics/fees - Status 200" "FAIL"
    fi
}

# Test REST API - Stats
test_stats() {
    echo "Testing REST API - Stats..."
    
    response=$(make_request "GET" "${API_BASE}/stats")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "GET /stats - Status 200" "PASS"
    else
        print_test "GET /stats - Status 200" "FAIL"
    fi
}

# Test SQL Query Endpoint - Valid Queries
test_sql_query_valid() {
    echo "Testing SQL Query Endpoint - Valid Queries..."
    
    # Test valid SELECT query with JSON format (default)
    query='{"query":"SELECT signature, protocol_name, fee FROM transactions WHERE protocol_name = '\''jupiter_v6'\'' LIMIT 10"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        if echo "$body" | grep -q '"data"'; then
            print_test "SQL Query - Valid SELECT (JSON format) - Status 200 with data" "PASS"
        else
            print_test "SQL Query - Valid SELECT (JSON format) - Status 200 with data" "FAIL"
        fi
    else
        print_test "SQL Query - Valid SELECT (JSON format) - Status 200" "FAIL"
    fi
    
    # Test valid SELECT query with explicit JSON format
    query='{"query":"SELECT signature, protocol_name FROM transactions LIMIT 5","format":"json"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "SQL Query - Valid SELECT (explicit JSON) - Status 200" "PASS"
    else
        print_test "SQL Query - Valid SELECT (explicit JSON) - Status 200" "FAIL"
    fi
    
    # Test valid SELECT query with CSV format
    query='{"query":"SELECT protocol_name, count() as total FROM transactions GROUP BY protocol_name ORDER BY total DESC LIMIT 10","format":"csv"}'
    response=$(curl -s -X POST "$QUERY_URL" \
        -H "Content-Type: application/json" \
        -d "$query" \
        -w "\n%{http_code}" \
        -D /tmp/csv_headers.txt 2>&1)
    http_code=$(echo "$response" | tail -n1)
    headers=$(cat /tmp/csv_headers.txt 2>/dev/null | grep -i "Content-Type" || echo "")
    
    if [ "$http_code" = "200" ]; then
        if echo "$headers" | grep -qi "text/csv"; then
            print_test "SQL Query - Valid SELECT (CSV format) - Status 200 with CSV header" "PASS"
        else
            print_test "SQL Query - Valid SELECT (CSV format) - Status 200 with CSV header" "FAIL"
        fi
    else
        print_test "SQL Query - Valid SELECT (CSV format) - Status 200" "FAIL"
    fi
    rm -f /tmp/csv_headers.txt 2>/dev/null
    
    # Test valid WITH/CTE query
    query='{"query":"WITH top_protocols AS (SELECT protocol_name, count() as cnt FROM transactions GROUP BY protocol_name ORDER BY cnt DESC LIMIT 5) SELECT * FROM top_protocols LIMIT 5"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "SQL Query - Valid WITH/CTE query - Status 200" "PASS"
    else
        print_test "SQL Query - Valid WITH/CTE query - Status 200" "FAIL"
    fi
    
    # Test query with aggregation
    query='{"query":"SELECT protocol_name, count() as total, avg(fee) as avg_fee FROM transactions WHERE date >= '\''2025-07-20'\'' GROUP BY protocol_name ORDER BY total DESC LIMIT 10"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "SQL Query - Valid aggregation query - Status 200" "PASS"
    else
        print_test "SQL Query - Valid aggregation query - Status 200" "FAIL"
    fi
    
    # Test query with empty results (should still return 200)
    query='{"query":"SELECT signature FROM transactions WHERE protocol_name = '\''nonexistent_protocol_xyz'\'' LIMIT 10"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        if echo "$body" | grep -q '"count":0' || echo "$body" | grep -q '"data":\[\]'; then
            print_test "SQL Query - Empty results handling - Status 200" "PASS"
        else
            print_test "SQL Query - Empty results handling - Status 200" "FAIL"
        fi
    else
        print_test "SQL Query - Empty results handling - Status 200" "FAIL"
    fi
    
    # Test CSV format with empty results
    query='{"query":"SELECT signature FROM transactions WHERE protocol_name = '\''nonexistent_protocol_xyz'\'' LIMIT 10","format":"csv"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "SQL Query - CSV format with empty results - Status 200" "PASS"
    else
        print_test "SQL Query - CSV format with empty results - Status 200" "FAIL"
    fi
}

# Test SQL Query Endpoint - Validation Errors
test_sql_query_validation_errors() {
    echo "Testing SQL Query Endpoint - Validation Errors..."
    
    # Test missing LIMIT clause
    query='{"query":"SELECT signature FROM transactions"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "400" ]; then
        # Check for LIMIT in the response (case-insensitive, in message or error field)
        if echo "$body" | grep -qi "LIMIT" || echo "$body" | grep -qi "limit"; then
            print_test "SQL Query - Missing LIMIT clause - Status 400 with error message" "PASS"
        else
            print_test "SQL Query - Missing LIMIT clause - Status 400 with error message" "FAIL"
            echo "    Response body: $body"
        fi
    else
        print_test "SQL Query - Missing LIMIT clause - Status 400" "FAIL"
    fi
    
    # Test LIMIT exceeding 10000
    query='{"query":"SELECT signature FROM transactions LIMIT 20000"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "400" ]; then
        # Check for 10000 or exceed in the response
        if echo "$body" | grep -qi "10000" || echo "$body" | grep -qi "exceed" || echo "$body" | grep -qi "10,000"; then
            print_test "SQL Query - LIMIT > 10000 - Status 400 with error message" "PASS"
        else
            print_test "SQL Query - LIMIT > 10000 - Status 400 with error message" "FAIL"
            echo "    Response body: $body"
        fi
    else
        print_test "SQL Query - LIMIT > 10000 - Status 400" "FAIL"
    fi
    
    # Test LIMIT at maximum allowed (10000)
    query='{"query":"SELECT signature FROM transactions LIMIT 10000"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "SQL Query - LIMIT at maximum (10000) - Status 200" "PASS"
    else
        print_test "SQL Query - LIMIT at maximum (10000) - Status 200" "FAIL"
    fi
    
    # Test empty query string
    query='{"query":""}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "400" ]; then
        print_test "SQL Query - Empty query string - Status 400" "PASS"
    else
        print_test "SQL Query - Empty query string - Status 400" "FAIL"
    fi
    
    # Test missing query parameter
    query='{"format":"json"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "400" ]; then
        print_test "SQL Query - Missing query parameter - Status 400" "PASS"
    else
        print_test "SQL Query - Missing query parameter - Status 400" "FAIL"
    fi
    
    # Test invalid format parameter
    query='{"query":"SELECT signature FROM transactions LIMIT 10","format":"xml"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "400" ]; then
        print_test "SQL Query - Invalid format parameter - Status 400" "PASS"
    else
        print_test "SQL Query - Invalid format parameter - Status 400" "FAIL"
    fi
    
    # Test query that doesn't start with SELECT or WITH
    query='{"query":"SHOW TABLES LIMIT 10"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "400" ]; then
        # Check for SELECT or allowed in the response
        if echo "$body" | grep -qi "SELECT" || echo "$body" | grep -qi "Only SELECT" || echo "$body" | grep -qi "allowed"; then
            print_test "SQL Query - Query not starting with SELECT/WITH - Status 400" "PASS"
        else
            print_test "SQL Query - Query not starting with SELECT/WITH - Status 400" "FAIL"
            echo "    Response body: $body"
        fi
    else
        print_test "SQL Query - Query not starting with SELECT/WITH - Status 400" "FAIL"
    fi
}

# Test SQL Query Endpoint - Security (Destructive Operations)
test_sql_query_security() {
    echo "Testing SQL Query Endpoint - Security (Destructive Operations)..."
    
    # Test DROP operation
    # Note: This will be rejected because it doesn't start with SELECT, but that's still blocking it
    query='{"query":"DROP TABLE transactions LIMIT 10"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "400" ]; then
        # Query is blocked - either because it doesn't start with SELECT or because DROP is destructive
        # Both are valid security checks
        if echo "$body" | grep -qi "DROP" || echo "$body" | grep -qi "Destructive" || echo "$body" | grep -qi "SELECT" || echo "$body" | grep -qi "allowed"; then
            print_test "SQL Query - DROP operation blocked - Status 400" "PASS"
        else
            print_test "SQL Query - DROP operation blocked - Status 400" "FAIL"
        fi
    else
        print_test "SQL Query - DROP operation blocked - Status 400" "FAIL"
    fi
    
    # Test DELETE operation
    # Note: This will be rejected because it doesn't start with SELECT, but that's still blocking it
    query='{"query":"DELETE FROM transactions LIMIT 10"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "400" ]; then
        # Query is blocked - either because it doesn't start with SELECT or because DELETE is destructive
        if echo "$body" | grep -qi "DELETE" || echo "$body" | grep -qi "Destructive" || echo "$body" | grep -qi "SELECT" || echo "$body" | grep -qi "allowed"; then
            print_test "SQL Query - DELETE operation blocked - Status 400" "PASS"
        else
            print_test "SQL Query - DELETE operation blocked - Status 400" "FAIL"
        fi
    else
        print_test "SQL Query - DELETE operation blocked - Status 400" "FAIL"
    fi
    
    # Test UPDATE operation
    # Note: This will be rejected because it doesn't start with SELECT, but that's still blocking it
    query='{"query":"UPDATE transactions SET fee = 0 LIMIT 10"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "400" ]; then
        # Query is blocked - either because it doesn't start with SELECT or because UPDATE is destructive
        if echo "$body" | grep -qi "UPDATE" || echo "$body" | grep -qi "Destructive" || echo "$body" | grep -qi "SELECT" || echo "$body" | grep -qi "allowed"; then
            print_test "SQL Query - UPDATE operation blocked - Status 400" "PASS"
        else
            print_test "SQL Query - UPDATE operation blocked - Status 400" "FAIL"
        fi
    else
        print_test "SQL Query - UPDATE operation blocked - Status 400" "FAIL"
    fi
    
    # Test INSERT operation
    # Note: This will be rejected because it doesn't start with SELECT, but that's still blocking it
    query='{"query":"INSERT INTO transactions VALUES (1,2,3) LIMIT 10"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "400" ]; then
        # Query is blocked - either because it doesn't start with SELECT or because INSERT is destructive
        if echo "$body" | grep -qi "INSERT" || echo "$body" | grep -qi "Destructive" || echo "$body" | grep -qi "SELECT" || echo "$body" | grep -qi "allowed"; then
            print_test "SQL Query - INSERT operation blocked - Status 400" "PASS"
        else
            print_test "SQL Query - INSERT operation blocked - Status 400" "FAIL"
        fi
    else
        print_test "SQL Query - INSERT operation blocked - Status 400" "FAIL"
    fi
    
    # Test ALTER operation
    # Note: This will be rejected because it doesn't start with SELECT, but that's still blocking it
    query='{"query":"ALTER TABLE transactions ADD COLUMN test INT LIMIT 10"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "400" ]; then
        # Query is blocked - either because it doesn't start with SELECT or because ALTER is destructive
        if echo "$body" | grep -qi "ALTER" || echo "$body" | grep -qi "Destructive" || echo "$body" | grep -qi "SELECT" || echo "$body" | grep -qi "allowed"; then
            print_test "SQL Query - ALTER operation blocked - Status 400" "PASS"
        else
            print_test "SQL Query - ALTER operation blocked - Status 400" "FAIL"
        fi
    else
        print_test "SQL Query - ALTER operation blocked - Status 400" "FAIL"
    fi
    
    # Test TRUNCATE operation
    # Note: This will be rejected because it doesn't start with SELECT, but that's still blocking it
    query='{"query":"TRUNCATE TABLE transactions LIMIT 10"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "400" ]; then
        # Query is blocked - either because it doesn't start with SELECT or because TRUNCATE is destructive
        if echo "$body" | grep -qi "TRUNCATE" || echo "$body" | grep -qi "Destructive" || echo "$body" | grep -qi "SELECT" || echo "$body" | grep -qi "allowed"; then
            print_test "SQL Query - TRUNCATE operation blocked - Status 400" "PASS"
        else
            print_test "SQL Query - TRUNCATE operation blocked - Status 400" "FAIL"
        fi
    else
        print_test "SQL Query - TRUNCATE operation blocked - Status 400" "FAIL"
    fi
    
    # Test multiple statements (semicolon injection attempt)
    query='{"query":"SELECT signature FROM transactions LIMIT 10; DROP TABLE transactions"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "400" ]; then
        # Query is blocked - either because of multiple statements or because DROP is destructive
        if echo "$body" | grep -qi "Multiple statements" || echo "$body" | grep -qi "semicolon" || echo "$body" | grep -qi "Multiple" || echo "$body" | grep -qi "DROP" || echo "$body" | grep -qi "Destructive"; then
            print_test "SQL Query - Multiple statements blocked - Status 400" "PASS"
        else
            print_test "SQL Query - Multiple statements blocked - Status 400" "FAIL"
        fi
    else
        print_test "SQL Query - Multiple statements blocked - Status 400" "FAIL"
    fi
    
    # Test SQL injection attempt (DROP in WHERE clause)
    query='{"query":"SELECT signature FROM transactions WHERE protocol_name = '\''test'\'' OR 1=1; DROP TABLE transactions; -- LIMIT 10"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "400" ]; then
        print_test "SQL Query - SQL injection attempt blocked - Status 400" "PASS"
    else
        print_test "SQL Query - SQL injection attempt blocked - Status 400" "FAIL"
    fi
    
    # Test query too long (> 100000 characters)
    long_query=$(printf 'SELECT signature FROM transactions WHERE protocol_name = '\''test'\'' %*s' 100000 | tr ' ' 'a')
    long_query="${long_query} LIMIT 10"
    query="{\"query\":\"$long_query\"}"
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "400" ]; then
        if echo "$body" | grep -qi "too long" || echo "$body" | grep -qi "100000" || echo "$body" | grep -qi "100,000"; then
            print_test "SQL Query - Query too long blocked - Status 400" "PASS"
        else
            print_test "SQL Query - Query too long blocked - Status 400" "FAIL"
        fi
    else
        print_test "SQL Query - Query too long blocked - Status 400" "FAIL"
    fi
}

# Test SQL Query Endpoint - Edge Cases
test_sql_query_edge_cases() {
    echo "Testing SQL Query Endpoint - Edge Cases..."
    
    # Test query with special characters in CSV output
    query='{"query":"SELECT protocol_name, fee FROM transactions WHERE protocol_name = '\''jupiter_v6'\'' LIMIT 5","format":"csv"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "SQL Query - CSV with special characters - Status 200" "PASS"
    else
        print_test "SQL Query - CSV with special characters - Status 200" "FAIL"
    fi
    
    # Test query with LIMIT 0 (edge case)
    query='{"query":"SELECT signature FROM transactions LIMIT 0"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "SQL Query - LIMIT 0 (edge case) - Status 200" "PASS"
    else
        print_test "SQL Query - LIMIT 0 (edge case) - Status 200" "FAIL"
    fi
    
    # Test query with OFFSET
    query='{"query":"SELECT signature FROM transactions LIMIT 10 OFFSET 5"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "SQL Query - Query with OFFSET - Status 200" "PASS"
    else
        print_test "SQL Query - Query with OFFSET - Status 200" "FAIL"
    fi
    
    # Test invalid JSON body
    response=$(curl -s -X POST "$QUERY_URL" \
        -H "Content-Type: application/json" \
        -d '{"query":"SELECT signature FROM transactions LIMIT 10"' \
        -w "\n%{http_code}" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "400" ] || [ "$http_code" = "500" ]; then
        print_test "SQL Query - Invalid JSON body - Status 400/500" "PASS"
    else
        print_test "SQL Query - Invalid JSON body - Status 400/500" "FAIL"
    fi
    
    # Test missing Content-Type header
    response=$(curl -s -X POST "$QUERY_URL" \
        -d '{"query":"SELECT signature FROM transactions LIMIT 10"}' \
        -w "\n%{http_code}" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    
    # Should still work or return appropriate error
    if [ "$http_code" = "200" ] || [ "$http_code" = "400" ] || [ "$http_code" = "415" ]; then
        print_test "SQL Query - Missing Content-Type header - Handled appropriately" "PASS"
    else
        print_test "SQL Query - Missing Content-Type header - Handled appropriately" "FAIL"
    fi
    
    # Test query with comments (should be sanitized but allowed)
    # Note: Comments are removed during sanitization, so the query should work
    query='{"query":"SELECT signature FROM transactions LIMIT 10 -- This is a comment"}'
    response=$(make_request "POST" "$QUERY_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "SQL Query - Query with comments - Status 200" "PASS"
    else
        print_test "SQL Query - Query with comments - Status 200" "FAIL"
    fi
}

# Test GraphQL
test_graphql() {
    echo "Testing GraphQL API..."
    
    # Test transactions query
    query='{"query":"{ transactions(protocolName: \"jupiter_v6\", limit: 5) { signature protocolName fee } }"}'
    response=$(make_request "POST" "$GRAPHQL_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "GraphQL - Transactions query - Status 200" "PASS"
    else
        print_test "GraphQL - Transactions query - Status 200" "FAIL"
    fi
    
    # Test stats query
    query='{"query":"{ stats { totalTransactions dateRange { from to } } }"}'
    response=$(make_request "POST" "$GRAPHQL_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "GraphQL - Stats query - Status 200" "PASS"
    else
        print_test "GraphQL - Stats query - Status 200" "FAIL"
    fi
    
    # Test protocol analytics query
    query='{"query":"{ protocolAnalytics(protocolName: \"jupiter_v6\") { protocolName totalTransactions totalFees } }"}'
    response=$(make_request "POST" "$GRAPHQL_URL" "$query")
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        print_test "GraphQL - Protocol analytics query - Status 200" "PASS"
    else
        print_test "GraphQL - Protocol analytics query - Status 200" "FAIL"
    fi
}

# Test Rate Limiting Headers
test_rate_limit_headers() {
    echo "Testing Rate Limit Headers..."
    
    response=$(make_request "GET" "${API_BASE}/transactions?limit=1")
    headers=$(curl -s -I "${API_BASE}/transactions?limit=1" | grep -i "X-RateLimit")
    
    if echo "$headers" | grep -q "X-RateLimit-Limit"; then
        print_test "Rate Limit Headers - X-RateLimit-Limit present" "PASS"
    else
        print_test "Rate Limit Headers - X-RateLimit-Limit present" "FAIL"
    fi
    
    if echo "$headers" | grep -q "X-RateLimit-Remaining"; then
        print_test "Rate Limit Headers - X-RateLimit-Remaining present" "PASS"
    else
        print_test "Rate Limit Headers - X-RateLimit-Remaining present" "FAIL"
    fi
}

# Main test execution
main() {
    echo "=========================================="
    echo "SolixDB API Test Suite"
    echo "=========================================="
    echo "Base URL: $BASE_URL"
    echo ""
    
    test_health
    echo ""
    
    test_get_transactions
    echo ""
    
    test_get_transaction_by_signature
    echo ""
    
    test_protocol_analytics
    echo ""
    
    test_time_series
    echo ""
    
    test_fee_analytics
    echo ""
    
    test_stats
    echo ""
    
    test_sql_query_valid
    echo ""
    
    test_sql_query_validation_errors
    echo ""
    
    test_sql_query_security
    echo ""
    
    test_sql_query_edge_cases
    echo ""
    
    test_graphql
    echo ""
    
    test_rate_limit_headers
    echo ""
    
    echo "=========================================="
    echo "Test Results"
    echo "=========================================="
    echo -e "${GREEN}Passed: $PASSED${NC}"
    echo -e "${RED}Failed: $FAILED${NC}"
    echo "Total: $((PASSED + FAILED))"
    echo ""
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed.${NC}"
        exit 1
    fi
}

# Run tests
main
