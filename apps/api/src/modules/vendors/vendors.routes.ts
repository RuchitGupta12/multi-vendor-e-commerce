import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requireRoles } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { FulfillmentStatus, Role, VendorStatus } from "@prisma/client";

export const vendorsRouter = Router();

const applySchema = z.object({
  storeName: z.string().min(1),
  description: z.string().optional(),
  payoutProvider: z.enum(["STRIPE", "RAZORPAY"]).optional(),
  payoutAccountId: z.string().optional(),
});

vendorsRouter.post("/apply", authenticate, validateBody(applySchema), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const existing = await prisma.vendorProfile.findUnique({ where: { userId } });
    if (existing) return res.json({ vendor: existing, message: "Vendor profile already exists" });

    const vendor = await prisma.vendorProfile.create({
      data: {
        userId,
        storeName: req.body.storeName,
        description: req.body.description,
        payoutProvider: req.body.payoutProvider,
        payoutAccountId: req.body.payoutAccountId,
        status: VendorStatus.PENDING,
      },
    });
    // promote role to VENDOR if currently customer
    if (req.user!.role === "CUSTOMER") {
      await prisma.user.update({ where: { id: userId }, data: { role: Role.VENDOR } });
    }
    res.status(201).json({ vendor });
  } catch (e) { next(e); }
});

vendorsRouter.get("/me", authenticate, requireRoles("VENDOR", "ADMIN"), async (req, res, next) => {
  try {
    const vendor = await prisma.vendorProfile.findUnique({ where: { userId: req.user!.id }, include: { _count: { select: { products: true, orderItems: true } } } });
    if (!vendor) throw new AppError(404, "NOT_FOUND", "Vendor profile not found");
    res.json({ vendor });
  } catch (e) { next(e); }
});

vendorsRouter.patch("/me", authenticate, requireRoles("VENDOR"), validateBody(applySchema.partial()), async (req, res, next) => {
  try {
    const vendor = await prisma.vendorProfile.update({ where: { userId: req.user!.id }, data: req.body });
    res.json({ vendor });
  } catch (e) { next(e); }
});

vendorsRouter.get("/:id", async (req, res, next) => {
  try {
    const vendor = await prisma.vendorProfile.findUnique({
      where: { id: req.params.id },
      select: { id: true, storeName: true, description: true, status: true, createdAt: true, products: { where: { status: "ACTIVE" }, take: 12, include: { images: { take: 1 } } } },
    });
    if (!vendor || vendor.status !== "APPROVED") throw new AppError(404, "NOT_FOUND", "Vendor not found");
    res.json({ vendor });
  } catch (e) { next(e); }
});

vendorsRouter.get("/me/orders/items", authenticate, requireRoles("VENDOR"), async (req, res, next) => {
  try {
    const vendor = await prisma.vendorProfile.findUnique({ where: { userId: req.user!.id } });
    if (!vendor) throw new AppError(404, "NOT_FOUND", "Vendor profile not found");
    const items = await prisma.orderItem.findMany({
      where: { vendorId: vendor.id },
      include: { order: { select: { id: true, status: true, placedAt: true, customer: { select: { name: true, email: true } }, shippingAddress: true } }, product: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ items });
  } catch (e) { next(e); }
});

const fulfillmentSchema = z.object({ status: z.enum(["PENDING", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"]) });

vendorsRouter.patch("/me/orders/:orderItemId/status", authenticate, requireRoles("VENDOR"), validateBody(fulfillmentSchema), async (req, res, next) => {
  try {
    const vendor = await prisma.vendorProfile.findUnique({ where: { userId: req.user!.id } });
    if (!vendor) throw new AppError(404, "NOT_FOUND", "Vendor profile not found");
    const item = await prisma.orderItem.findFirst({ where: { id: req.params.orderItemId, vendorId: vendor.id } });
    if (!item) throw new AppError(404, "NOT_FOUND", "Order item not found");
    const updated = await prisma.orderItem.update({ where: { id: item.id }, data: { fulfillmentStatus: req.body.status as FulfillmentStatus } });

    // naive aggregate: if all items delivered -> order delivered, if all shipped/packed/delivered update accordingly
    const siblings = await prisma.orderItem.findMany({ where: { orderId: item.orderId } });
    const statuses = siblings.map((s) => (s.id === updated.id ? updated.fulfillmentStatus : s.fulfillmentStatus));
    let orderStatus: any = undefined;
    if (statuses.every((s) => s === "DELIVERED")) orderStatus = "DELIVERED";
    else if (statuses.every((s) => s === "SHIPPED" || s === "DELIVERED")) orderStatus = "SHIPPED";
    else if (statuses.every((s) => s === "PACKED" || s === "SHIPPED" || s === "DELIVERED")) orderStatus = "PACKED";
    if (orderStatus) await prisma.order.update({ where: { id: item.orderId }, data: { status: orderStatus } });

    res.json({ item: updated, orderStatus });
  } catch (e) { next(e); }
});
