import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { get, post } from "../lib/api";
import { formatMoney } from "../components/ProductCard";
import { useAuth } from "../lib/auth";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const { user } = useAuth();

  async function load() {
    if (!id) return;
    setLoading(true);
    try { const r = await get<{ product: any }>(`/products/${id}`); setProduct(r.product); } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  async function addToCart() {
    if (!user) { window.location.href = "/login"; return; }
    try { await post("/cart/items", { productId: product.id, quantity: 1 }); alert("Added to cart"); } catch (e: any) { alert(e.message || "Failed"); }
  }
  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    try { await post(`/reviews/product/${product.id}`, { rating, comment }); setComment(""); await load(); } catch (e: any) { alert(e.message || "Failed"); }
  }

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-10">Loading...</div>;
  if (!product) return <div className="mx-auto max-w-7xl px-4 py-10">Product not found.</div>;
  const img = product.images?.[0]?.url;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-border bg-surface-alt aspect-square">
          {img ? <img src={img} alt={product.title} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-primary-soft/60 to-accent-soft/50" />}
        </div>
        <div>
          {product.vendor && <p className="text-sm font-medium text-primary">Sold by {product.vendor.storeName}</p>}
          <h1 className="mt-1 font-display text-3xl font-bold">{product.title}</h1>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(product.price, product.currency || "INR")}</p>
          {product.avgRating != null && <p className="mt-1 text-sm text-foreground-muted">★ {Number(product.avgRating).toFixed(1)} ({product._count?.reviews ?? 0} reviews)</p>}
          <p className={`mt-2 text-sm font-medium ${product.stock > 0 ? "text-success" : "text-danger"}`}>{product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</p>
          {product.description && <p className="mt-4 text-foreground-muted whitespace-pre-line">{product.description}</p>}
          <div className="mt-6 flex gap-3">
            <button onClick={addToCart} disabled={product.stock === 0} className="rounded-md bg-accent px-6 py-3 font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50">Add to cart</button>
          </div>
        </div>
      </div>

      <section className="mt-12 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-bold">Reviews</h2>
          <div className="mt-4 space-y-4">
            {(product.reviews || []).map((r: any) => (
              <div key={r.id} className="rounded-md border border-border bg-surface p-4">
                <div className="flex items-center justify-between"><p className="font-medium">{r.user?.name || "User"}</p><p className="text-sm text-accent">★ {r.rating}</p></div>
                {r.comment && <p className="mt-1 text-sm text-foreground-muted">{r.comment}</p>}
              </div>
            ))}
            {(!product.reviews || product.reviews.length === 0) && <p className="text-foreground-muted">No reviews yet.</p>}
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">Write a review</h2>
          {user ? (
            <form onSubmit={submitReview} className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
              <div>
                <label className="text-sm font-medium">Rating</label>
                <select value={rating} onChange={e=>setRating(parseInt(e.target.value,10))} className="mt-1 w-full rounded-md border border-border px-3 py-2"><option value={5}>5 - Excellent</option><option value={4}>4 - Good</option><option value={3}>3 - Average</option><option value={2}>2 - Poor</option><option value={1}>1 - Bad</option></select>
              </div>
              <div>
                <label className="text-sm font-medium">Comment</label>
                <textarea value={comment} onChange={e=>setComment(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2" rows={4} />
              </div>
              <button className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary-hover">Submit review</button>
            </form>
          ) : <p className="mt-4 text-foreground-muted">Sign in to leave a review.</p>}
        </div>
      </section>
    </div>
  );
}
