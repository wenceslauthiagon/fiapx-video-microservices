FROM cgr.dev/chainguard/node:latest-dev

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

USER root

RUN chown -R 65532:65532 /app

USER 65532:65532

CMD ["npm", "start"]
