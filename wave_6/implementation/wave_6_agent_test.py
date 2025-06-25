#!/usr/bin/env python3
"""
Wave 6: SmolAgents Test Client
Tests the composed MCP workspace using smolagents, connecting via SSE
Based on the concise pattern from nicknochnack/MCPin10
"""
from smolagents import ToolCallingAgent, MCPClient, LiteLLMModel

def main():
    """Test the composed workspace with smolagents"""
    print("Connecting to composed MCP workspace via SSE...")
    
    # Model configuration using LiteLLM with Ollama
    model = LiteLLMModel(
        model_id="ollama_chat/qwen2.5-coder:32b",
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
            add_base_tools=True
        )
        
        # List available tools
        print("\nAvailable MCP tools:")
        for tool in mcp_tools:
            print(f"  - {tool.name}: {tool.description}")
        
        print("\n" + "="*60)
        
        # Test 1: Perplexity search
        print("\nTest 1: Testing Perplexity search capabilities")
        result1 = agent.run("What is FastMCP and how does it work?")
        print(f"Result: {result1}")
        
        print("\n" + "="*60)
        
        # Test 2: Sequential thinking
        print("\nTest 2: Testing Sequential thinking capabilities")
        result2 = agent.run("Create a step-by-step plan to learn Python web development")
        print(f"Result: {result2}")
        
        print("\n" + "="*60)
        
        # Test 3: Combined capabilities
        print("\nTest 3: Testing combined capabilities")
        result3 = agent.run(
            "Research the latest trends in AI agents and create a structured plan "
            "for building a simple AI agent application"
        )
        print(f"Result: {result3}")

if __name__ == "__main__":
    main()