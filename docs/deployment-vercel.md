# Deploying to Vercel

This project is set up as two deployable apps:
- **Frontend:** `apps/web` (Vite + React SPA)
- **Backend:** `apps/api` (Express + Prisma, serverless on Vercel)

Deploy them as **separate Vercel projects** from the same repository.

## Prerequisites (hosted services)

Vercel is serverless; use managed/external services for stateful components:

| Component | Recommended options | Env var(s) |
|---|---|---|
| PostgreSQL | Vercel Postgres, Neon, Supabase, Railway | `DATABASE_URL` |
| Redis (optional, cart/cache) | Upstash Redis | `REDIS_URL` |
| Elasticsearch (optional, search) | Elastic Cloud, Bonsai | `ELASTICSEARCH_NODE` |
| Object storage (optional, images/invoices) | AWS S3, Cloudflare R2 (S3-compatible) | `S3_*` vars |
| Payments (optional, test mode) | Stripe / Razorpay test keys | `PAYMENT_PROVIDER`, provider keys |

> The app works without Redis/Elasticsearch/S3/payment keys: cart/orders use PostgreSQL, search falls back to DB queries, image management supports URL-based images, and checkout supports a **test payment capture** flow for demos.

## 1) Deploy the API (`apps/api`)

1. In Vercel, **Add New Project** → import this repo.
2. Set **Root Directory** to `apps/api`.
3. Framework preset: **Other** (Vercel will use `apps/api/vercel.json` / `@vercel/node`).
4. Build & install: defaults are fine (`npm install`, build per config). `postinstall` runs `prisma generate`.
5. Add environment variables (Production/Preview as needed):
   - `NODE_ENV=production`
   - `DATABASE_URL=<your postgres connection string>`
   - `JWT_ACCESS_SECRET=<strong-random-secret>`
   - `JWT_REFRESH_SECRET=<strong-random-secret>`
   - `JWT_ACCESS_EXPIRES_IN=15m`
   - `JWT_REFRESH_EXPIRES_IN=7d`
   - `CORS_ORIGIN=https://<your-web-app>.vercel.app` (comma-separated if multiple)
   - Optional: `REDIS_URL`, `ELASTICSEARCH_NODE`, `PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RAZORPAY_*`, `S3_*`
6. Deploy.

### Database migrations (required)

After the database is provisioned and `DATABASE_URL` is set, run migrations against production:

```bash
cd apps/api
# with DATABASE_URL pointing to production
npx prisma migrate deploy
```

You can run this locally (with prod env), via a CI step, or using a one-off environment that has access to the DB. Do **not** use `prisma migrate dev` in production.

## 2) Deploy the Web app (`apps/web`)

1. In Vercel, **Add New Project** → import the same repo (or create a second project).
2. Set **Root Directory** to `apps/web`.
3. Framework preset: **Vite** (auto-detected).
4. Build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add environment variable:
   - `VITE_API_BASE_URL=https://<your-api-project>.vercel.app/api/v1`
6. Deploy. SPA rewrites are configured in `apps/web/vercel.json`.

## 3) Post-deploy checks

- API health: `GET https://<api>.vercel.app/health`
- Web loads and can call API (check browser network/CORS). Ensure `CORS_ORIGIN` includes the exact web origin.
- Create an admin user (promote via DB/Prisma Studio on a trusted connection) to approve vendors and manage platform data.
- Test core flows: register/login, vendor apply/approval, create & activate product, browse/search, cart, checkout, test payment confirm, order/invoice, reviews, coupons.

## Notes & limitations

- **Serverless:** The API runs as serverless functions on Vercel. Use a pooled/HTTP-friendly Postgres connection (e.g. Neon pooled URL, Prisma Accelerate/Data Proxy, or PgBouncer) for best reliability under load.
- **Redis/Cart:** DB-backed cart is implemented for reliability; Redis is optional when `REDIS_URL` is provided.
- **Search:** DB-based search with filters/sort is the default; Elasticsearch can be integrated when `ELASTICSEARCH_NODE` is configured.
- **Images/Invoices:** Product images support URL-based entries; S3 upload and PDF generation can be extended with provider SDKs/credentials. Invoices are served as printable HTML by default.
- **Payments:** Stripe PaymentIntent creation is supported when `STRIPE_SECRET_KEY` and the `stripe` package/config are available; otherwise the checkout uses a demo **test-capture** endpoint (`/orders/:id/pay/confirm-test`) so the full order lifecycle is exercisable. Webhook signature verification and split transfers (Stripe Connect/Razorpay Route) should be finalized with provider test accounts before production use.
- **CORS:** Set `CORS_ORIGIN` to your deployed web origin(s). For local dev, default is `http://localhost:5173`.
