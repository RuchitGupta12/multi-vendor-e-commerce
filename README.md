# Multi-Vendor E-Commerce Marketplace

Amazon-style marketplace where multiple vendors sell, customers buy, and the platform handles split payments and commissions.

## Stack

- **Frontend:** React, TypeScript, Tailwind CSS (Vite)
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL + Prisma
- **Cache / Cart:** Redis
- **Search:** Elasticsearch
- **Storage:** S3-compatible (images, invoices)
- **Payments:** Razorpay Route / Stripe Connect (test mode)
- **Infra:** Docker (dev services)

## Repository structure

```text
apps/
  api/        # Express + Prisma API
  web/        # React + Vite frontend
docker/       # Local dev services (Postgres, Redis, Elasticsearch)
docs/         # Architecture, API, and design notes
```

## Prerequisites

- Node.js 20+
- npm 10+ (or pnpm/yarn)
- Docker Desktop (for local Postgres/Redis/Elasticsearch)

## Getting started

### 1) Start dev services

```bash
cd docker
docker compose up -d
```

Services:
- PostgreSQL: `localhost:5432` (db: `marketplace`, user: `postgres`, pass: `postgres`)
- Redis: `localhost:6379`
- Elasticsearch: `localhost:9200`

### 2) API setup

```bash
cd apps/api
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

API runs at `http://localhost:4000` (default).

### 3) Web setup

```bash
cd apps/web
cp .env.example .env
npm install
npm run dev
```

Web runs at `http://localhost:5173` (default) and proxies `/api` to the API in dev.

## Features (implemented)

- **Auth & RBAC:** JWT access/refresh, roles (Customer/Vendor/Admin), protected routes
- **Vendors:** registration/apply, admin approval/suspension, vendor dashboard, fulfillment updates
- **Catalog:** categories, product CRUD, image URLs, public browse & detail pages
- **Search:** DB-backed search with filters/sort (`/search`, `/products`) — Elasticsearch-ready via config
- **Cart & Checkout:** DB-backed cart, coupon validation, checkout preview with commission breakdown
- **Orders & Payments:** order lifecycle (placed/packed/shipped/delivered/cancelled), per-item commission/vendor amounts, payment initiation, test-capture flow, webhook endpoint, printable invoice
- **Reviews & Coupons:** product reviews, admin coupon management & validation
- **Admin:** analytics KPIs, vendor/order management

## Design system

- **Theme:** "Bazaar" — warm neutrals, teal primary `#0F766E`, saffron accent `#D97706`
- **Fonts:** Bricolage Grotesque (display) + Plus Jakarta Sans (body/UI)
- Tokens: `apps/web/src/index.css` and `apps/web/tailwind.config.ts`

## Deploy on Vercel

Ready for **separate Vercel projects** (frontend and backend). See **[docs/deployment-vercel.md](docs/deployment-vercel.md)** for step-by-step setup, required environment variables, migrations (`prisma migrate deploy`), and production notes.

## Key paths

- Prisma schema: `apps/api/prisma/schema.prisma`
- API env template: `apps/api/.env.example`
- Web env template: `apps/web/.env.example`
- Vercel configs: `apps/api/vercel.json`, `apps/web/vercel.json`
- API serverless entry: `apps/api/api/serverless.ts`

