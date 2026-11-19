import React, { useEffect, useState } from "react";
import { get, patch, post, del } from "../lib/api";
import { formatMoney } from "../components/ProductCard";
import { useAuth } from "../lib/auth";

export default function Admin() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponForm, setCouponForm] = useState({ code: "", type: "PERCENT", value: "10", minOrderAmount: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    try { setAnalytics((await get<{kpis:any; recentOrders:any[]; topProducts:any[]}>("/admin/analytics"))); } catch {}
    try { setVendors((await get<{vendors:any[]}>("/admin/vendors")).vendors||[]); } catch {}
    try { setOrders((await get<{orders:any[]}>("/admin/orders")).orders||[]); } catch {}
    try { setCoupons((await get<{coupons:any[]}>("/coupons")).coupons||[]); } catch {}
  }
  useEffect(() => { if (user?.role === "ADMIN") load(); }, [user]);

  if (!user) return <div className="mx-auto max-w-5xl px-4 py-12">Please sign in.</div>;
  if (user.role !== "ADMIN") return <div className="mx-auto max-w-5xl px-4 py-12">Admin access required.</div>;

  async function setVendorStatus(id: string, status: string) { await patch(`/admin/vendors/${id}/status`, { status }); load(); }
  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    try { await post("/coupons", { ...couponForm, value: parseFloat(couponForm.value), minOrderAmount: couponForm.minOrderAmount ? parseFloat(couponForm.minOrderAmount) : undefined }); setMsg("Coupon created"); setCouponForm({ code: "", type: "PERCENT", value: "10", minOrderAmount: "" }); load(); } catch (e:any){ setMsg(e.message); }
  }
  async function removeCoupon(id: string) { await del(`/coupons/${id}`); load(); }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      <h1 className="font-display text-3xl font-bold">Admin dashboard</h1>

      {analytics && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["GMV", formatMoney(analytics.kpis?.gmv || 0)],
            ["Platform commission", formatMoney(analytics.kpis?.platformCommission || 0)],
            ["Orders", analytics.kpis?.orders ?? 0],
            ["Vendors / Products / Customers", `${analytics.kpis?.vendors ?? 0} / ${analytics.kpis?.products ?? 0} / ${analytics.kpis?.customers ?? 0}`],
          ].map(([k,v]) => (
            <div key={String(k)} className="rounded-lg border border-border bg-surface p-4 shadow-card"><p className="text-sm text-foreground-muted">{k}</p><p className="mt-1 font-display text-2xl font-bold">{v as any}</p></div>
          ))}
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-display text-xl font-bold">Vendors</h2>
          <div className="mt-3 space-y-3 max-h-96 overflow-auto">
            {vendors.map(v => (
              <div key={v.id} className="rounded-md border border-border p-3 flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-medium">{v.storeName}</p><p className="text-sm text-foreground-muted">{v.user?.email} · {v.status}</p></div>
                <div className="flex gap-2 text-sm">
                  <button onClick={()=>setVendorStatus(v.id,"APPROVED")} className="text-success hover:underline">Approve</button>
                  <button onClick={()=>setVendorStatus(v.id,"SUSPENDED")} className="text-danger hover:underline">Suspend</button>
                </div>
              </div>
            ))}
            {vendors.length===0 && <p className="text-sm text-foreground-muted">No vendors.</p>}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-display text-xl font-bold">Coupons</h2>
          {msg && <p className="text-sm text-foreground-muted mt-1">{msg}</p>}
          <form onSubmit={createCoupon} className="mt-3 grid grid-cols-2 gap-2">
            <input placeholder="CODE" value={couponForm.code} onChange={e=>setCouponForm({...couponForm,code:e.target.value})} className="rounded-md border border-border px-3 py-2" required />
            <select value={couponForm.type} onChange={e=>setCouponForm({...couponForm,type:e.target.value})} className="rounded-md border border-border px-3 py-2"><option value="PERCENT">Percent</option><option value="FIXED">Fixed</option></select>
            <input placeholder="Value" type="number" value={couponForm.value} onChange={e=>setCouponForm({...couponForm,value:e.target.value})} className="rounded-md border border-border px-3 py-2" required />
            <input placeholder="Min order (opt)" type="number" value={couponForm.minOrderAmount} onChange={e=>setCouponForm({...couponForm,minOrderAmount:e.target.value})} className="rounded-md border border-border px-3 py-2" />
            <button className="col-span-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary-hover">Create coupon</button>
          </form>
          <div className="mt-3 space-y-2 max-h-48 overflow-auto">
            {coupons.map(c => <div key={c.id} className="flex items-center justify-between text-sm border border-border rounded p-2"><span><b>{c.code}</b> · {c.type} {String(c.value)} {c.isActive?"(active)":"(inactive)"}</span><button onClick={()=>removeCoupon(c.id)} className="text-danger hover:underline">Delete</button></div>)}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="font-display text-xl font-bold">Recent orders</h2>
        <div className="mt-3 overflow-auto">
          <table className="w-full text-sm"><thead><tr className="text-left border-b border-border"><th className="py-2">Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
          <tbody>
            {orders.slice(0,30).map(o => <tr key={o.id} className="border-b border-border last:border-0"><td className="py-2 font-mono text-xs">{o.id.slice(0,8)}</td><td>{o.customer?.name || o.customerId}</td><td>{o.status}</td><td>{formatMoney(o.total,o.currency)}</td><td>{new Date(o.createdAt).toLocaleDateString()}</td></tr>)}
          </tbody></table>
          {orders.length===0 && <p className="text-sm text-foreground-muted mt-2">No orders.</p>}
        </div>
      </section>
    </div>
  );
}
