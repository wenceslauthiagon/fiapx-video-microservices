FROM cgr.dev/chainguard/node:latest-dev AS build

USER root

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY dd-trace-init.js ./
COPY start-with-db.js ./
COPY prisma ./prisma
COPY src ./src

RUN npm install && \
	npx prisma generate && \
	npm run build && \
	npm prune --omit=dev && \
	mkdir -p uploads outputs temp

FROM build

WORKDIR /app

ENV NODE_ENV=production

USER nonroot

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/uploads ./uploads
COPY --from=build /app/outputs ./outputs
COPY --from=build /app/temp ./temp

EXPOSE 3001

CMD ["start-with-db.js"]