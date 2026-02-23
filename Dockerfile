FROM node:20-alpine

# Run as non-root — reduces blast radius if the process is compromised
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY api/package*.json ./api/
RUN cd api && npm ci --omit=dev
COPY api/ ./api/
COPY src/ ./src/
COPY templates/ ./templates/
RUN chown -R appuser:appgroup /app
USER appuser

# Injected by the CI workflow at build time (git commit SHA short form).
# Falls back to 'dev' for local builds.
ARG BUILD_SHA=dev
ENV BUILD_SHA=${BUILD_SHA}

EXPOSE 8080
ENV PORT=8080
CMD ["node", "api/server.js"]
