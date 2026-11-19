import crypto from "crypto";
import { Role, VendorStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  hashPassword,
  hashToken,
  refreshExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from "../../lib/auth";
import { AppError } from "../../middleware/errorHandler";

export async function register(input: {
  email: string;
  password: string;
  name: string;
  role?: "CUSTOMER" | "VENDOR";
  storeName?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError(409, "EMAIL_IN_USE", "Email is already registered");

  const role = input.role ?? "CUSTOMER";
  if (role === "VENDOR" && !input.storeName) {
    throw new AppError(400, "VALIDATION_ERROR", "storeName is required for vendor registration");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: role as Role,
      vendorProfile:
        role === "VENDOR"
          ? {
              create: {
                storeName: input.storeName!,
                status: VendorStatus.PENDING,
              },
            }
          : undefined,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return issueTokens(user.id, user.role, user.email, user);
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

  const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt };
  return issueTokens(user.id, user.role, user.email, safeUser);
}

export async function refresh(input: { refreshToken: string }) {
  let payload: { sub: string; tokenId: string; type: string };
  try {
    payload = verifyRefreshToken(input.refreshToken);
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired refresh token");
  }
  if (payload.type !== "refresh") throw new AppError(401, "UNAUTHORIZED", "Invalid token type");

  const tokenHash = hashToken(input.refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: { id: payload.tokenId, userId: payload.sub, tokenHash, revokedAt: null },
    include: { user: true },
  });
  if (!stored || stored.expiresAt < new Date() || !stored.user.isActive) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired refresh token");
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  const user = stored.user;
  const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt };
  return issueTokens(user.id, user.role, user.email, safeUser);
}

export async function logout(input: { refreshToken: string }) {
  try {
    const payload = verifyRefreshToken(input.refreshToken);
    const tokenHash = hashToken(input.refreshToken);
    await prisma.refreshToken.updateMany({
      where: { id: payload.tokenId, userId: payload.sub, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // ignore invalid tokens on logout
  }
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      vendorProfile: { select: { id: true, storeName: true, status: true } },
    },
  });
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");
  return user;
}

async function issueTokens(userId: string, role: Role, email: string, user: unknown) {
  const tokenId = crypto.randomUUID();
  const accessToken = signAccessToken({ sub: userId, role, email });
  const refreshToken = signRefreshToken({ sub: userId, tokenId });
  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiryDate(),
    },
  });
  return { user, accessToken, refreshToken };
}
