#!/usr/bin/env python3
"""
Test script for the FastMCP Dev Server API
"""
import requests
import json
import time
import sys

BASE_URL = "http://localhost:8000"

def test_create_workspace():
    """Test creating a workspace"""
    workspace_name = "test-workspace"
    config = {
        "name": workspace_name,
        "servers": {
            "test-server": {
                "command": "test-command",
                "args": []
            }
        }
    }
    
    response = requests.post(
        f"{BASE_URL}/api/workspaces/{workspace_name}",
        json=config
    )
    
    print(f"Create workspace response: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    
    return response.status_code == 200

def test_list_workspaces():
    """Test listing workspaces"""
    response = requests.get(f"{BASE_URL}/api/workspaces")
    
    print(f"List workspaces response: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    
    return response.status_code == 200

def test_delete_workspace():
    """Test deleting a workspace"""
    workspace_name = "test-workspace"
    response = requests.delete(f"{BASE_URL}/api/workspaces/{workspace_name}")
    
    print(f"Delete workspace response: {response.status_code}")
    if response.status_code == 200:
        print(json.dumps(response.json(), indent=2))
    
    return response.status_code == 200

def test_stats():
    """Test getting stats"""
    response = requests.get(f"{BASE_URL}/api/stats")
    
    print(f"Stats response: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    
    return response.status_code == 200

def main():
    """Run all tests"""
    print("Testing FastMCP Dev Server API...")
    print("=================================")
    
    # Wait for server to be ready
    print("Waiting for server to be ready...")
    max_retries = 5
    for i in range(max_retries):
        try:
            requests.get(f"{BASE_URL}/docs")
            print("Server is ready!")
            break
        except requests.exceptions.ConnectionError:
            if i < max_retries - 1:
                print(f"Server not ready, retrying in 2 seconds... ({i+1}/{max_retries})")
                time.sleep(2)
            else:
                print("Server not available. Make sure it's running with 'python dev_server.py serve'")
                sys.exit(1)
    
    # Run tests
    tests = [
        ("Create workspace", test_create_workspace),
        ("List workspaces", test_list_workspaces),
        ("Get stats", test_stats),
        ("Delete workspace", test_delete_workspace),
        ("List workspaces after delete", test_list_workspaces),
    ]
    
    success = True
    for name, test_func in tests:
        print(f"\nRunning test: {name}")
        print("-" * (14 + len(name)))
        try:
            result = test_func()
            if result:
                print(f"✅ {name}: PASSED")
            else:
                print(f"❌ {name}: FAILED")
                success = False
        except Exception as e:
            print(f"❌ {name}: ERROR - {str(e)}")
            success = False
    
    print("\nTest Summary")
    print("===========")
    if success:
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed.")
        sys.exit(1)

if __name__ == "__main__":
    main()