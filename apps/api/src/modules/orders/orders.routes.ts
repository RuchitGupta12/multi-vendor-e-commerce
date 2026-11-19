import { Router } from "express";
import { z } from "zod";
import { Prisma, OrderStatus, PaymentProvider, PaymentStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { authenticate, requireRoles } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { computeDiscount } from "../coupons/coupons.routes";

export const ordersRouter = Router();

function money(n: number) { return Math.round(n * 100) / 100; }
function invoiceNumber() { return `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }

async function buildPreview(userId: string, couponCode?: string, shippingAddressId?: string) {
  const cart = await prisma.cart.findUnique({ where: { userId }, include: { items: { include: { product: { include: { vendor: true } } } } } });
  if (!cart || cart.items.length === 0) throw new AppError(400, "EMPTY_CART", "Cart is empty");

  const lines = cart.items.map((item) => {
    if (item.product.status !== "ACTIVE") throw new AppError(400, "PRODUCT_UNAVAILABLE", `${item.product.title} is not available`);
    if (item.quantity > item.product.stock) throw new AppError(400, "OUT_OF_STOCK", `Insufficient stock for ${item.product.title}`);
    const lineTotal = money(Number(item.product.price) * item.quantity);
    const rate = Number(item.product.vendor.commissionRate ?? 0.1);
    const commissionAmount = money(lineTotal * rate);
    const vendorAmount = money(lineTotal - commissionAmount);
    return {
      productId: item.productId,
      vendorId: item.product.vendorId,
      title: item.product.title,
      quantity: item.quantity,
      unitPrice: Number(item.product.price),
      lineTotal,
      commissionRate: rate,
      commissionAmount,
      vendorAmount,
      currency: item.product.currency,
    };
  });

  const subtotal = money(lines.reduce((s, l) => s + l.lineTotal, 0));
  let discount = 0;
  let coupon: any = null;
  if (couponCode) {
    coupon = await prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } });
    if (!coupon) throw new AppError(404, "INVALID_COUPON", "Coupon not found");
    discount = computeDiscount(subtotal, coupon);
  }
  const shippingFee = 0;
  const total = money(Math.max(0, subtotal - discount + shippingFee));
  const platformCommission = money(lines.reduce((s, l) => s + l.commissionAmount, 0));

  let shippingAddress = null;
  if (shippingAddressId) {
    shippingAddress = await prisma.address.findFirst({ where: { id: shippingAddressId, userId } });
    if (!shippingAddress) throw new AppError(404, "NOT_FOUND", "Shipping address not found");
  }

  return { items: lines, subtotal, discount, shippingFee, total, currency: "INR", coupon: coupon ? { id: coupon.id, code: coupon.code } : null, platformCommission, shippingAddress };
}

ordersRouter.post("/checkout/preview", authenticate, requireRoles("CUSTOMER", "VENDOR"), validateBody(z.object({ couponCode: z.string().optional(), shippingAddressId: z.string().uuid().optional() })), async (req, res, next) => {
  try {
    const preview = await buildPreview(req.user!.id, req.body.couponCode, req.body.shippingAddressId);
    res.json({ preview });
  } catch (e) { next(e); }
});

ordersRouter.post("/", authenticate, requireRoles("CUSTOMER", "VENDOR"), validateBody(z.object({ couponCode: z.string().optional(), shippingAddressId: z.string().uuid().optional(), notes: z.string().optional() })), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const preview = await buildPreview(userId, req.body.couponCode, req.body.shippingAddressId);

    const order = await prisma.$transaction(async (tx) => {
      // re-check stock inside tx
      for (const line of preview.items) {
        const p = await tx.product.findUnique({ where: { id: line.productId } });
        if (!p || p.status !== "ACTIVE" || p.stock < line.quantity) {
          throw new AppError(400, "OUT_OF_STOCK", `Insufficient stock for ${line.title}`);
        }
      }

      const created = await tx.order.create({
        data: {
          customerId: userId,
          shippingAddressId: preview.shippingAddress ? (preview.shippingAddress as any).id : null,
          couponId: preview.coupon?.id ?? null,
          status: OrderStatus.PLACED,
          subtotal: new Prisma.Decimal(preview.subtotal),
          discount: new Prisma.Decimal(preview.discount),
          shippingFee: new Prisma.Decimal(preview.shippingFee),
          total: new Prisma.Decimal(preview.total),
          currency: preview.currency,
          items: {
            create: preview.items.map((l) => ({
              productId: l.productId,
              vendorId: l.vendorId,
              quantity: l.quantity,
              unitPrice: new Prisma.Decimal(l.unitPrice),
              commissionRate: new Prisma.Decimal(l.commissionRate),
              commissionAmount: new Prisma.Decimal(l.commissionAmount),
              vendorAmount: new Prisma.Decimal(l.vendorAmount),
            })),
          },
        },
        include: { items: { include: { product: { select: { title: true } }, vendor: { select: { storeName: true } } } }, shippingAddress: true, coupon: true },
      });

      for (const line of preview.items) {
        await tx.product.update({ where: { id: line.productId }, data: { stock: { decrement: line.quantity } } });
      }
      if (preview.coupon) {
        await tx.coupon.update({ where: { id: preview.coupon.id }, data: { usedCount: { increment: 1 } } });
      }
      const cart = await tx.cart.findUnique({ where: { userId } });
      if (cart) await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    res.status(201).json({ order });
  } catch (e) { next(e); }
});

ordersRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const where = req.user!.role === "ADMIN" ? {} : { customerId: req.user!.id };
    const orders = await prisma.order.findMany({ where, include: { items: { include: { product: { select: { title: true, images: { take: 1 } } } } }, invoice: true, payments: true }, orderBy: { createdAt: "desc" } });
    res.json({ orders });
  } catch (e) { next(e); }
});

ordersRouter.get("/:id", authenticate, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: { include: { product: { select: { id: true, title: true, images: { take: 1 } } }, vendor: { select: { id: true, storeName: true } } } }, payments: true, invoice: true, shippingAddress: true, coupon: true, customer: { select: { id: true, name: true, email: true } } } });
    if (!order) throw new AppError(404, "NOT_FOUND", "Order not found");
    const isOwner = order.customerId === req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";
    let isVendor = false;
    if (req.user!.role === "VENDOR") {
      const vp = await prisma.vendorProfile.findUnique({ where: { userId: req.user!.id } });
      isVendor = !!vp && order.items.some((i) => i.vendorId === vp.id);
    }
    if (!isOwner && !isAdmin && !isVendor) throw new AppError(403, "FORBIDDEN", "Not allowed");
    res.json({ order });
  } catch (e) { next(e); }
});

ordersRouter.post("/:id/cancel", authenticate, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true, payments: true } });
    if (!order) throw new AppError(404, "NOT_FOUND", "Order not found");
    if (order.customerId !== req.user!.id && req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN", "Not allowed");
    if (["SHIPPED", "DELIVERED", "CANCELLED"].includes(order.status)) throw new AppError(400, "INVALID_STATE", "Order cannot be cancelled");
    const captured = order.payments.some((p) => p.status === "CAPTURED");
    if (captured && req.user!.role !== "ADMIN") throw new AppError(400, "INVALID_STATE", "Paid order requires admin/refund flow");

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
      return tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } });
    });
    res.json({ order: updated });
  } catch (e) { next(e); }
});

async function ensureInvoice(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found");
  const existing = await prisma.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;
  return prisma.invoice.create({ data: { orderId, number: invoiceNumber(), amount: order.total, currency: order.currency, url: null } });
}

ordersRouter.get("/:id/invoice", authenticate, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { invoice: true, items: { include: { product: { select: { title: true } }, vendor: { select: { storeName: true } } } }, customer: { select: { name: true, email: true } }, shippingAddress: true } });
    if (!order) throw new AppError(404, "NOT_FOUND", "Order not found");
    if (order.customerId !== req.user!.id && req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN", "Not allowed");
    let invoice = order.invoice;
    if (!invoice) invoice = await ensureInvoice(order.id);
    // simple HTML invoice (printable/PDF via browser)
    const rows = order.items.map(i => `<tr><td>${i.product.title}</td><td>${i.vendor.storeName}</td><td>${i.quantity}</td><td>${i.unitPrice}</td><td>${Number(i.unitPrice) * i.quantity}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset='utf-8'><title>Invoice ${invoice.number}</title>
      <style>body{font-family:system-ui,sans-serif;margin:40px;color:#1c1917}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #e7e1d8;padding:8px;text-align:left}th{background:#f3efe8}.totals{margin-top:16px;max-width:320px;margin-left:auto}</style></head>
      <body><h1>Invoice ${invoice.number}</h1><p><strong>Order:</strong> ${order.id}<br><strong>Date:</strong> ${order.placedAt.toISOString()}<br><strong>Customer:</strong> ${order.customer.name} (${order.customer.email})</p>
      <table><thead><tr><th>Product</th><th>Vendor</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      <div class='totals'><p>Subtotal: ${order.subtotal}</p><p>Discount: ${order.discount}</p><p>Shipping: ${order.shippingFee}</p><p><strong>Total: ${order.total} ${order.currency}</strong></p></div></body></html>`;
    if (req.query.format === "json") return res.json({ invoice, orderId: order.id });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (e) { next(e); }
});

ordersRouter.post("/:id/pay", authenticate, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new AppError(404, "NOT_FOUND", "Order not found");
    if (order.customerId !== req.user!.id) throw new AppError(403, "FORBIDDEN", "Not allowed");
    if (order.status === "CANCELLED") throw new AppError(400, "INVALID_STATE", "Order is cancelled");

    const existingCaptured = await prisma.payment.findFirst({ where: { orderId: order.id, status: PaymentStatus.CAPTURED } });
    if (existingCaptured) return res.json({ ok: true, payment: existingCaptured, message: "Order already paid" });

    const providerEnv = (process.env.PAYMENT_PROVIDER || "stripe").toLowerCase();
    const provider = providerEnv === "razorpay" ? PaymentProvider.RAZORPAY : PaymentProvider.STRIPE;

    if (providerEnv === "stripe" && process.env.STRIPE_SECRET_KEY) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Stripe = require("stripe");
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const intent = await stripe.paymentIntents.create({
          amount: Math.round(Number(order.total) * 100),
          currency: (order.currency || "inr").toLowerCase(),
          metadata: { orderId: order.id },
          automatic_payment_methods: { enabled: true },
          description: `Marketplace order ${order.id}`,
        });
        const payment = await prisma.payment.create({
          data: { orderId: order.id, provider, providerPaymentId: intent.id, status: PaymentStatus.PENDING, amount: order.total, currency: order.currency, rawPayload: { id: intent.id, status: intent.status } },
        });
        return res.json({ mode: "stripe", clientSecret: intent.client_secret, payment });
      } catch (err) {
        console.warn("Stripe init failed, falling back to test mode:", (err as Error).message);
      }
    }

    const payment = await prisma.payment.create({
      data: { orderId: order.id, provider, status: PaymentStatus.PENDING, amount: order.total, currency: order.currency, providerOrderId: `test_order_${order.id}`, rawPayload: { mode: "test" } },
    });
    res.json({ mode: "test", message: "No payment provider configured. Use confirm-test to simulate capture.", payment, confirmEndpoint: `/api/v1/orders/${order.id}/pay/confirm-test` });
  } catch (e) { next(e); }
});

ordersRouter.post("/:id/pay/confirm-test", authenticate, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new AppError(404, "NOT_FOUND", "Order not found");
    if (order.customerId !== req.user!.id && req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN", "Not allowed");
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: (process.env.PAYMENT_PROVIDER?.toUpperCase() === "RAZORPAY" ? PaymentProvider.RAZORPAY : PaymentProvider.STRIPE),
        status: PaymentStatus.CAPTURED,
        amount: order.total,
        currency: order.currency,
        providerPaymentId: `test_${Date.now()}`,
        rawPayload: { mode: "test-confirm" },
      },
    });
    await ensureInvoice(order.id);
    res.json({ ok: true, payment, message: "Test payment captured (no real provider configured)" });
  } catch (e) { next(e); }
});

export { ensureInvoice, buildPreview };
