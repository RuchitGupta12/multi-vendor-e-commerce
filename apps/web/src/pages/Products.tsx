import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { get, post } from "../lib/api";
import { Product, ProductCard } from "../components/ProductCard";
import { useAuth } from "../lib/auth";

export default function Products() {
  const [sp, setSp] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(sp.get("q") || "");
  const { user } = useAuth();

  const category = sp.get("category") || "";
  const sort = sp.get("sort") || "newest";

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sp.get("q")) params.set("q", sp.get("q")!);
    if (category) params.set("category", category);
    if (sort) params.set("sort", sort);
    params.set("limit", "24");
    get<{ results?: Product[]; products?: Product[] }>(`/search?${params.toString()}`)
      .then((r) => setProducts((r.results || r.products || []) as any))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [sp, category, sort]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(sp);
    if (q) next.set("q", q); else next.delete("q");
    setSp(next);
  }

  async function addToCart(productId: string) {
    if (!user) { window.location.href = "/login"; return; }
    try { await post("/cart/items", { productId, quantity: 1 }); alert("Added to cart"); } catch (e: any) { alert(e.message || "Failed to add"); }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Browse products</h1>
          <p className="text-foreground-muted">Search across all vendors</p>
        </div>
        <form onSubmit={submit} className="flex w-full max-w-xl gap-2">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products..." className="w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          <button className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary-hover">Search</button>
        </form>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <span className="text-sm text-foreground-muted">Sort:</span>
        {[
          ["newest", "Newest"], ["price_asc", "Price: Low"], ["price_desc", "Price: High"], ["rating", "Rating"]
        ].map(([v,l]) => (
          <button key={v} onClick={() => { const n = new URLSearchParams(sp); n.set("sort", v); setSp(n); }} className={`rounded-full border px-3 py-1.5 text-sm ${sort===v?"bg-primary text-primary-foreground border-primary":"bg-surface border-border hover:bg-surface-alt"}`}>{l}</button>
        ))}
        {(sp.get("q") || category) && <button onClick={()=>setSp({})} className="text-sm text-primary hover:underline ml-2">Clear filters</button>}
      </div>
      {loading ? <p className="mt-8 text-foreground-muted">Loading...</p> : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} p={p} onAdd={addToCart} />)}
          {products.length === 0 && <p className="text-foreground-muted">No products found.</p>}
        </div>
      )}
    </div>
  );
}
