#!/usr/bin/env python3
"""
Wave 7: SmolAgents Test Client
Tests the composed MCP workspace using smolagents, connecting via SSE
Following the MCPin10 pattern by nicknochnack
"""
from smolagents import ToolCallingAgent, MCPClient, LiteLLMModel
from colorama import Fore, init

# Initialize colorama for cross-platform colored output
init(autoreset=True)

def main():
    """Test the composed workspace with smolagents"""
    print(Fore.GREEN + "Wave 7: Connecting to composed MCP workspace via SSE...")
    
    # Model configuration using LiteLLM with Ollama
    # Following MCPin10 pattern but using a different model
    model = LiteLLMModel(
        model_id="ollama_chat/qwen3:14b",
        num_ctx=8192
    )
    
    # Server connection parameters for SSE
    server_params = {
        "url": "http://localhost:8000/sse",
        "transport": "sse"
    }
    
    # Connect and run test queries
    with MCPClient(server_params) as mcp_tools:
        # Create agent with MCP tools
        agent = ToolCallingAgent(
            tools=mcp_tools, 
            model=model,
            add_base_tools=True  # Only use MCP tools, not default smolagents tools
        )
        
        # List available tools
        print(Fore.CYAN + "\nAvailable MCP tools:")
        for tool in mcp_tools:
            print(Fore.CYAN + f"  - {tool.name}: {tool.description}")
        
        print(Fore.MAGENTA + "\n" + "="*60)
        
        # Test 1: Perplexity search
        print(Fore.YELLOW + "\nTest 1: Testing Perplexity search capabilities")
        result1 = agent.run("What is FastMCP and how does it work?")
        print(Fore.WHITE + f"Result: {result1}")
        
        print(Fore.MAGENTA + "\n" + "="*60)
        
        # Test 2: Sequential thinking
        print(Fore.YELLOW + "\nTest 2: Testing Sequential thinking capabilities")
        result2 = agent.run("Create a step-by-step plan to learn Python web development")
        print(Fore.WHITE + f"Result: {result2}")
        
        print(Fore.MAGENTA + "\n" + "="*60)
        
        # Test 3: Combined capabilities
        print(Fore.YELLOW + "\nTest 3: Testing combined capabilities")
        result3 = agent.run(
            "Research the latest trends in AI agents and create a structured plan "
            "for building a simple AI agent application"
        )
        print(Fore.WHITE + f"Result: {result3}")
        
        print(Fore.GREEN + "\n✓ All tests completed!")

if __name__ == "__main__":
    main()