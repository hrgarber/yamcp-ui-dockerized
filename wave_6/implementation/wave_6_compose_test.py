#!/usr/bin/env python3
"""
Wave 6: Real MCP Server Composition Test
Demonstrates mounting actual MCP servers via FastMCP's config proxy
"""
import os
from pathlib import Path
from fastmcp import FastMCP

# Load environment variables from .env file
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                os.environ[key] = value

# Configuration matching UI format with API key from environment
WORKSPACE_CONFIG = {
    "mcpServers": {
        "perplexity": {
            "command": "npx",
            "args": ["-y", "perplexity-mcp"],
            "env": {
                "PERPLEXITY_API_KEY": os.getenv("PERPLEXITY_API_KEY", "")
            }
        },
        "sequential-thinking": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
        }
    }
}

def main():
    """Create and run composed workspace server"""
    print("Creating workspace with real MCP servers...")
    
    # Check if API key is loaded
    if not os.getenv("PERPLEXITY_API_KEY"):
        print("\n⚠️  Warning: PERPLEXITY_API_KEY not found in environment!")
        print("   Please create a .env file in wave_6/ with your API key.")
        print("   The perplexity server may not work without it.\n")
    
    # FastMCP can create a proxy from a config dict!
    workspace = FastMCP.as_proxy(
        WORKSPACE_CONFIG,
        name="TestWorkspace"
    )
    
    print("\n✓ Workspace created with mounted servers:")
    print("  - perplexity (search capabilities)")
    print("  - sequential-thinking (reasoning capabilities)")
    print("\nStarting SSE server on http://localhost:8000/sse")
    print("\nTools will be prefixed with server names:")
    print("  - perplexity_*")
    print("  - sequential_*")
    print("\nPress Ctrl+C to stop the server")
    
    # Run with SSE transport
    workspace.run(
        transport="sse",
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

if __name__ == "__main__":
    main()