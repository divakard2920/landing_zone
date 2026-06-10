# Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Production image
FROM node:22-alpine
WORKDIR /app

# Copy backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

# Create uploads directory
RUN mkdir -p uploads

# Copy built frontend to backend/public
COPY --from=frontend-build /app/frontend/dist ./public

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
