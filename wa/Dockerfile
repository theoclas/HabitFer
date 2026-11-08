FROM node:22-alpine AS deps
# libsignal (dependencia de Baileys) se instala desde GitHub: hace falta git, y por HTTPS (no hay llaves SSH aquí).
RUN apk add --no-cache git && git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# La sesión del celular vinculado vive en /data (volumen): sobrevive a los reinicios y a las imágenes nuevas.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 4010
CMD ["node", "src/server.mjs"]
