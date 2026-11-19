import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requireRoles } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";

export const adminRouter = Router();
adminRouter.use(authenticate, requireRoles("ADMIN"));

adminRouter.get("/vendors", async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const vendors = await prisma.vendorProfile.findMany({
      where: status ? { status: status as any } : undefined,
      include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { products: true, orderItems: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ vendors });
  } catch (e) { next(e); }
});

adminRouter.patch("/vendors/:id/status", validateBody(z.object({ status: z.enum(["PENDING", "APPROVED", "SUSPENDED"]) })), async (req, res, next) => {
  try {
    const vendor = await prisma.vendorProfile.update({ where: { id: req.params.id }, data: { status: req.body.status } });
    res.json({ vendor });
  } catch (e) { next(e); }
});

adminRouter.get("/orders", async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({ include: { customer: { select: { id: true, name: true, email: true } }, items: true, payments: true }, orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ orders });
  } catch (e) { next(e); }
});

adminRouter.get("/analytics", async (_req, res, next) => {
  try {
    const [ordersAgg, commissionAgg, orderCount, vendorCount, productCount, customerCount, recentOrders, topProducts] = await Promise.all([
      prisma.order.aggregate({ _sum: { total: true, discount: true, subtotal: true }, where: { status: { not: "CANCELLED" } } }),
      prisma.orderItem.aggregate({ _sum: { commissionAmount: true, vendorAmount: true }, where: { order: { status: { not: "CANCELLED" } } } }),
      prisma.order.count(),
      prisma.vendorProfile.count(),
      prisma.product.count(),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, total: true, status: true, createdAt: true, customer: { select: { name: true } } } }),
      prisma.orderItem.groupBy({ by: ["productId"], _sum: { quantity: true, vendorAmount: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }),
    ]);

    const productIds = topProducts.map((p) => p.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true } });
    const titleMap = new Map(products.map((p) => [p.id, p.title]));

    res.json({
      kpis: {
        gmv: ordersAgg._sum.total ?? 0,
        subtotal: ordersAgg._sum.subtotal ?? 0,
        discounts: ordersAgg._sum.discount ?? 0,
        platformCommission: commissionAgg._sum.commissionAmount ?? 0,
        vendorEarnings: commissionAgg._sum.vendorAmount ?? 0,
        orders: orderCount,
        vendors: vendorCount,
        products: productCount,
        customers: customerCount,
      },
      recentOrders,
      topProducts: topProducts.map((p) => ({ productId: p.productId, title: titleMap.get(p.productId) ?? p.productId, quantitySold: p._sum.quantity ?? 0, revenue: p._sum.vendorAmount ?? 0 })),
    });
  } catch (e) { next(e); }
});

adminRouter.patch("/products/:id/moderate", validateBody(z.object({ status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]) })), async (req, res, next) => {
  try {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: { status: req.body.status } });
    res.json({ product });
  } catch (e) { next(e); }
});
