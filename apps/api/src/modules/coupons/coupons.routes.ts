import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requireRoles } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { Prisma } from "@prisma/client";

export const couponsRouter = Router();

const couponSchema = z.object({
  code: z.string().min(1),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().positive(),
  minOrderAmount: z.coerce.number().nonnegative().optional(),
  maxDiscount: z.coerce.number().nonnegative().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  usageLimit: z.coerce.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

export function computeDiscount(subtotal: number, coupon: { type: string; value: any; minOrderAmount?: any; maxDiscount?: any; expiresAt?: Date | null; usageLimit?: number | null; usedCount: number; isActive: boolean }) {
  if (!coupon.isActive) throw new AppError(400, "INVALID_COUPON", "Coupon is inactive");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new AppError(400, "INVALID_COUPON", "Coupon expired");
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) throw new AppError(400, "INVALID_COUPON", "Coupon usage limit reached");
  const min = coupon.minOrderAmount ? Number(coupon.minOrderAmount) : 0;
  if (subtotal < min) throw new AppError(400, "INVALID_COUPON", `Minimum order amount is ${min}`);
  let discount = coupon.type === "PERCENT" ? (subtotal * Number(coupon.value)) / 100 : Number(coupon.value);
  if (coupon.maxDiscount != null) discount = Math.min(discount, Number(coupon.maxDiscount));
  discount = Math.min(discount, subtotal);
  return Math.round(discount * 100) / 100;
}

couponsRouter.post("/validate", validateBody(z.object({ code: z.string().min(1), subtotal: z.coerce.number().nonnegative() })), async (req, res, next) => {
  try {
    const coupon = await prisma.coupon.findUnique({ where: { code: req.body.code.trim().toUpperCase() } });
    if (!coupon) throw new AppError(404, "INVALID_COUPON", "Coupon not found");
    const discount = computeDiscount(req.body.subtotal, coupon);
    res.json({ valid: true, coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value }, discount, total: Math.max(0, req.body.subtotal - discount) });
  } catch (e) { next(e); }
});

couponsRouter.get("/", authenticate, requireRoles("ADMIN"), async (_req, res, next) => {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ coupons });
  } catch (e) { next(e); }
});

couponsRouter.post("/", authenticate, requireRoles("ADMIN"), validateBody(couponSchema), async (req, res, next) => {
  try {
    const data: any = {
      ...req.body,
      code: req.body.code.trim().toUpperCase(),
      value: new Prisma.Decimal(req.body.value),
    };
    if (req.body.minOrderAmount != null) data.minOrderAmount = new Prisma.Decimal(req.body.minOrderAmount);
    if (req.body.maxDiscount != null) data.maxDiscount = new Prisma.Decimal(req.body.maxDiscount);
    if (req.body.expiresAt) data.expiresAt = new Date(req.body.expiresAt);
    const coupon = await prisma.coupon.create({ data });
    res.status(201).json({ coupon });
  } catch (e) { next(e); }
});

couponsRouter.patch("/:id", authenticate, requireRoles("ADMIN"), validateBody(couponSchema.partial()), async (req, res, next) => {
  try {
    const data: any = { ...req.body };
    if (data.code) data.code = data.code.trim().toUpperCase();
    if (data.value != null) data.value = new Prisma.Decimal(data.value);
    if (data.minOrderAmount != null) data.minOrderAmount = new Prisma.Decimal(data.minOrderAmount);
    if (data.maxDiscount != null) data.maxDiscount = new Prisma.Decimal(data.maxDiscount);
    if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);
    const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data });
    res.json({ coupon });
  } catch (e) { next(e); }
});

couponsRouter.delete("/:id", authenticate, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    await prisma.coupon.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) { next(e); }
});
