FROM node:18-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package.json tsconfig.json jest.config.js .eslintrc.js .prettierrc ./
COPY prisma ./prisma
COPY src ./src

RUN npm install && \
	npx prisma generate && \
	npm run build && \
	mkdir -p uploads outputs temp

EXPOSE 3001

CMD ["npm", "run", "start"]