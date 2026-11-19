# Architecture

## Overview

Multi-vendor marketplace with separate frontend and backend deployments.

- **Web (React + TS + Tailwind):** customer storefront, vendor dashboard, admin console.
- **API (Node + Express + TS):** REST API, JWT auth + RBAC, business logic.
- **PostgreSQL (Prisma):** system of record for users, catalog, orders, payments, reviews, coupons.
- **Redis:** cart storage and session/ephemeral caching.
- **Elasticsearch:** product search index (filters, sorting, full-text).
- **S3:** product images and generated invoice PDFs.
- **Payments:** Razorpay Route or Stripe Connect (test mode) for split payments, commissions, and webhooks.

## Roles

| Role | Summary |
|---|---|
| Customer | Browse/search, cart/checkout, orders, reviews, coupons, invoices |
| Vendor | Onboarding, own product CRUD & images, fulfill own order items, view sales |
| Admin | Vendor approval/moderation, categories/coupons, all orders, analytics, audits |

RBAC is enforced in API middleware; vendor-scoped resources require ownership checks.

## Core flows

1. **Catalog:** Vendor creates/updates products -> persisted in Postgres -> synced to Elasticsearch -> images stored in S3.
2. **Search:** Client queries `/search` -> API queries Elasticsearch with filters/sort/pagination.
3. **Cart:** Cart items stored in Redis keyed by user/session -> merged/persisted as needed on login.
4. **Checkout/Order:** Validate stock & coupon -> create Order + OrderItems (with commission splits) -> create payment intent.
5. **Payment:** Provider processes payment (split/transfer) -> webhook confirms capture -> order/payment status updated -> invoice generated to S3.
6. **Fulfillment:** Vendors update item status (packed/shipped/delivered); order status aggregates item states.

## Order lifecycle

`PLACED -> PACKED -> SHIPPED -> DELIVERED` (with `CANCELLED` where policy allows). Item-level fulfillment tracked per vendor in `OrderItem`.

## Environments & deployment

- **Dev:** Docker Compose for Postgres, Redis, Elasticsearch; local app servers.
- **Prod:** Frontend and backend deployed separately; managed Postgres/Redis/Elasticsearch/S3; secrets via env vars; webhook endpoints publicly reachable with signature verification.
