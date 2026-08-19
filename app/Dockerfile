FROM node:22.19.0-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
COPY package.json ./
RUN pnpm install --frozen-lockfile=false

FROM base AS development
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM base AS build
COPY . .
RUN pnpm build

FROM node:22.19.0-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
