import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, post } from "../lib/api";
import { formatMoney } from "../components/ProductCard";
import { useAuth } from "../lib/auth";

export default function Checkout() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressId, setAddressId] = useState<string>("");
  const [couponCode, setCouponCode] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!user) return;
    get<{ addresses: any[] }>("/users/me/addresses").then(r => { setAddresses(r.addresses||[]); const d = (r.addresses||[]).find((a:any)=>a.isDefault) || r.addresses?.[0]; if (d) setAddressId(d.id); }).catch(()=>{});
  }, [user]);

  async function loadPreview() {
    setMsg("");
    try {
      const r = await post<{ preview: any }>("/checkout/preview", { couponCode: couponCode || undefined, shippingAddressId: addressId || undefined });
      setPreview(r.preview);
    } catch (e: any) { setMsg(e.message || "Failed to load preview"); setPreview(null); }
  }
  useEffect(() => { if (user) loadPreview(); }, [user, addressId]);

  async function placeOrder() {
    setPlacing(true); setMsg("");
    try {
      const r = await post<{ order: any }>("/orders", { couponCode: couponCode || undefined, shippingAddressId: addressId || undefined });
      const order = r.order;
      // initiate payment and auto-confirm test mode for demo
      const pay = await post<any>(`/orders/${order.id}/pay`, {});
      if (pay.mode === "test" && pay.confirmEndpoint) {
        await post(pay.confirmEndpoint.replace("/api/v1", ""), {});
        setMsg("Order placed and test payment captured.");
      } else if (pay.mode === "stripe") {
        setMsg("Stripe PaymentIntent created (client secret returned). Complete payment on client with Stripe.js in a full integration.");
      } else {
        setMsg("Order placed.");
      }
      setTimeout(() => nav(`/orders/${order.id}`), 800);
    } catch (e: any) { setMsg(e.message || "Failed to place order"); }
    finally { setPlacing(false); }
  }

  if (!user) return <div className="mx-auto max-w-3xl px-4 py-12">Please sign in to checkout.</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Checkout</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="font-display text-xl font-bold">Shipping address</h2>
            {addresses.length === 0 ? (
              <p className="mt-2 text-sm text-foreground-muted">No saved addresses. You can place order without selecting a saved address, or add one in your account (API: POST /users/me/addresses).</p>
            ) : (
              <div className="mt-3 space-y-2">
                {addresses.map((a) => (
                  <label key={a.id} className={`flex gap-3 rounded-md border p-3 cursor-pointer ${addressId===a.id?"border-primary bg-primary-soft/30":"border-border"}`}>
                    <input type="radio" name="addr" checked={addressId===a.id} onChange={()=>setAddressId(a.id)} />
                    <div className="text-sm"><p className="font-medium">{a.label || "Address"}</p><p className="text-foreground-muted">{a.line1}{a.line2?`, ${a.line2}`:""}, {a.city}, {a.state} {a.postalCode}, {a.country}</p></div>
                  </label>
                ))}
              </div>
            )}
          </section>
          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="font-display text-xl font-bold">Coupon</h2>
            <div className="mt-3 flex gap-2">
              <input value={couponCode} onChange={e=>setCouponCode(e.target.value.toUpperCase())} placeholder="Enter code" className="w-full rounded-md border border-border px-3 py-2" />
              <button onClick={loadPreview} className="rounded-md border border-border px-4 py-2 font-medium hover:bg-surface-alt">Apply</button>
            </div>
          </section>
        </div>
        <aside className="h-fit rounded-lg border border-border bg-surface p-5 shadow-card">
          <h2 className="font-display text-xl font-bold">Order summary</h2>
          {!preview ? <p className="mt-3 text-sm text-foreground-muted">Loading preview...</p> : (
            <>
              <div className="mt-3 space-y-2 text-sm">
                {preview.items?.map((i:any, idx:number) => <div key={idx} className="flex justify-between gap-2"><span className="truncate">{i.title} × {i.quantity}</span><span>{formatMoney(i.lineTotal)}</span></div>)}
              </div>
              <div className="mt-4 border-t border-border pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(preview.subtotal)}</span></div>
                <div className="flex justify-between text-success"><span>Discount</span><span>-{formatMoney(preview.discount||0)}</span></div>
                <div className="flex justify-between font-semibold text-base pt-1"><span>Total</span><span>{formatMoney(preview.total)}</span></div>
                <p className="text-xs text-foreground-muted pt-1">Platform commission (recorded): {formatMoney(preview.platformCommission||0)}</p>
              </div>
              <button onClick={placeOrder} disabled={placing} className="mt-4 w-full rounded-md bg-accent px-4 py-2.5 font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-60">{placing?"Placing...":"Place order & pay (test)"}</button>
            </>
          )}
          {msg && <p className="mt-3 text-sm text-foreground-muted">{msg}</p>}
        </aside>
      </div>
    </div>
  );
}
