#!/usr/bin/env python3
"""
Simple test MCP server for testing the SSE endpoint
Based on the MCPin10 example but simplified for testing
"""

from mcp.server.fastmcp import FastMCP
from datetime import datetime
import random

# Create server 
mcp = FastMCP("test-server")

# Add a simple prompt
@mcp.prompt()
def test_prompt(data: str) -> str:
    """Simple test prompt template"""
    return f"""You are a helpful test assistant. 
    Please process this data: {data}
    Current time: {datetime.now().isoformat()}"""

# Add a simple resource
@mcp.resource("test://echo/{message}")
def echo_resource(message: str) -> str:
    """Echo resource that returns the message with timestamp
    
    Args:
        message: Message to echo back
        
    Returns:
        str: Echoed message with timestamp
    """
    return f"Echo at {datetime.now().isoformat()}: {message}"

# Add a simple tool
@mcp.tool()
def get_random_number(min_val: int = 0, max_val: int = 100) -> str:
    """Generate a random number between min and max values
    
    Args:
        min_val: Minimum value (default 0)
        max_val: Maximum value (default 100)
        
    Returns:
        str: Random number as string
    """
    number = random.randint(min_val, max_val)
    return f"Random number: {number}"

# Add another tool for testing
@mcp.tool()
def get_system_time() -> str:
    """Get the current system time
    
    Returns:
        str: Current time in ISO format
    """
    return f"Current time: {datetime.now().isoformat()}"

# Run the server
if __name__ == "__main__":
    # This will output to stdio which our SSE endpoint will capture
    mcp.run(transport="stdio")