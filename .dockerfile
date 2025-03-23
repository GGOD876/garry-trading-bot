# Use official Bun base image
FROM oven/bun:latest

WORKDIR /app

COPY . .

RUN bun install

CMD ["bun", "index.ts"]
