import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requireRoles } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";

export const usersRouter = Router();

const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
});

const addressSchema = z.object({
  label: z.string().optional(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().optional(),
  isDefault: z.boolean().optional(),
});

usersRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, vendorProfile: true },
    });
    res.json({ user });
  } catch (e) { next(e); }
});

usersRouter.patch("/me", authenticate, validateBody(updateMeSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name: req.body.name },
      select: { id: true, email: true, name: true, role: true },
    });
    res.json({ user });
  } catch (e) { next(e); }
});

usersRouter.get("/me/addresses", authenticate, requireRoles("CUSTOMER", "VENDOR"), async (req, res, next) => {
  try {
    const addresses = await prisma.address.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" } });
    res.json({ addresses });
  } catch (e) { next(e); }
});

usersRouter.post("/me/addresses", authenticate, requireRoles("CUSTOMER", "VENDOR"), validateBody(addressSchema), async (req, res, next) => {
  try {
    if (req.body.isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
    }
    const address = await prisma.address.create({ data: { ...req.body, userId: req.user!.id } });
    res.status(201).json({ address });
  } catch (e) { next(e); }
});

usersRouter.patch("/me/addresses/:id", authenticate, requireRoles("CUSTOMER", "VENDOR"), validateBody(addressSchema.partial()), async (req, res, next) => {
  try {
    const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Address not found");
    if (req.body.isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
    }
    const address = await prisma.address.update({ where: { id: existing.id }, data: req.body });
    res.json({ address });
  } catch (e) { next(e); }
});

usersRouter.delete("/me/addresses/:id", authenticate, requireRoles("CUSTOMER", "VENDOR"), async (req, res, next) => {
  try {
    const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Address not found");
    await prisma.address.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (e) { next(e); }
});
