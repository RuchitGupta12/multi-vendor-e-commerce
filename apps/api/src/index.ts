import "dotenv/config";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";

async function main() {
  const app = createApp();

  try {
    await prisma.$connect();
    console.log("Connected to PostgreSQL");
  } catch (err) {
    console.error("Failed to connect to PostgreSQL:", err);
  }

  if (redis) {
    try {
      await redis.connect();
      console.log("Connected to Redis");
    } catch (err) {
      console.warn("Redis not connected (continuing without it):", (err as Error).message);
    }
  }

  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await prisma.$disconnect().catch(() => {});
    redis?.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
