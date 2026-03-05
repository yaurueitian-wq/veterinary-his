FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# CMD 由 docker-compose.yml 的 command 覆蓋（開發：npm run dev --host 0.0.0.0）
