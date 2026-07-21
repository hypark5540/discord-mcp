ARG NODE_IMAGE=node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd

FROM ${NODE_IMAGE} AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm run deps:locked
COPY licenses ./licenses
COPY scripts ./scripts
COPY src ./src
RUN npm run build:bundle
RUN test -s bundle/sbom.cdx.json

FROM ${NODE_IMAGE} AS runtime

ARG VERSION=0.1.0
ARG REVISION=unknown

LABEL org.opencontainers.image.title="Discord MCP" \
      org.opencontainers.image.description="Safe, configurable MCP server for Discord" \
      org.opencontainers.image.source="https://github.com/hypark5540/discord-mcp" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.licenses="MIT" \
      io.modelcontextprotocol.server.name="io.github.hypark5540/discord-mcp"

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app/bundle ./bundle
COPY --chown=node:node LICENSE ./LICENSE

USER node
ENTRYPOINT ["node", "bundle/discord-mcp.cjs"]
