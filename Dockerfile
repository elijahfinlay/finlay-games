FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy package.json files for all packages
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @finlay-games/server --filter @finlay-games/shared

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/

# Build shared first, then server
RUN pnpm --filter @finlay-games/shared build
RUN pnpm --filter @finlay-games/server build

EXPOSE 3001
ENV PORT=3001
CMD ["node", "packages/server/dist/index.js"]
