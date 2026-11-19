import React from "react";
import { Link } from "react-router-dom";

export type Product = {
  id: string; title: string; slug?: string; price: number | string; currency?: string;
  images?: { url: string }[]; vendor?: { id: string; storeName: string };
  avgRating?: number | null; stock?: number; description?: string;
};

export function formatMoney(v: number | string, currency = "INR") {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n || 0);
}

export function ProductCard({ p, onAdd }: { p: Product; onAdd?: (id: string) => void }) {
  const img = p.images?.[0]?.url;
  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-surface shadow-card flex flex-col">
      <Link to={`/products/${p.id}`} className="block aspect-[4/3] bg-surface-alt overflow-hidden">
        {img ? <img src={img} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-[1.02]" /> : <div className="h-full w-full bg-gradient-to-br from-primary-soft/60 to-accent-soft/50" />}
      </Link>
      <div className="p-4 flex flex-col flex-1">
        {p.vendor && <p className="text-xs font-medium text-primary">{p.vendor.storeName}</p>}
        <Link to={`/products/${p.id}`} className="mt-1 font-display text-lg font-bold leading-snug hover:text-primary">{p.title}</Link>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-base font-semibold">{formatMoney(p.price, p.currency || "INR")}</p>
          {p.avgRating != null && <p className="text-sm text-foreground-muted">★ {Number(p.avgRating).toFixed(1)}</p>}
        </div>
        {p.stock !== undefined && <p className={`mt-1 text-xs ${p.stock > 0 ? "text-success" : "text-danger"}`}>{p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</p>}
        {onAdd && (
          <button onClick={() => onAdd(p.id)} disabled={p.stock === 0} className="mt-4 w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed">
            Add to cart
          </button>
        )}
      </div>
    </div>
  );
}
