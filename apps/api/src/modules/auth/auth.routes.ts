import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import * as controller from "./auth.controller";

export const authRouter = Router();

authRouter.post("/register", validateBody(controller.registerSchema), (req, res, next) =>
  controller.register(req, res).catch(next)
);
authRouter.post("/login", validateBody(controller.loginSchema), (req, res, next) =>
  controller.login(req, res).catch(next)
);
authRouter.post("/refresh", validateBody(controller.refreshSchema), (req, res, next) =>
  controller.refresh(req, res).catch(next)
);
authRouter.post("/logout", validateBody(controller.refreshSchema), (req, res, next) =>
  controller.logout(req, res).catch(next)
);
authRouter.get("/me", authenticate, (req, res, next) => controller.me(req, res).catch(next));
