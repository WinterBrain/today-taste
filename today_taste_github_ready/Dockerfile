FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p /app/data
ENV NODE_ENV=production PORT=3000 DB_PATH=/app/data/today_taste.sqlite
EXPOSE 3000
CMD ["npm","start"]
