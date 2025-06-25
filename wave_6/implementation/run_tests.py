#!/usr/bin/env python3
"""
Test runner for Wave 6 E2E tests
Ensures server is not already running and runs all tests
"""
import subprocess
import sys
import requests
import time

def check_server_running():
    """Check if server is already running on port 8000"""
    try:
        response = requests.get("http://localhost:8000")
        return True
    except:
        return False

def main():
    """Run the E2E tests"""
    print("Wave 6 E2E Test Runner")
    print("=" * 50)
    
    # Check if server is already running
    if check_server_running():
        print("⚠️  ERROR: Server already running on port 8000!")
        print("   Please stop the server before running tests.")
        sys.exit(1)
    
    print("✓ Port 8000 is available")
    print("\nRunning E2E tests...")
    print("-" * 50)
    
    # Run pytest with verbose output
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "test_wave6_e2e.py", "-v", "--tb=short"],
        cwd=sys.path[0]
    )
    
    print("-" * 50)
    if result.returncode == 0:
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed")
    
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()