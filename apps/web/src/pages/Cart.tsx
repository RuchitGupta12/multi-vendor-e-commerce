import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { del, get, patch } from "../lib/api";
import { formatMoney } from "../components/ProductCard";
import { useAuth } from "../lib/auth";

export default function Cart() {
  const { user } = useAuth();
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  async function load() {
    if (!user) { setLoading(false); return; }
    try { const r = await get<any>("/cart"); setCart(r.cart); } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [user]);

  async function updateQty(itemId: string, quantity: number) {
    await patch(`/cart/items/${itemId}`, { quantity });
    load();
  }
  async function removeItem(itemId: string) {
    await del(`/cart/items/${itemId}`);
    load();
  }

  if (!user) return <div className="mx-auto max-w-4xl px-4 py-12"><p>Please <Link to="/login" className="text-primary underline">sign in</Link> to view your cart.</p></div>;
  if (loading) return <div className="mx-auto max-w-4xl px-4 py-12">Loading...</div>;

  const items = cart?.items || [];
  const subtotal = items.reduce((s: number, i: any) => s + Number(i.product.price) * i.quantity, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Your cart</h1>
      {items.length === 0 ? (
        <p className="mt-4 text-foreground-muted">Your cart is empty. <Link to="/products" className="text-primary underline">Browse products</Link></p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {items.map((i: any) => (
              <div key={i.id} className="flex gap-4 rounded-lg border border-border bg-surface p-4">
                <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-surface-alt">
                  {i.product.images?.[0]?.url ? <img src={i.product.images[0].url} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{i.product.title}</p>
                  <p className="text-sm text-foreground-muted">{i.product.vendor?.storeName}</p>
                  <p className="mt-1 font-medium">{formatMoney(i.product.price, i.product.currency)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={() => updateQty(i.id, Math.max(1, i.quantity - 1))} className="h-8 w-8 rounded border border-border">-</button>
                    <span className="w-8 text-center text-sm">{i.quantity}</span>
                    <button onClick={() => updateQty(i.id, i.quantity + 1)} className="h-8 w-8 rounded border border-border">+</button>
                    <button onClick={() => removeItem(i.id)} className="ml-3 text-sm text-danger hover:underline">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <aside className="h-fit rounded-lg border border-border bg-surface p-5 shadow-card">
            <h2 className="font-display text-xl font-bold">Summary</h2>
            <div className="mt-3 flex justify-between text-sm"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
            <p className="mt-1 text-xs text-foreground-muted">Shipping and discounts calculated at checkout.</p>
            <button onClick={() => nav("/checkout")} className="mt-4 w-full rounded-md bg-accent px-4 py-2.5 font-semibold text-accent-foreground hover:bg-accent-hover">Proceed to checkout</button>
          </aside>
        </div>
      )}
    </div>
  );
}
