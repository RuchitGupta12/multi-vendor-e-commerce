# API Plan (`/api/v1`)

Base URL (dev): `http://localhost:4000/api/v1`

Auth: `Authorization: Bearer <accessToken>` (JWT). RBAC via role + ownership guards.

## Auth
- `POST /auth/register` — public — register (customer/vendor)
- `POST /auth/login` — public — login, returns access + refresh tokens
- `POST /auth/refresh` — public — rotate/refresh token
- `POST /auth/logout` — auth — revoke refresh token/session
- `GET /auth/me` — auth — current user

## Users & addresses
- `GET|PATCH /users/me` — auth
- `GET|POST /users/me/addresses` — customer
- `PATCH|DELETE /users/me/addresses/:id` — customer (owner)

## Vendors
- `POST /vendors/apply` — auth — submit onboarding + payout details
- `GET|PATCH /vendors/me` — vendor
- `GET /vendors/:id` — public — store profile
- `GET /vendors/me/orders` — vendor — own order items
- `PATCH /vendors/me/orders/:orderItemId/status` — vendor — fulfillment update

## Products & categories
- `GET /products` — public — list (filters/sort/pagination)
- `GET /products/:id` — public — detail
- `POST /products` — vendor — create
- `PATCH|DELETE /products/:id` — vendor (owner)
- `POST /products/:id/images` — vendor (owner) — upload (presign/multipart) to S3
- `DELETE /products/:id/images/:imageId` — vendor (owner)
- `GET /categories` — public
- `POST|PATCH|DELETE /categories(/:id)` — admin

## Search
- `GET /search` — public — `q`, `category`, `vendor`, `minPrice`, `maxPrice`, `rating`, `inStock`, `sort`, pagination

## Cart (Redis-backed)
- `GET /cart` — customer/guest
- `POST /cart/items` — add `{productId, quantity, variantId?}`
- `PATCH /cart/items/:itemId` — update quantity
- `DELETE /cart/items/:itemId` — remove
- `DELETE /cart` — clear

## Checkout, orders, payments
- `POST /checkout/preview` — customer — totals, coupon, commission split preview
- `POST /orders` — customer — create order (PLACED)
- `GET /orders` — customer — my orders
- `GET /orders/:id` — customer/vendor/admin (scoped)
- `POST /orders/:id/pay` — customer — create provider payment intent (split)
- `POST /webhooks/payments/:provider` — provider — signature-verified status updates
- `POST /orders/:id/cancel` — customer/admin (policy)

## Reviews, coupons, invoices
- `GET /products/:id/reviews` — public
- `POST /products/:id/reviews` — customer (optionally purchase-gated)
- `DELETE /reviews/:id` — owner/admin
- `POST /coupons/validate` — customer
- `GET|POST|PATCH|DELETE /coupons(/:id)` — admin manage (validate public)
- `GET /orders/:id/invoice` — customer/admin — PDF URL/download

## Admin
- `GET /admin/vendors` — list/filter by status
- `PATCH /admin/vendors/:id/status` — approve/suspend
- `GET /admin/orders` — platform orders
- `GET /admin/analytics` — GMV, orders, commission/revenue, top products/vendors, trends
- `PATCH /admin/products/:id/moderate` — unpublish/moderate

## Conventions
- Pagination: `page` & `limit` (or cursor) with `total` metadata.
- Validation: request body/query validation (Zod/Joi).
- Errors: consistent JSON `{ error: { code, message, details? } }`.
- Idempotency: use idempotency keys for payment/order creation endpoints.
- Webhooks: verify provider signatures before processing. 
- Money: store/compute in minor units or `Decimal`; record commission per `OrderItem`.
