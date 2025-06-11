"""
Test suite for Smolagents OpenAI integration with context7 MCP server.

Tests verify:
1. MCP server connectivity and tool discovery
2. Tool execution via agent
3. Response parsing and validation
"""
import os
import pytest
from smolagents import OpenAIServerModel, ToolCallingAgent, ToolCollection
from test_helpers import (
    check_critical_setup, skip_if_prerequisite_failed,
    run_agent_with_timeout, assert_library_in_result, generate_test_report
)


# Configuration
# TODO: Set OPENAI_API_KEY environment variable for testing
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
MCP_HUB_URL = "http://localhost:8765/mcp/test0"
TIMEOUT = 10  # Universal timeout for all tests


@pytest.fixture
def openai_model():
    """Fixture to provide configured OpenAI model."""
    try:
        return OpenAIServerModel(
            model_id="gpt-4.1",
            api_base="https://api.openai.com/v1",
            api_key=OPENAI_API_KEY
        )
    except Exception as e:
        pytest.fail(f"Failed to initialize OpenAI model: {str(e)}")


@pytest.fixture
def mcp_config():
    """MCP connection configuration."""
    return {"url": MCP_HUB_URL, "transport": "streamable-http"}


class TestContext7Integration:
    """Test suite for context7 MCP server integration."""
    
    @pytest.mark.timeout(TIMEOUT)
    def test_smoke_openai_api_key(self):
        """CRITICAL: Verify OpenAI API key is present and has correct format."""
        assert OPENAI_API_KEY, "OpenAI API key is not set"
        assert OPENAI_API_KEY.startswith("sk-"), f"API key has incorrect format: {OPENAI_API_KEY[:10]}..."
        assert len(OPENAI_API_KEY) > 20, f"API key seems too short: {len(OPENAI_API_KEY)} chars"
    
    @pytest.mark.timeout(TIMEOUT)
    def test_mcp_connection_and_tool_discovery(self, mcp_config):
        """CRITICAL: Test that we can connect to MCP hub and discover context7 tools."""
        try:
            with ToolCollection.from_mcp(mcp_config, trust_remote_code=True) as tool_collection:
                assert tool_collection.tools, "No tools loaded from MCP hub - check http://localhost:8765"
                
                tool_names = [tool.name for tool in tool_collection.tools]
                assert "resolve-library-id" in tool_names, f"Missing resolve-library-id. Found: {tool_names}"
                assert "get-library-docs" in tool_names, f"Missing get-library-docs. Found: {tool_names}"
                assert len(tool_names) >= 2, f"Expected at least 2 tools, got {len(tool_names)}"
                
                pytest.tool_names = tool_names
                
        except ConnectionRefusedError:
            pytest.fail(f"Cannot connect to MCP hub at {MCP_HUB_URL}. Is the hub running?")
        except Exception as e:
            pytest.fail(f"MCP connection error: {type(e).__name__}: {str(e)}")
    
    @pytest.mark.timeout(TIMEOUT)
    def test_resolve_library_id_tool_structure(self, mcp_config):
        """Test that resolve-library-id tool has correct structure."""
        skip_if_prerequisite_failed('tool_names')
            
        try:
            with ToolCollection.from_mcp(mcp_config, trust_remote_code=True) as tool_collection:
                resolve_tool = next(
                    (t for t in tool_collection.tools if t.name == "resolve-library-id"), None
                )
                
                assert resolve_tool is not None, "resolve-library-id tool not found"
                assert hasattr(resolve_tool, 'name'), "Tool missing name attribute"
                assert hasattr(resolve_tool, 'description'), "Tool missing description attribute"
                assert resolve_tool.description, "Tool description is empty"
                
        except Exception as e:
            pytest.fail(f"Tool structure error: {type(e).__name__}: {str(e)}")
    
    @pytest.mark.timeout(TIMEOUT)
    def test_agent_initialization(self, openai_model, mcp_config):
        """Test that agent can be initialized with tools."""
        skip_if_prerequisite_failed('tool_names')
            
        try:
            with ToolCollection.from_mcp(mcp_config, trust_remote_code=True) as tool_collection:
                agent = ToolCallingAgent(
                    tools=[*tool_collection.tools],
                    model=openai_model,
                    max_steps=5
                )
                
                assert agent is not None, "Agent initialization failed"
                assert len(agent.tools) > 0, f"Agent has no tools"
                assert agent.max_steps == 5, f"max_steps incorrect: {agent.max_steps}"
                
                pytest.agent_initialized = True
                
        except Exception as e:
            pytest.fail(f"Agent init error: {type(e).__name__}: {str(e)}")
    
    @pytest.mark.timeout(TIMEOUT)
    def test_resolve_react_library(self, openai_model, mcp_config):
        """Test resolving React library ID through agent."""
        skip_if_prerequisite_failed('agent_initialized')
            
        try:
            with ToolCollection.from_mcp(mcp_config, trust_remote_code=True) as tool_collection:
                agent = ToolCallingAgent(
                    tools=[*tool_collection.tools],
                    model=openai_model,
                    max_steps=3
                )
                
                result, elapsed = run_agent_with_timeout(
                    agent, "Use resolve-library-id to find the Context7 ID for 'react'"
                )
                
                assert_library_in_result(result, "react", ["facebook", "meta", "/react"])
                pytest.react_test_time = elapsed
                
        except Exception as e:
            pytest.fail(f"React resolution error: {type(e).__name__}: {str(e)}")
    
    @pytest.mark.timeout(TIMEOUT)
    def test_invalid_library_handling(self, openai_model, mcp_config):
        """Test agent behavior with non-existent library."""
        skip_if_prerequisite_failed('agent_initialized')
            
        try:
            with ToolCollection.from_mcp(mcp_config, trust_remote_code=True) as tool_collection:
                agent = ToolCallingAgent(
                    tools=[*tool_collection.tools],
                    model=openai_model,
                    max_steps=3
                )
                
                result = agent.run("Use resolve-library-id to find 'xyzabc123nonexistent'")
                
                assert result is not None, "Agent returned None"
                result_str = str(result).lower()
                assert any(term in result_str for term in 
                          ["no", "not found", "couldn't find", "no matches", "no results"]), \
                    f"Doesn't indicate not found: {result_str[:200]}..."
                    
        except Exception as e:
            pytest.fail(f"Invalid library error: {type(e).__name__}: {str(e)}")


@pytest.mark.timeout(TIMEOUT)
@pytest.mark.parametrize("library_name,expected_terms", [
    ("vue", ["vue", "/vuejs"]),
    ("numpy", ["numpy", "numerical"]),
    ("django", ["django", "python"])
])
def test_parametrized_library_resolution(openai_model, mcp_config, library_name, expected_terms):
    """Test resolving various libraries with expected terms in results."""
    skip_if_prerequisite_failed('agent_initialized')
        
    try:
        with ToolCollection.from_mcp(mcp_config, trust_remote_code=True) as tool_collection:
            agent = ToolCallingAgent(
                tools=[*tool_collection.tools],
                model=openai_model,
                max_steps=3
            )
            
            result = agent.run(f"Use resolve-library-id to find '{library_name}'")
            assert_library_in_result(result, library_name, expected_terms)
                
    except Exception as e:
        pytest.fail(f"{library_name} error: {type(e).__name__}: {str(e)}")


def pytest_sessionfinish(session, exitstatus):
    """Generate a test report after all tests complete."""
    print(generate_test_report())