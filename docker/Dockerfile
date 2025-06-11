FROM node:18-alpine

# Install Python and pip for MCP server testing
RUN apk add --no-cache python3 py3-pip

# Install process manager for running multiple processes, PM2, and yamcp
RUN npm install -g concurrently pm2 yamcp

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy all source files
COPY . .

# Create yamcp data directory and copy seed files
RUN mkdir -p /root/.local/share/yamcp-nodejs
COPY seed-data/providers.json /root/.local/share/yamcp-nodejs/providers.json
COPY seed-data/workspaces.json /root/.local/share/yamcp-nodejs/workspaces.json

# Expose both ports
EXPOSE 5173 8765

# Run both frontend and backend-hub concurrently
CMD ["concurrently", "-n", "frontend,backend-hub", "-c", "cyan,green", \
     "npm run dev -- --host 0.0.0.0", \
     "pm2-runtime start /app/ecosystem.config.cjs"]
