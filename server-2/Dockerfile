# Production Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 5000

# Start server
CMD ["npm", "start"]
