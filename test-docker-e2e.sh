#!/bin/bash
# End-to-End Docker Infrastructure Test Suite
# Tests all components of the MCP Hub Docker setup

set -e

echo "🧪 Starting Docker E2E Test Suite"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS:${NC} $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL:${NC} $2"
        ((TESTS_FAILED++))
    fi
}

echo -e "${YELLOW}Phase 1: Container Lifecycle${NC}"
echo "----------------------------"

# Test 1: Container builds successfully
echo "Test 1: Building container..."
docker-compose build > /dev/null 2>&1
test_result $? "Container builds without errors"

# Test 2: Container starts successfully  
echo "Test 2: Starting container..."
docker-compose up -d > /dev/null 2>&1
test_result $? "Container starts successfully"

# Wait for container to be ready
echo "Waiting for container to be ready..."
sleep 10

# Test 3: Container is running
echo "Test 3: Checking container status..."
CONTAINER_RUNNING=$(docker-compose ps -q yamcp-ui | wc -l)
test_result $([ $CONTAINER_RUNNING -eq 1 ] && echo 0 || echo 1) "Container is running"

echo -e "\n${YELLOW}Phase 2: Service Health Checks${NC}"
echo "-------------------------------"

# Test 4: PM2 is managing the backend process
echo "Test 4: Checking PM2 status..."
PM2_STATUS=$(docker exec yamcp-ui-dev sh -c "ps aux | grep 'yamcp-ui-backend-hub' | grep -v grep" | wc -l)
test_result $([ $PM2_STATUS -gt 0 ] && echo 0 || echo 1) "PM2 is managing backend process"

# Test 5: Frontend is accessible
echo "Test 5: Testing frontend accessibility..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173)
test_result $([ "$FRONTEND_RESPONSE" = "200" ] && echo 0 || echo 1) "Frontend returns HTTP 200"

# Test 6: Backend API is accessible
echo "Test 6: Testing backend API..."
API_RESPONSE=$(docker exec yamcp-ui-dev wget -q -O - http://localhost:8765/api/stats 2>/dev/null | grep -c "totalServers")
test_result $([ $API_RESPONSE -gt 0 ] && echo 0 || echo 1) "Backend API returns valid JSON"

echo -e "\n${YELLOW}Phase 3: Configuration Management${NC}"
echo "----------------------------------"

# Test 7: Can add server via API
echo "Test 7: Adding test server via API..."
ADD_SERVER_RESULT=$(docker exec yamcp-ui-dev wget -q -O - --post-data='{"name":"e2e-test-server","type":"stdio","command":"echo","args":["E2E Test"]}' --header="Content-Type: application/json" http://localhost:8765/api/servers 2>/dev/null | grep -c "success")
test_result $([ $ADD_SERVER_RESULT -gt 0 ] && echo 0 || echo 1) "Can add server via API"

# Test 8: Can add workspace via API  
echo "Test 8: Adding test workspace via API..."
ADD_WORKSPACE_RESULT=$(docker exec yamcp-ui-dev wget -q -O - --post-data='{"name":"e2e-test-workspace","servers":["e2e-test-server"]}' --header="Content-Type: application/json" http://localhost:8765/api/workspaces 2>/dev/null | grep -c "success")
test_result $([ $ADD_WORKSPACE_RESULT -gt 0 ] && echo 0 || echo 1) "Can add workspace via API"

# Test 9: Configuration persists in files
echo "Test 9: Checking configuration persistence..."
CONFIG_PERSISTED=$(docker exec yamcp-ui-dev sh -c "grep -c 'e2e-test-server' /root/.local/share/yamcp-nodejs/providers.json 2>/dev/null || echo 0")
test_result $([ $CONFIG_PERSISTED -gt 0 ] && echo 0 || echo 1) "Configuration persists to files"

echo -e "\n${YELLOW}Phase 4: SSE Endpoint Functionality${NC}"
echo "-----------------------------------"

# Test 10: SSE endpoint returns proper headers
echo "Test 10: Testing SSE endpoint headers..."
SSE_HEADERS=$(curl -s -I http://localhost:8765/mcp/e2e-test-workspace | grep -c "text/event-stream")
test_result $([ $SSE_HEADERS -gt 0 ] && echo 0 || echo 1) "SSE endpoint returns correct headers"

# Test 11: SSE endpoint streams process output
echo "Test 11: Testing SSE process execution..."
SSE_OUTPUT=$(timeout 5 curl -s http://localhost:8765/mcp/e2e-test-workspace 2>/dev/null | grep -c "E2E Test" || echo 0)
test_result $([ $SSE_OUTPUT -gt 0 ] && echo 0 || echo 1) "SSE endpoint streams process output"

# Test 12: Invalid workspace returns error
echo "Test 12: Testing invalid workspace handling..."
INVALID_WORKSPACE=$(timeout 3 curl -s http://localhost:8765/mcp/nonexistent-workspace 2>/dev/null | grep -c "not found" || echo 0)
test_result $([ $INVALID_WORKSPACE -gt 0 ] && echo 0 || echo 1) "Invalid workspace returns proper error"

echo -e "\n${YELLOW}Phase 5: Hot Reloading${NC}"
echo "----------------------"

# Test 13: PM2 hot reloading on config change
echo "Test 13: Testing PM2 hot reloading..."
# Get current PM2 process start time
BEFORE_RESTART=$(docker exec yamcp-ui-dev sh -c "ps -o lstart= -p \$(pgrep -f yamcp-ui-backend-hub)" 2>/dev/null || echo "")

# Trigger config change
docker exec yamcp-ui-dev sh -c "echo '{}' > /root/.local/share/yamcp-nodejs/providers.json" 2>/dev/null

# Wait for restart
sleep 5

# Get new process start time
AFTER_RESTART=$(docker exec yamcp-ui-dev sh -c "ps -o lstart= -p \$(pgrep -f yamcp-ui-backend-hub)" 2>/dev/null || echo "")

# Check if process restarted (different start times)
RESTART_WORKED=$([ "$BEFORE_RESTART" != "$AFTER_RESTART" ] && [ -n "$AFTER_RESTART" ] && echo 0 || echo 1)
test_result $RESTART_WORKED "PM2 hot reloading works on config changes"

echo -e "\n${YELLOW}Phase 6: Error Handling${NC}"
echo "-----------------------"

# Test 14: Process cleanup on connection close
echo "Test 14: Testing process cleanup..."
# Start a long-running process via SSE in background
timeout 2 curl -s http://localhost:8765/mcp/e2e-test-workspace > /dev/null 2>&1 &
SSE_PID=$!

# Wait a moment for process to start
sleep 1

# Kill the curl connection
kill $SSE_PID 2>/dev/null || true

# Wait for cleanup
sleep 2

# Check if echo processes are cleaned up (there should be very few or none)
LEFTOVER_PROCESSES=$(docker exec yamcp-ui-dev sh -c "pgrep echo | wc -l" 2>/dev/null || echo 0)
test_result $([ $LEFTOVER_PROCESSES -le 1 ] && echo 0 || echo 1) "Process cleanup works on connection close"

echo -e "\n${YELLOW}Phase 7: Container Resilience${NC}"
echo "-----------------------------"

# Test 15: Container restart preserves functionality
echo "Test 15: Testing container restart..."
docker-compose restart > /dev/null 2>&1

# Wait for restart
sleep 15

# Test if API still works after restart
API_AFTER_RESTART=$(docker exec yamcp-ui-dev wget -q -O - http://localhost:8765/api/stats 2>/dev/null | grep -c "totalServers" || echo 0)
test_result $([ $API_AFTER_RESTART -gt 0 ] && echo 0 || echo 1) "Container restart preserves functionality"

echo -e "\n${YELLOW}Test Results Summary${NC}"
echo "===================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}ALL TESTS PASSED!${NC} Docker infrastructure is fully functional."
    exit 0
else
    echo -e "\n⚠️  ${RED}SOME TESTS FAILED!${NC} Review the output above for details."
    exit 1
fi