#!/usr/bin/env python3
"""
Setup script to configure the test MCP server in yamcp
This will create the provider and workspace configuration via the API
"""

import requests
import json
import sys
import os

def setup_test_server():
    """Setup test server via yamcp-ui API"""
    
    # Configuration for our test server
    test_server_config = {
        "name": "test-server", 
        "type": "stdio",
        "command": "python3",
        "args": [os.path.abspath("simple_mcp_server.py")]
    }
    
    test_workspace_config = {
        "name": "test-workspace",
        "servers": ["test-server"]
    }
    
    try:
        # Add the test server
        print("Adding test server...")
        response = requests.post(
            "http://localhost:8765/api/servers",
            json=test_server_config,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print(f"✅ Server added: {response.json()}")
        else:
            print(f"❌ Failed to add server: {response.status_code} - {response.text}")
            return False
            
        # Add the test workspace
        print("Adding test workspace...")
        response = requests.post(
            "http://localhost:8765/api/workspaces", 
            json=test_workspace_config,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print(f"✅ Workspace added: {response.json()}")
        else:
            print(f"❌ Failed to add workspace: {response.status_code} - {response.text}")
            return False
            
        print("\n🎉 Test setup complete! You can now:")
        print("1. Test the SSE endpoint: curl -N http://localhost:8765/mcp/test-workspace")
        print("2. Run the smolagent test: python test_sse_client.py")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to yamcp-ui at http://localhost:8765")
        print("Make sure the Docker container is running with docker-compose up")
        return False
    except Exception as e:
        print(f"❌ Error during setup: {e}")
        return False

if __name__ == "__main__":
    success = setup_test_server()
    sys.exit(0 if success else 1)