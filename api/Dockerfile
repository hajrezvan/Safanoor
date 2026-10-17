FROM node:24-alpine AS build
WORKDIR /app
COPY packages/shared/package*.json packages/shared/
RUN npm ci --prefix packages/shared
COPY api/package*.json api/
RUN npm ci --prefix api
COPY packages/shared packages/shared
RUN api/node_modules/.bin/tsc -p packages/shared/tsconfig.json
COPY api api
RUN npm --prefix api run build && npm prune --omit=dev --prefix api
FROM node:24-alpine AS runtime
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/api/.storage && chown node:node /app/api/.storage
USER node
WORKDIR /app/api
ENV NODE_ENV=production PORT=3001
EXPOSE 3001
CMD ["node","dist/main.js"]
