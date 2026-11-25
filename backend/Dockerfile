FROM node:20-slim AS runner

WORKDIR /app

# Ensure curl is installed for container health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Install production dependencies first (utilizes Docker layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY knexfile.js ./
COPY src/ ./src/
COPY docker-entrypoint.sh ./

# Fix any Windows CRLF endings and ensure executable permissions
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
