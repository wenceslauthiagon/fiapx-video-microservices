FROM cgr.dev/chainguard/node:latest-dev

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

USER root

RUN mkdir -p /data/uploads /data/outputs && chown -R 65532:65532 /app /data

USER 65532:65532

EXPOSE 3001

CMD ["npm", "start"]
