
FROM node:20-bookworm-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

COPY prisma ./prisma

RUN npx prisma generate

COPY src ./src

EXPOSE 4000

CMD ["node", "src/index.js"]