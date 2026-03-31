# WK-Factory — Production Docker image
# Multi-stage build: frontend → backend+static
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --ignore-scripts
COPY frontend/ .
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app

# Install backend dependencies
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm ci --omit=dev --ignore-scripts

# Copy backend code
COPY backend/ ./backend/
COPY lib/ ./lib/

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Create data directory
RUN mkdir -p /data && chown -R node:node /data /app

USER node

ENV NODE_ENV=production
ENV PORT=9002
ENV WK_DB_DIR=/data

EXPOSE 9002

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:9002/api/health || exit 1

CMD ["node", "backend/server.js"]
