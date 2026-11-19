import Redis from "ioredis";
import { env } from "../config/env";

export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      enableOfflineQueue: false,
    })
  : null;

redis?.on("error", (err) => {
  console.error("Redis error:", err.message);
});
