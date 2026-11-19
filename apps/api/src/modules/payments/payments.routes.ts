import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { AppError } from "../../middleware/errorHandler";
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { ensureInvoice } from "../orders/orders.routes";
import { env } from "../../config/env";

export const paymentsRouter = Router();

// Payment initiation is handled at POST /api/v1/orders/:id/pay (see orders module) to match API spec. This module handles provider webhooks.

// Webhook stub (provider -> server). For production, verify signatures and use raw body.
paymentsRouter.post("/:provider", async (req, res, next) => {
  try {
    const provider = req.params.provider;
    const event = req.body || {};
    // Best-effort generic handling; real impl should verify signatures per provider.
    const type = event.type || event.event;
    if (provider === "stripe" && type === "payment_intent.succeeded") {
      const intent = event.data?.object;
      if (intent?.id) {
        const payment = await prisma.payment.findFirst({ where: { providerPaymentId: intent.id } });
        if (payment) {
          await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.CAPTURED, rawPayload: intent } });
          await ensureInvoice(payment.orderId);
        }
      }
    }
    // Razorpay: event.payload.payment.entity
    if (provider === "razorpay" && (type === "payment.captured" || event.payload?.payment?.entity)) {
      const entity = event.payload?.payment?.entity;
      const providerPaymentId = entity?.id;
      const providerOrderId = entity?.order_id;
      if (providerPaymentId || providerOrderId) {
        const payment = await prisma.payment.findFirst({ where: { OR: [{ providerPaymentId: providerPaymentId || undefined }, { providerOrderId: providerOrderId || undefined }] } });
        if (payment) {
          await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.CAPTURED, providerPaymentId: providerPaymentId ?? payment.providerPaymentId, rawPayload: event } });
          await ensureInvoice(payment.orderId);
        }
      }
    }
    res.json({ received: true });
  } catch (e) { next(e); }
});
