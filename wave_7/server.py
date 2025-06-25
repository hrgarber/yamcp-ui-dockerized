#!/usr/bin/env python3
"""
Wave 7: MCP Server Composition using FastMCP
Demonstrates mounting actual MCP servers via FastMCP's config proxy
Following the MCPin10 pattern by nicknochnack
"""
import os
from pathlib import Path
from colorama import Fore
from fastmcp import FastMCP

# Load environment variables from .env file
env_path = Path(__file__).parent / '.env'
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
    print(Fore.GREEN + "Wave 7: Creating workspace with real MCP servers...", flush=True)
    
    # Check if API key is loaded
    if not os.getenv("PERPLEXITY_API_KEY"):
        print(Fore.YELLOW + "\n⚠️  Warning: PERPLEXITY_API_KEY not found in environment!", flush=True)
        print(Fore.YELLOW + "   Please create a .env file in wave_7/ with your API key.", flush=True)
        print(Fore.YELLOW + "   The perplexity server may not work without it.\n", flush=True)
    
    # FastMCP can create a proxy from a config dict - following MCPin10 pattern
    workspace = FastMCP.as_proxy(
        WORKSPACE_CONFIG,
        name="Wave7Workspace"
    )
    
    print(Fore.CYAN + "\n✓ Workspace created with mounted servers:", flush=True)
    print(Fore.CYAN + "  - perplexity (search capabilities)", flush=True)
    print(Fore.CYAN + "  - sequential-thinking (reasoning capabilities)", flush=True)
    print(Fore.MAGENTA + "\nStarting SSE server on http://localhost:8000/sse", flush=True)
    print(Fore.MAGENTA + "\nTools will be prefixed with server names:", flush=True)
    print(Fore.MAGENTA + "  - perplexity_*", flush=True)
    print(Fore.MAGENTA + "  - sequential_*", flush=True)
    print(Fore.RED + "\nPress Ctrl+C to stop the server", flush=True)
    
    # Run with SSE transport
    workspace.run(
        transport="sse",
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

# Kick off server if file is run
if __name__ == "__main__":
    main()