import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { get, post } from "../lib/api";
import { formatMoney } from "../components/ProductCard";
import { useAuth } from "../lib/auth";

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [msg, setMsg] = useState("");
  async function load() { if (!id) return; try { const r = await get<{order:any}>(`/orders/${id}`); setOrder(r.order); } catch {} }
  useEffect(() => { load(); }, [id, user]);

  async function payNow() {
    if (!order) return;
    try {
      const pay = await post<any>(`/orders/${order.id}/pay`, {});
      if (pay.mode === "test" && pay.confirmEndpoint) { await post(pay.confirmEndpoint.replace("/api/v1",""), {}); setMsg("Payment captured (test)."); }
      else if (pay.mode === "stripe") setMsg("Stripe intent created - integrate Stripe.js to complete payment.");
      else setMsg("Payment initiated.");
      load();
    } catch (e:any) { setMsg(e.message || "Failed"); }
  }

  if (!user) return <div className="mx-auto max-w-4xl px-4 py-12">Please sign in.</div>;
  if (!order) return <div className="mx-auto max-w-4xl px-4 py-12">Loading...</div>;
  const captured = (order.payments||[]).some((p:any)=>p.status==="CAPTURED");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Order #{order.id.slice(0,8)}</h1>
          <p className="text-foreground-muted">Placed {new Date(order.placedAt || order.createdAt).toLocaleString()} · Status: <span className="font-semibold text-foreground">{order.status}</span></p>
        </div>
        <div className="flex gap-2">
          {!captured && order.status !== "CANCELLED" && <button onClick={payNow} className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-foreground hover:bg-accent-hover">Pay now (test)</button>}
          <a href={`${import.meta.env.VITE_API_BASE_URL || "/api/v1"}/orders/${order.id}/invoice`} target="_blank" rel="noreferrer" className="rounded-md border border-border bg-surface px-4 py-2 font-medium hover:bg-surface-alt">Invoice</a>
        </div>
      </div>
      {msg && <p className="mt-3 text-sm text-foreground-muted">{msg}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-display text-xl font-bold">Items</h2>
          <div className="mt-4 space-y-3">
            {order.items?.map((i:any) => (
              <div key={i.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium">{i.product?.title || "Product"}</p>
                  <p className="text-sm text-foreground-muted">Vendor: {i.vendor?.storeName || i.vendorId} · Qty {i.quantity} · Fulfillment: {i.fulfillmentStatus}</p>
                </div>
                <p className="font-semibold">{formatMoney(Number(i.unitPrice)*i.quantity, order.currency)}</p>
              </div>
            ))}
          </div>
        </section>
        <aside className="h-fit rounded-lg border border-border bg-surface p-5 shadow-card space-y-2 text-sm">
          <h2 className="font-display text-xl font-bold">Summary</h2>
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(order.subtotal, order.currency)}</span></div>
          <div className="flex justify-between text-success"><span>Discount</span><span>-{formatMoney(order.discount, order.currency)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span>{formatMoney(order.shippingFee, order.currency)}</span></div>
          <div className="flex justify-between font-semibold text-base border-t border-border pt-2"><span>Total</span><span>{formatMoney(order.total, order.currency)}</span></div>
          <p className="text-xs text-foreground-muted pt-2">Payment: {captured ? "Captured" : "Pending"}</p>
        </aside>
      </div>
    </div>
  );
}
