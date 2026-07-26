FROM cgr.dev/chainguard/node:latest-dev

WORKDIR /app

USER root

RUN apk add --no-cache ffmpeg

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

RUN chown -R 65532:65532 /app

USER 65532:65532

CMD ["npm", "start"]
