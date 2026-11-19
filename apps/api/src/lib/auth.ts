import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../config/env";

export type AccessPayload = { sub: string; role: Role; email: string; type: "access" };
export type RefreshPayload = { sub: string; tokenId: string; type: "refresh" };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: { sub: string; role: Role; email: string }) {
  const options: SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any };
  return jwt.sign({ ...payload, type: "access" }, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(payload: { sub: string; tokenId: string }) {
  const options: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any };
  return jwt.sign({ ...payload, type: "refresh" }, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshExpiryDate() {
  const daysMatch = /^(\d+)d$/.exec(env.JWT_REFRESH_EXPIRES_IN);
  const days = daysMatch ? parseInt(daysMatch[1], 10) : 7;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
