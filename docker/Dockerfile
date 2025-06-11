FROM node:18-alpine

# Install process manager for running multiple processes, PM2, and yamcp
RUN npm install -g concurrently pm2 yamcp

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy all source files
COPY . .

# Expose both ports
EXPOSE 5173 8765

# Run both frontend and backend-hub concurrently
CMD ["concurrently", "-n", "frontend,backend-hub", "-c", "cyan,green", \
     "npm run dev -- --host 0.0.0.0", \
     "pm2-runtime start /app/ecosystem.config.js"]
