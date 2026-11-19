import React, { useEffect, useState } from "react";
import { get, post, patch, del } from "../lib/api";
import { formatMoney } from "../components/ProductCard";
import { useAuth } from "../lib/auth";

export default function Vendor() {
  const { user } = useAuth();
  const [vendor, setVendor] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", description: "", price: "", stock: "0", status: "DRAFT", categoryId: "", imageUrl: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    if (!user) return;
    try { const v = await get<{vendor:any}>("/vendors/me"); setVendor(v.vendor); } catch (e:any) { setVendor(null); }
    try { const p = await get<{products:any[]}>("/products?limit=50&status=DRAFT"); /* vendor's own: easier fetch all active/inactive via separate call not available, so fetch active */ } catch {}
    try { const p = await get<{products:any[]}>(`/products?limit=50`); setProducts(p.products||[]); } catch {}
    try { const it = await get<{items:any[]}>("/vendors/me/orders/items"); setItems(it.items||[]); } catch {}
  }
  useEffect(() => { load(); }, [user]);

  async function createProduct(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    try {
      const created = await post<{product:any}>("/products", { title: form.title, description: form.description, price: parseFloat(form.price), stock: parseInt(form.stock||"0",10), status: form.status, categoryId: form.categoryId || undefined });
      if (form.imageUrl) await post(`/products/${created.product.id}/images`, { url: form.imageUrl });
      setMsg("Product created"); setForm({ title: "", description: "", price: "", stock: "0", status: "DRAFT", categoryId: "", imageUrl: "" }); load();
    } catch (e:any) { setMsg(e.message || "Failed"); }
  }
  async function setStatus(id: string, status: string) { await patch(`/products/${id}`, { status }); load(); }
  async function remove(id: string) { if (!confirm("Delete product?")) return; await del(`/products/${id}`); load(); }
  async function fulfill(itemId: string, status: string) { await patch(`/vendors/me/orders/${itemId}/status`, { status }); load(); }

  if (!user) return <div className="mx-auto max-w-5xl px-4 py-12">Please sign in.</div>;
  if (user.role !== "VENDOR" && user.role !== "ADMIN") return <div className="mx-auto max-w-5xl px-4 py-12">Vendor access required. <button onClick={async()=>{await post('/vendors/apply',{storeName: user.name+"'s Store"}); window.location.reload();}} className="text-primary underline">Apply as vendor</button></div>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Vendor dashboard</h1>
        {vendor ? <p className="text-foreground-muted">Store: <span className="font-medium text-foreground">{vendor.storeName}</span> · Status: <span className={`font-semibold ${vendor.status==="APPROVED"?"text-success":"text-warning"}`}>{vendor.status}</span></p> : <p className="text-foreground-muted">No vendor profile found.</p>}
        {vendor && vendor.status !== "APPROVED" && <p className="mt-2 text-sm text-warning">Your vendor profile must be approved by admin before you can list products.</p>}
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={createProduct} className="rounded-lg border border-border bg-surface p-5 space-y-3">
          <h2 className="font-display text-xl font-bold">Add product</h2>
          {msg && <p className="text-sm text-foreground-muted">{msg}</p>}
          <input placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="w-full rounded-md border border-border px-3 py-2" required />
          <textarea placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="w-full rounded-md border border-border px-3 py-2" rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Price (INR)" type="number" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} className="rounded-md border border-border px-3 py-2" required />
            <input placeholder="Stock" type="number" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})} className="rounded-md border border-border px-3 py-2" />
          </div>
          <input placeholder="Image URL (optional)" value={form.imageUrl} onChange={e=>setForm({...form,imageUrl:e.target.value})} className="w-full rounded-md border border-border px-3 py-2" />
          <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full rounded-md border border-border px-3 py-2"><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
          <button className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary-hover">Create product</button>
        </form>

        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-display text-xl font-bold">Your products (recent)</h2>
          <div className="mt-3 space-y-3 max-h-[480px] overflow-auto pr-1">
            {products.filter(p => !vendor || p.vendor?.id === vendor.id || user.role === 'ADMIN').slice(0,20).map((p) => (
              <div key={p.id} className="rounded-md border border-border p-3">
                <div className="flex justify-between gap-2"><p className="font-medium">{p.title}</p><span className="text-xs rounded-full bg-surface-alt px-2 py-1">{p.status}</span></div>
                <p className="text-sm text-foreground-muted">{formatMoney(p.price, p.currency)} · Stock {p.stock}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  <button onClick={()=>setStatus(p.id, "ACTIVE")} className="text-primary hover:underline">Activate</button>
                  <button onClick={()=>setStatus(p.id, "INACTIVE")} className="text-warning hover:underline">Deactivate</button>
                  <button onClick={()=>remove(p.id)} className="text-danger hover:underline">Delete</button>
                </div>
              </div>
            ))}
            {products.length === 0 && <p className="text-sm text-foreground-muted">No products loaded.</p>}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="font-display text-xl font-bold">Order items to fulfill</h2>
        <div className="mt-3 space-y-3">
          {items.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <div>
                <p className="font-medium">{it.product?.title} × {it.quantity}</p>
                <p className="text-sm text-foreground-muted">Order #{it.order?.id?.slice(0,8)} · {it.order?.customer?.name} · Status: {it.fulfillmentStatus}</p>
              </div>
              <div className="flex gap-2 text-sm">
                {["PACKED","SHIPPED","DELIVERED"].map(s => <button key={s} onClick={()=>fulfill(it.id, s)} className="rounded border border-border px-2 py-1 hover:bg-surface-alt">{s}</button>)}
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-foreground-muted">No order items yet.</p>}
        </div>
      </section>
    </div>
  );
}
