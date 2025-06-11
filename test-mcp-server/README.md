# Context7 MCP Test

## Install
```bash
pip install -r requirements.txt
```

## Run
```bash
# Run all tests
pytest test_smolagent_openai_context7.py

# Run specific test
pytest test_smolagent_openai_context7.py::test_smoke_openai_api_key

# Run with verbose output
pytest -v test_smolagent_openai_context7.py
```

## Prerequisites
- MCP hub running at `http://localhost:8765/mcp/test0`
- Valid OpenAI API key (set as env var or in script)