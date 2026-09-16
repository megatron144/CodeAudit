FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache docker-cli git

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5001

CMD ["node", "server.js"]
