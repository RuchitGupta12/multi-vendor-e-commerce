import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { usersRouter } from "./modules/users/users.routes";
import { vendorsRouter } from "./modules/vendors/vendors.routes";
import { productsRouter } from "./modules/products/products.routes";
import { categoriesRouter } from "./modules/categories/categories.routes";
import { cartRouter } from "./modules/cart/cart.routes";
import { ordersRouter } from "./modules/orders/orders.routes";
import { paymentsRouter } from "./modules/payments/payments.routes";
import { reviewsRouter } from "./modules/reviews/reviews.routes";
import { couponsRouter } from "./modules/coupons/coupons.routes";
import { adminRouter } from "./modules/admin/admin.routes";
import { searchRouter } from "./modules/search/search.routes";
import { errorHandler, notFound } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  const origins = env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || origins.length === 0 || origins.includes("*") || origins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (env.NODE_ENV !== "test") app.use(morgan("dev"));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "marketplace-api" });
  });

  const api = express.Router();
  api.use("/auth", authRouter);
  api.use("/users", usersRouter);
  api.use("/vendors", vendorsRouter);
  api.use("/products", productsRouter);
  api.use("/categories", categoriesRouter);
  api.use("/cart", cartRouter);
  api.use("/orders", ordersRouter);
  api.use("/webhooks/payments", paymentsRouter);
  api.use("/reviews", reviewsRouter);
  api.use("/coupons", couponsRouter);
  api.use("/admin", adminRouter);
  api.use("/search", searchRouter);
  api.get("/", (_req, res) => {
    res.json({
      name: "Multi-Vendor Marketplace API",
      version: "v1",
      routes: ["/auth", "/users", "/vendors", "/products", "/categories", "/search", "/cart", "/orders", "/webhooks/payments", "/reviews", "/coupons", "/admin"],
    });
  });

  app.use("/api/v1", api);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
