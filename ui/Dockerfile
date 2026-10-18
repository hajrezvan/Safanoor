FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS build
WORKDIR /app
RUN corepack enable
COPY package*.json ./
RUN npm ci
COPY packages/shared/package*.json packages/shared/
RUN npm ci --prefix packages/shared
COPY packages/shared packages/shared
RUN npm run build:shared
COPY ui/package.json ui/yarn.lock ui/
RUN --mount=type=cache,id=safanoor-yarn,sharing=locked,target=/usr/local/share/.cache/yarn cd ui && YARN_CACHE_FOLDER=/usr/local/share/.cache/yarn yarn install --frozen-lockfile --non-interactive
COPY ui ui
RUN cd ui && yarn build
FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3033 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/ui/.next/standalone ./
COPY --from=build --chown=node:node /app/ui/.next/static ./ui/.next/static
COPY --from=build --chown=node:node /app/ui/public ./ui/public
USER node
EXPOSE 3033
CMD ["node","ui/server.js"]
