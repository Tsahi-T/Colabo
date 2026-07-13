# Build frontend
FROM node:22-alpine AS build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

# Runtime
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/ ./server/
COPY --from=build /app/client/dist ./client/dist
EXPOSE 3001
USER node
CMD ["node", "server/index.js"]
