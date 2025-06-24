# Workspace Runtime Container - Python/FastMCP
# This container runs FastMCP to aggregate multiple MCP servers into a single endpoint

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies if needed for MCP servers
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY aggregator.py .
COPY health_server.py .

# Expose port for SSE endpoint
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the aggregator
CMD ["python", "aggregator.py"]