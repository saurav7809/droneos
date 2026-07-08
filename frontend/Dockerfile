# ─── Stage 1: Node build ──────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Cache deps separately
COPY package*.json ./
RUN npm ci --prefer-offline

# Build with production env
COPY . .
ARG VITE_API_URL=/api
ARG VITE_WS_URL=/ws
ARG VITE_API_BASE_URL=""
ARG VITE_AI_BASE_URL=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AI_BASE_URL=$VITE_AI_BASE_URL
RUN npm run build

# ─── Stage 2: Production Nginx ────────────────────────────────
FROM nginx:1.25-alpine

# Security hardening
RUN apk add --no-cache tzdata curl && \
    rm -f /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security.conf /etc/nginx/snippets/security.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD curl -sf http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
