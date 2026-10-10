# Build context is the repository root. Pin an approved digest before deployment.
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE}
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --omit=dev --workspace=@aquashield/api --include-workspace-root=false --no-audit --no-fund \
    && npm cache clean --force
COPY apps/api/src ./apps/api/src
COPY packages/shared ./packages/shared
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=4s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health/ready',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENV PORT=5000
CMD ["node", "apps/api/src/server.js"]
