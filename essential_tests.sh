#!/bin/bash
# 5 Essential Tests - What Actually Matters

set -e

echo "🧪 5 Essential Docker Infrastructure Tests"
echo "========================================"

PASS=0
FAIL=0

test_result() {
    if [ $1 -eq 0 ]; then
        echo "✅ $2"
        ((PASS++))
    else
        echo "❌ $2"
        ((FAIL++))
    fi
}

# Test 1: Container Health
echo "Test 1: Container Health"
CONTAINER_UP=$(docker-compose ps -q yamcp-ui | wc -l)
test_result $([ $CONTAINER_UP -eq 1 ] && echo 0 || echo 1) "Container is running"

# Test 2: API Functional  
echo "Test 2: API Functional"
API_WORKS=$(docker exec yamcp-ui-dev wget -q -O - http://localhost:8765/api/stats 2>/dev/null | grep -c "totalServers" || echo 0)
test_result $([ $API_WORKS -gt 0 ] && echo 0 || echo 1) "API returns valid JSON"

# Test 3: SSE Streaming
echo "Test 3: SSE Streaming"
# Add a simple test server first
docker exec yamcp-ui-dev wget -q -O - --post-data='{"name":"test-server","type":"stdio","command":"echo","args":["TEST"]}' --header="Content-Type: application/json" http://localhost:8765/api/servers >/dev/null 2>&1
docker exec yamcp-ui-dev wget -q -O - --post-data='{"name":"test-workspace","servers":["test-server"]}' --header="Content-Type: application/json" http://localhost:8765/api/workspaces >/dev/null 2>&1

SSE_WORKS=$(timeout 5 curl -s http://localhost:8765/mcp/test-workspace 2>/dev/null | grep -c "TEST" || echo 0)
test_result $([ $SSE_WORKS -gt 0 ] && echo 0 || echo 1) "SSE endpoint streams output"

# Test 4: Hot Reloading
echo "Test 4: Hot Reloading"
BEFORE=$(docker exec yamcp-ui-dev sh -c "ps -o lstart= -p \$(pgrep -f yamcp-ui-backend-hub)" 2>/dev/null || echo "")
docker exec yamcp-ui-dev sh -c "echo 'trigger' >> /root/.local/share/yamcp-nodejs/providers.json" 2>/dev/null
sleep 3
AFTER=$(docker exec yamcp-ui-dev sh -c "ps -o lstart= -p \$(pgrep -f yamcp-ui-backend-hub)" 2>/dev/null || echo "")
HOT_RELOAD_WORKS=$([ "$BEFORE" != "$AFTER" ] && [ -n "$AFTER" ] && echo 0 || echo 1)
test_result $HOT_RELOAD_WORKS "PM2 hot reloading works"

# Test 5: Process Cleanup
echo "Test 5: Process Cleanup"
# Start SSE in background, then kill it
timeout 2 curl -s http://localhost:8765/mcp/test-workspace >/dev/null 2>&1 &
SSE_PID=$!
sleep 1
kill $SSE_PID 2>/dev/null || true
sleep 2
LEFTOVER=$(docker exec yamcp-ui-dev sh -c "pgrep echo | wc -l" 2>/dev/null || echo 0)
test_result $([ $LEFTOVER -le 1 ] && echo 0 || echo 1) "Process cleanup works"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] && echo "🎉 All essential tests passed!" || echo "⚠️ Some tests failed"