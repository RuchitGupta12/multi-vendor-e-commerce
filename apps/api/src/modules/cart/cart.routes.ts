import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";

export const cartRouter = Router();

async function getOrCreateCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    include: { items: { include: { product: { include: { images: { take: 1, orderBy: { sortOrder: "asc" } }, vendor: { select: { id: true, storeName: true } } } } }, orderBy: { createdAt: "asc" } } },
  });
}

cartRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user!.id);
    const subtotal = cart.items.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0);
    res.json({ cart, subtotal });
  } catch (e) { next(e); }
});

const addSchema = z.object({ productId: z.string().uuid(), quantity: z.coerce.number().int().min(1).default(1) });

cartRouter.post("/items", authenticate, validateBody(addSchema), async (req, res, next) => {
  try {
    const cart = await prisma.cart.upsert({ where: { userId: req.user!.id }, update: {}, create: { userId: req.user!.id } });
    const product = await prisma.product.findUnique({ where: { id: req.body.productId } });
    if (!product || product.status !== "ACTIVE") throw new AppError(404, "NOT_FOUND", "Product not available");
    if (product.stock < req.body.quantity) throw new AppError(400, "OUT_OF_STOCK", "Insufficient stock");

    const item = await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } },
      update: { quantity: { increment: req.body.quantity } },
      create: { cartId: cart.id, productId: product.id, quantity: req.body.quantity },
      include: { product: true },
    });
    if (item.quantity > product.stock) {
      await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: product.stock } });
    }
    const updated = await getOrCreateCart(req.user!.id);
    res.status(201).json({ cart: updated });
  } catch (e) { next(e); }
});

cartRouter.patch("/items/:itemId", authenticate, validateBody(z.object({ quantity: z.coerce.number().int().min(1) })), async (req, res, next) => {
  try {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user!.id } });
    if (!cart) throw new AppError(404, "NOT_FOUND", "Cart not found");
    const item = await prisma.cartItem.findFirst({ where: { id: req.params.itemId, cartId: cart.id }, include: { product: true } });
    if (!item) throw new AppError(404, "NOT_FOUND", "Cart item not found");
    if (req.body.quantity > item.product.stock) throw new AppError(400, "OUT_OF_STOCK", "Insufficient stock");
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: req.body.quantity } });
    res.json({ cart: await getOrCreateCart(req.user!.id) });
  } catch (e) { next(e); }
});

cartRouter.delete("/items/:itemId", authenticate, async (req, res, next) => {
  try {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user!.id } });
    if (!cart) throw new AppError(404, "NOT_FOUND", "Cart not found");
    await prisma.cartItem.deleteMany({ where: { id: req.params.itemId, cartId: cart.id } });
    res.json({ cart: await getOrCreateCart(req.user!.id) });
  } catch (e) { next(e); }
});

cartRouter.delete("/", authenticate, async (req, res, next) => {
  try {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user!.id } });
    if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    res.json({ cart: await getOrCreateCart(req.user!.id), subtotal: 0 });
  } catch (e) { next(e); }
});
