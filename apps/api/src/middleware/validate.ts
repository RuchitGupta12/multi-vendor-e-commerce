import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    }) as { body?: unknown; query?: unknown; params?: unknown };
    if (parsed.body) req.body = parsed.body;
    if (parsed.query) req.query = parsed.query as any;
    if (parsed.params) req.params = parsed.params as any;
    next();
  };
}

export function validateBody<T extends AnyZodObject>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}
