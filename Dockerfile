FROM node:18-alpine

# Install process manager for running multiple processes
RUN npm install -g concurrently

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy all source files
COPY . .

# Expose both ports
EXPOSE 5173 8765

# Run both frontend and backend concurrently
CMD ["concurrently", "-n", "frontend,backend", "-c", "cyan,green", \
     "npm run dev -- --host 0.0.0.0", \
     "npm start"]
