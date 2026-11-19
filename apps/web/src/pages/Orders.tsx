import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get } from "../lib/api";
import { formatMoney } from "../components/ProductCard";
import { useAuth } from "../lib/auth";

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => { if (user) get<{ orders: any[] }>("/orders").then(r=>setOrders(r.orders||[])).catch(()=>{}); }, [user]);
  if (!user) return <div className="mx-auto max-w-4xl px-4 py-12">Please sign in.</div>;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Your orders</h1>
      <div className="mt-6 space-y-4">
        {orders.map((o) => (
          <Link key={o.id} to={`/orders/${o.id}`} className="block rounded-lg border border-border bg-surface p-4 hover:bg-surface-alt">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">Order #{o.id.slice(0,8)}</p>
                <p className="text-sm text-foreground-muted">{new Date(o.placedAt || o.createdAt).toLocaleString()} · {o.items?.length || 0} item(s)</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatMoney(o.total, o.currency)}</p>
                <span className="inline-flex rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{o.status}</span>
              </div>
            </div>
          </Link>
        ))}
        {orders.length === 0 && <p className="text-foreground-muted">No orders yet.</p>}
      </div>
    </div>
  );
}
