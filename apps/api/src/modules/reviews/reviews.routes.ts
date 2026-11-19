import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requireRoles } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";

export const reviewsRouter = Router({ mergeParams: true });

reviewsRouter.get("/product/:productId", async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: req.params.productId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const agg = await prisma.review.aggregate({ where: { productId: req.params.productId }, _avg: { rating: true }, _count: true });
    res.json({ reviews, summary: { count: agg._count, avgRating: agg._avg.rating } });
  } catch (e) { next(e); }
});

const reviewSchema = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().max(2000).optional() });

reviewsRouter.post("/product/:productId", authenticate, requireRoles("CUSTOMER", "VENDOR", "ADMIN"), validateBody(reviewSchema), async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
    if (!product) throw new AppError(404, "NOT_FOUND", "Product not found");
    // optional: ensure purchased; simplified - allow if they have a delivered/placed order containing product
    const purchased = await prisma.orderItem.findFirst({ where: { productId: product.id, order: { customerId: req.user!.id } } });
    if (!purchased && req.user!.role === "CUSTOMER") {
      // allow review but could be gated; keeping lenient for demo
    }
    const review = await prisma.review.upsert({
      where: { productId_userId: { productId: product.id, userId: req.user!.id } },
      update: { rating: req.body.rating, comment: req.body.comment },
      create: { productId: product.id, userId: req.user!.id, rating: req.body.rating, comment: req.body.comment },
      include: { user: { select: { id: true, name: true } } },
    });
    res.status(201).json({ review });
  } catch (e) { next(e); }
});

reviewsRouter.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) throw new AppError(404, "NOT_FOUND", "Review not found");
    if (review.userId !== req.user!.id && req.user!.role !== "ADMIN") throw new AppError(403, "FORBIDDEN", "Not allowed");
    await prisma.review.delete({ where: { id: review.id } });
    res.status(204).send();
  } catch (e) { next(e); }
});
