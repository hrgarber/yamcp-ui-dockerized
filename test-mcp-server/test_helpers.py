"""Helper functions and utilities for Context7 MCP tests."""
import pytest
import time


def check_critical_setup(condition, error_message):
    """Check critical setup conditions and fail fast if not met."""
    if not condition:
        pytest.fail(error_message)


def skip_if_prerequisite_failed(prerequisite_attr):
    """Skip test if a prerequisite test has failed."""
    if not hasattr(pytest, prerequisite_attr):
        pytest.skip(f"Skipping - prerequisite '{prerequisite_attr}' test failed")


def run_agent_with_timeout(agent, prompt, timeout_start=None):
    """Run agent and track execution time."""
    start = timeout_start or time.time()
    result = agent.run(prompt)
    elapsed = time.time() - start
    return result, elapsed


def assert_library_in_result(result, library_name, expected_terms=None):
    """Assert that library resolution result contains expected content."""
    assert result is not None, f"Agent returned None for {library_name}"
    
    result_str = str(result).lower()
    assert library_name.lower() in result_str, \
        f"Result doesn't mention {library_name}: {result_str[:200]}..."
    
    if expected_terms:
        found_terms = [term for term in expected_terms if term in result_str]
        assert found_terms, \
            f"Result for {library_name} doesn't contain any expected terms: {expected_terms}. Got: {result_str[:200]}..."


def generate_test_report():
    """Generate a summary report after test completion."""
    report_lines = [
        "\n" + "="*70,
        "TEST REPORT - Context7 MCP Integration",
        "="*70
    ]
    
    if hasattr(pytest, 'tool_names'):
        report_lines.extend([
            f"\n✓ MCP Tools Discovered: {len(pytest.tool_names)}",
        ])
        for tool in pytest.tool_names[:5]:
            report_lines.append(f"  - {tool}")
        if len(pytest.tool_names) > 5:
            report_lines.append(f"  ... and {len(pytest.tool_names) - 5} more")
    else:
        report_lines.append("\n✗ MCP Connection Failed - No tools discovered")
    
    if hasattr(pytest, 'agent_initialized'):
        report_lines.append("\n✓ Agent Initialization: Success")
    else:
        report_lines.append("\n✗ Agent Initialization: Failed")
    
    if hasattr(pytest, 'react_test_time'):
        report_lines.append(f"\n✓ React Library Resolution: {pytest.react_test_time:.2f}s")
    
    report_lines.append("\n" + "="*70)
    
    return "\n".join(report_lines)