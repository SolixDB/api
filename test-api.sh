#!/bin/bash

# SolixDB API Test Suite
# Tests all REST endpoints, GraphQL, and health check

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
API_BASE="${BASE_URL}/api/v1"
GRAPHQL_URL="${BASE_URL}/graphql"
HEALTH_URL="${BASE_URL}/health"

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
    
    if [ -n "$data" ]; then
        curl -s -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -w "\n%{http_code}"
    else
        curl -s -X "$method" "$url" \
            -w "\n%{http_code}"
    fi
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
    
    if [ "$http_code" = "200" ]; then
        print_test "GET /analytics/protocols - Status 200" "PASS"
    else
        print_test "GET /analytics/protocols - Status 200" "FAIL"
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

