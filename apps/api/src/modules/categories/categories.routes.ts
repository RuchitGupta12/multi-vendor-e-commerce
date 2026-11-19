import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requireRoles } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";

export const categoriesRouter = Router();

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

categoriesRouter.get("/", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    res.json({ categories });
  } catch (e) { next(e); }
});

categoriesRouter.post("/", authenticate, requireRoles("ADMIN"), validateBody(categorySchema), async (req, res, next) => {
  try {
    const slug = req.body.slug ? slugify(req.body.slug) : slugify(req.body.name);
    const category = await prisma.category.create({ data: { name: req.body.name, slug, parentId: req.body.parentId ?? null } });
    res.status(201).json({ category });
  } catch (e) { next(e); }
});

categoriesRouter.patch("/:id", authenticate, requireRoles("ADMIN"), validateBody(categorySchema.partial()), async (req, res, next) => {
  try {
    const data: any = { ...req.body };
    if (data.slug) data.slug = slugify(data.slug);
    if (data.name && !data.slug) data.slug = slugify(data.name);
    const category = await prisma.category.update({ where: { id: req.params.id }, data });
    res.json({ category });
  } catch (e) { next(e); }
});

categoriesRouter.delete("/:id", authenticate, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) { next(e); }
});
