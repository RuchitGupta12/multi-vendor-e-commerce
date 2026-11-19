import { Router } from "express";
import { z } from "zod";
import { Prisma, ProductStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { authenticate, requireRoles } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { isStorageConfigured, makeImageKey, presignUpload, resolveImageUrl, getBucket } from "../../lib/storage";

export const productsRouter = Router();

async function withResolvedImages<T extends { images?: any[] }>(product: T): Promise<T> {
  if (!product?.images) return product;
  const images = await Promise.all(product.images.map(async (img) => ({ ...img, url: (await resolveImageUrl(img)) || img.url })));
  return { ...product, images } as T;
}

async function withResolvedImagesMany<T extends { images?: any[] }>(products: T[]): Promise<T[]> {
  return Promise.all(products.map((p) => withResolvedImages(p)));
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 6);
}

const productSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().positive(),
  currency: z.string().default("INR"),
  stock: z.coerce.number().int().min(0).default(0),
  sku: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  attributes: z.record(z.any()).optional(),
});

async function getVendorForUser(userId: string) {
  const vendor = await prisma.vendorProfile.findUnique({ where: { userId } });
  if (!vendor) throw new AppError(403, "FORBIDDEN", "Vendor profile required");
  if (vendor.status !== "APPROVED") throw new AppError(403, "FORBIDDEN", "Vendor profile not approved");
  return vendor;
}

productsRouter.get("/", async (req, res, next) => {
  try {
    const { q, category, vendor, minPrice, maxPrice, inStock, sort, page = "1", limit = "12", status } = req.query as Record<string, string | undefined>;
    const take = Math.min(parseInt(limit || "12", 10) || 12, 50);
    const skip = (Math.max(parseInt(page || "1", 10) || 1, 1) - 1) * take;

    const where: Prisma.ProductWhereInput = {
      status: (status as ProductStatus) || "ACTIVE",
    };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    if (category) where.category = { slug: category };
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
    else if (sort === "oldest") orderBy = { createdAt: "asc" };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, vendor: { select: { id: true, storeName: true } }, category: { select: { id: true, name: true, slug: true } }, _count: { select: { reviews: true } } },
        orderBy,
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ products: await withResolvedImagesMany(products), pagination: { page: skip / take + 1, limit: take, total, pages: Math.ceil(total / take) } });
  } catch (e) { next(e); }
});

productsRouter.get("/:id", async (req, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        vendor: { select: { id: true, storeName: true, description: true, status: true } },
        category: true,
        reviews: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
        _count: { select: { reviews: true } },
      },
    });
    if (!product) throw new AppError(404, "NOT_FOUND", "Product not found");
    const agg = await prisma.review.aggregate({ where: { productId: product.id }, _avg: { rating: true } });
    res.json({ product: { ...(await withResolvedImages(product)), avgRating: agg._avg.rating ?? null } });
  } catch (e) { next(e); }
});

productsRouter.post("/", authenticate, requireRoles("VENDOR"), validateBody(productSchema), async (req, res, next) => {
  try {
    const vendor = await getVendorForUser(req.user!.id);
    const product = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        title: req.body.title,
        slug: slugify(req.body.title),
        description: req.body.description,
        price: new Prisma.Decimal(req.body.price),
        currency: req.body.currency ?? "INR",
        stock: req.body.stock ?? 0,
        sku: req.body.sku,
        status: req.body.status ?? "DRAFT",
        categoryId: req.body.categoryId ?? null,
        attributes: req.body.attributes ?? undefined,
      },
    });
    res.status(201).json({ product });
  } catch (e) { next(e); }
});

productsRouter.patch("/:id", authenticate, requireRoles("VENDOR", "ADMIN"), validateBody(productSchema.partial()), async (req, res, next) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Product not found");
    if (req.user!.role !== "ADMIN") {
      const vendor = await getVendorForUser(req.user!.id);
      if (existing.vendorId !== vendor.id) throw new AppError(403, "FORBIDDEN", "Not your product");
    }
    const data: any = { ...req.body };
    if (data.price !== undefined) data.price = new Prisma.Decimal(data.price);
    const product = await prisma.product.update({ where: { id: existing.id }, data });
    res.json({ product });
  } catch (e) { next(e); }
});

productsRouter.delete("/:id", authenticate, requireRoles("VENDOR", "ADMIN"), async (req, res, next) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Product not found");
    if (req.user!.role !== "ADMIN") {
      const vendor = await getVendorForUser(req.user!.id);
      if (existing.vendorId !== vendor.id) throw new AppError(403, "FORBIDDEN", "Not your product");
    }
    await prisma.product.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (e) { next(e); }
});

const imageSchema = z.object({ url: z.string().min(1), key: z.string().optional(), alt: z.string().optional(), sortOrder: z.coerce.number().int().optional() });

const presignSchema = z.object({ filename: z.string().min(1), contentType: z.string().optional() });

productsRouter.post("/:id/images/presign", authenticate, requireRoles("VENDOR", "ADMIN"), validateBody(presignSchema), async (req, res, next) => {
  try {
    if (!isStorageConfigured()) throw new AppError(400, "STORAGE_NOT_CONFIGURED", "Object storage is not configured");
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Product not found");
    if (req.user!.role !== "ADMIN") {
      const vendor = await getVendorForUser(req.user!.id);
      if (existing.vendorId !== vendor.id) throw new AppError(403, "FORBIDDEN", "Not your product");
    }
    const key = makeImageKey(existing.id, req.body.filename);
    const signed = await presignUpload({ key, contentType: req.body.contentType });
    res.json({ ...signed, bucket: getBucket() });
  } catch (e) { next(e); }
});

productsRouter.post("/:id/images", authenticate, requireRoles("VENDOR", "ADMIN"), validateBody(imageSchema), async (req, res, next) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Product not found");
    if (req.user!.role !== "ADMIN") {
      const vendor = await getVendorForUser(req.user!.id);
      if (existing.vendorId !== vendor.id) throw new AppError(403, "FORBIDDEN", "Not your product");
    }
    const image = await prisma.productImage.create({ data: { productId: existing.id, url: req.body.url, key: req.body.key ?? req.body.url, alt: req.body.alt, sortOrder: req.body.sortOrder ?? 0 } });
    res.status(201).json({ image });
  } catch (e) { next(e); }
});

productsRouter.delete("/:id/images/:imageId", authenticate, requireRoles("VENDOR", "ADMIN"), async (req, res, next) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Product not found");
    if (req.user!.role !== "ADMIN") {
      const vendor = await getVendorForUser(req.user!.id);
      if (existing.vendorId !== vendor.id) throw new AppError(403, "FORBIDDEN", "Not your product");
    }
    await prisma.productImage.delete({ where: { id: req.params.imageId } });
    res.status(204).send();
  } catch (e) { next(e); }
});
