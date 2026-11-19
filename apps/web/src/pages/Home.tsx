import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, post } from "../lib/api";
import { Product, ProductCard } from "../components/ProductCard";
import { useAuth } from "../lib/auth";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    get<{ products: Product[] }>("/products?limit=8&sort=newest").then((r) => setProducts(r.products || [])).catch(() => {});
    get<{ categories: any[] }>("/categories").then((r) => setCategories(r.categories || [])).catch(() => {});
  }, []);

  async function addToCart(productId: string) {
    if (!user) { window.location.href = "/login"; return; }
    try { await post("/cart/items", { productId, quantity: 1 }); alert("Added to cart"); } catch (e: any) { alert(e.message || "Failed"); }
  }

  return (
    <div>
      <section className="border-b border-border bg-gradient-to-br from-primary-soft/60 via-background to-accent-soft/40">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <span className="inline-flex rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">Multi-vendor marketplace</span>
            <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Shop from many vendors in one trusted place.</h1>
            <p className="mt-4 max-w-2xl text-foreground-muted sm:text-lg">Discover unique products, enjoy a unified cart and checkout, and track every order from placed to delivered.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/products" className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">Browse products</Link>
              <Link to="/register" className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-semibold hover:bg-surface-alt">Become a vendor</Link>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
            <h2 className="font-display text-lg font-bold">Why Bazaar</h2>
            <ul className="mt-3 space-y-2 text-sm text-foreground-muted">
              <li>• Verified vendors and curated catalogs</li>
              <li>• Secure checkout with split payments & commissions</li>
              <li>• Unified cart across vendors, transparent fulfillment</li>
              <li>• Reviews, coupons, and downloadable invoices</li>
            </ul>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
          <h2 className="font-display text-2xl font-bold">Categories</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link key={c.id} to={`/products?category=${c.slug}`} className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-alt">{c.name}</Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold">Latest products</h2>
            <p className="text-sm text-foreground-muted">Fresh arrivals from our vendors</p>
          </div>
          <Link to="/products" className="text-sm font-semibold text-primary hover:underline">View all</Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} p={p} onAdd={addToCart} />)}
          {products.length === 0 && <p className="text-foreground-muted">No products yet. Vendors can add products from their dashboard.</p>}
        </div>
      </section>
    </div>
  );
}
