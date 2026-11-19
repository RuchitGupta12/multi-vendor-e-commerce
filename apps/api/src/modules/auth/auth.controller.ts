import { Request, Response } from "express";
import { z } from "zod";
import * as authService from "./auth.service";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["CUSTOMER", "VENDOR"]).optional(),
  storeName: z.string().min(1).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  const result = await authService.register(req.body);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body);
  res.json(result);
}

export async function refresh(req: Request, res: Response) {
  const result = await authService.refresh(req.body);
  res.json(result);
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.body);
  res.status(204).send();
}

export async function me(req: Request, res: Response) {
  const user = await authService.me(req.user!.id);
  res.json({ user });
}
