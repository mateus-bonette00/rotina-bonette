FROM node:22-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY . .
RUN npx prisma generate --schema apps/api/prisma/schema.prisma && npm run build

FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production API_HOST=0.0.0.0 ALLOW_PUBLIC_BIND=true TRUST_PROXY=1 API_PORT=8080 WEB_DIST=/app/apps/web/dist
EXPOSE 8080
# migrações aplicadas no boot; falha aborta o deploy
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/server.js"]
