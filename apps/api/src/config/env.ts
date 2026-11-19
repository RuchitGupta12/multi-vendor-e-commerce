import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load local env first, then fall back to repo-root env files (e.g. Neon `neon deploy` writes `.env.local` at root)
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env.local"), override: false });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env"), override: false });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: false });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  REDIS_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  ELASTICSEARCH_NODE: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(["stripe", "razorpay"]).optional(),
  // Neon Object Storage (S3-compatible)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_ENDPOINT_URL_S3: z.string().optional(),
  AWS_REGION: z.string().optional(),
  STORAGE_BUCKET: z.string().default("assets"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
