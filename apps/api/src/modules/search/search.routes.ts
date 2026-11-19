import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export const searchRouter = Router();

// DB-backed search with filters/sort (Elasticsearch can be added as an enhancement when configured)
searchRouter.get("/", async (req, res, next) => {
  try {
    const { q, category, vendor, minPrice, maxPrice, rating, inStock, sort, page = "1", limit = "12" } = req.query as Record<string, string | undefined>;
    const take = Math.min(parseInt(limit || "12", 10) || 12, 50);
    const skip = (Math.max(parseInt(page || "1", 10) || 1, 1) - 1) * take;

    const where: Prisma.ProductWhereInput = { status: "ACTIVE" };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { vendor: { storeName: { contains: q, mode: "insensitive" } } },
      ];
    }
    if (category) where.category = { OR: [{ slug: category }, { id: category }] };
    if (vendor) where.vendorId = vendor;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) (where.price as any).gte = new Prisma.Decimal(minPrice);
      if (maxPrice) (where.price as any).lte = new Prisma.Decimal(maxPrice);
    }
    if (inStock === "true") where.stock = { gt: 0 };

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
    if (sort === "price_asc") orderBy = { price: "asc" };
    else if (sort === "price_desc") orderBy = { price: "desc" };
    else if (sort === "newest") orderBy = { createdAt: "desc" };
    else if (sort === "relevance") orderBy = { createdAt: "desc" };

    let products = await prisma.product.findMany({
      where,
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        vendor: { select: { id: true, storeName: true } },
        category: { select: { id: true, name: true, slug: true } },
        reviews: { select: { rating: true } },
      },
      orderBy,
      skip,
      take,
    });

    let mapped = products.map((p) => {
      const avgRating = p.reviews.length ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length : null;
      const { reviews, ...rest } = p as any;
      return { ...rest, avgRating, reviewCount: reviews.length };
    });

    if (rating) {
      const minR = parseFloat(rating);
      if (!Number.isNaN(minR)) mapped = mapped.filter((p) => (p.avgRating ?? 0) >= minR);
    }
    if (sort === "rating") mapped = mapped.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));

    // total is approximate when rating filter applied post-query; acceptable for demo
    const total = await prisma.product.count({ where });
    res.json({ results: mapped, pagination: { page: skip / take + 1, limit: take, total, pages: Math.ceil(total / take) }, engine: process.env.ELASTICSEARCH_NODE ? "db-fallback" : "db" });
  } catch (e) { next(e); }
});
