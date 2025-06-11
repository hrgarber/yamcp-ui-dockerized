#!/usr/bin/env python3
"""
Test client using smolagents to connect to our MCP Hub via SSE
This will test the SSE endpoint we created at /mcp/:workspaceName
"""

import requests
import sseclient
import json
from smolagents import CodeAgent, HfApiModel, ToolCallingAgent
from smolagents.tools import Tool
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MCPSSETool(Tool):
    """Custom tool that connects to MCP server via SSE"""
    
    def __init__(self, workspace_name: str, hub_url: str = "http://localhost:8765"):
        super().__init__()
        self.workspace_name = workspace_name
        self.hub_url = hub_url
        self.sse_url = f"{hub_url}/mcp/{workspace_name}"
        
    @property
    def name(self):
        return f"mcp_{self.workspace_name}"
    
    @property
    def description(self):
        return f"Connect to MCP workspace '{self.workspace_name}' via SSE and execute commands"
    
    @property 
    def inputs(self):
        return {
            "command": {
                "type": "string",
                "description": "The command to send to the MCP server"
            }
        }
    
    @property
    def output_type(self):
        return "string"
    
    def forward(self, command: str) -> str:
        """Connect to SSE endpoint and send command"""
        try:
            # Connect to SSE endpoint
            logger.info(f"Connecting to SSE endpoint: {self.sse_url}")
            response = requests.get(self.sse_url, stream=True, headers={
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache'
            })
            
            # Create SSE client
            client = sseclient.SSEClient(response)
            
            # Collect responses
            messages = []
            for event in client.events():
                logger.info(f"Received event: {event.event} - {event.data}")
                messages.append(event.data)
                
                # Stop after receiving a few messages for testing
                if len(messages) >= 5:
                    break
                    
            return "\n".join(messages)
            
        except Exception as e:
            logger.error(f"Error connecting to SSE: {e}")
            return f"Error: {str(e)}"

class TestSSEAgent:
    """Test agent that uses the MCP SSE tool"""
    
    def __init__(self, workspace_name: str):
        # Create the MCP SSE tool
        self.mcp_tool = MCPSSETool(workspace_name)
        
        # Initialize the agent with HuggingFace model
        self.model = HfApiModel(model_id="Qwen/Qwen2.5-Coder-0.5B-Instruct")
        
        # Create a tool-calling agent
        self.agent = ToolCallingAgent(
            tools=[self.mcp_tool],
            model=self.model,
            max_steps=5
        )
    
    def test_connection(self):
        """Test the SSE connection"""
        logger.info("Testing SSE connection to MCP Hub...")
        
        # Try to connect and get some data
        result = self.agent.run(
            "Connect to the MCP server and get the current system time"
        )
        
        logger.info(f"Agent result: {result}")
        return result

def main():
    """Main test function"""
    # Create test agent for our test workspace
    agent = TestSSEAgent("test-workspace")
    
    # Run the test
    result = agent.test_connection()
    
    print(f"\nTest Result: {result}")

if __name__ == "__main__":
    main()