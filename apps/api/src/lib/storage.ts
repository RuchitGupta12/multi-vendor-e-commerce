import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { env } from "../config/env";

const bucket = process.env.STORAGE_BUCKET || env.STORAGE_BUCKET || "assets";

export function isStorageConfigured() {
  return Boolean(
    (process.env.AWS_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID) &&
    (process.env.AWS_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY) &&
    (process.env.AWS_ENDPOINT_URL_S3 || env.AWS_ENDPOINT_URL_S3)
  );
}

function getClient() {
  if (!isStorageConfigured()) return null;
  return new S3Client({
    region: process.env.AWS_REGION || env.AWS_REGION || "us-east-1",
    endpoint: process.env.AWS_ENDPOINT_URL_S3 || env.AWS_ENDPOINT_URL_S3,
    forcePathStyle: true,
    credentials: {
      accessKeyId: (process.env.AWS_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID)!,
      secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY)!,
    },
  });
}

export function getBucket() {
  return bucket;
}

export async function presignUpload(params: { key: string; contentType?: string; expiresIn?: number }) {
  const client = getClient();
  if (!client) throw new Error("Object storage is not configured");
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ContentType: params.contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: params.expiresIn ?? 900 });
  const endpoint = (process.env.AWS_ENDPOINT_URL_S3 || env.AWS_ENDPOINT_URL_S3 || "").replace(/\/$/, "");
  // Path-style object URL (for private buckets, use presigned GET for access)
  const objectUrl = `${endpoint}/${bucket}/${params.key}`;
  return { uploadUrl, objectUrl, key: params.key, bucket };
}

export async function presignDownload(key: string, expiresIn = 3600) {
  const client = getClient();
  if (!client) throw new Error("Object storage is not configured");
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}

export async function checkStorage() {
  const client = getClient();
  if (!client) return { configured: false };
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return { configured: true, bucket, endpoint: process.env.AWS_ENDPOINT_URL_S3 || env.AWS_ENDPOINT_URL_S3 };
  } catch (e) {
    return { configured: true, bucket, endpoint: process.env.AWS_ENDPOINT_URL_S3 || env.AWS_ENDPOINT_URL_S3, error: (e as Error).message };
  }
}

export function makeImageKey(productId: string, filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "image";
  const rand = crypto.randomBytes(4).toString("hex");
  return `products/${productId}/${Date.now()}-${rand}-${safe}`;
}

export async function resolveImageUrl(image: { key?: string | null; url?: string | null }) {
  // If storage configured and we have a key that looks like our stored object key, return presigned GET URL
  if (image.key && isStorageConfigured() && image.key.startsWith("products/")) {
    try {
      return await presignDownload(image.key, 3600);
    } catch {
      return image.url || null;
    }
  }
  return image.url || null;
}
