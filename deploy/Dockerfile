FROM node:22-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack pnpm install --frozen-lockfile

COPY . .
RUN corepack pnpm exec prisma generate \
    && NODE_OPTIONS=--max-old-space-size=768 corepack pnpm build \
    && chown -R node:node /app/.next

ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0"]
