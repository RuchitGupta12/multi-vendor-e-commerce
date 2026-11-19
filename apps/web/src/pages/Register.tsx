import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "CUSTOMER" as "CUSTOMER" | "VENDOR", storeName: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      await register({ ...form, storeName: form.role === "VENDOR" ? form.storeName : undefined });
      nav(form.role === "VENDOR" ? "/vendor" : "/");
    } catch (e: any) { setErr(e.message || "Registration failed"); }
    finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-3xl font-bold">Create your account</h1>
      <p className="mt-2 text-foreground-muted">Join as a customer or start selling as a vendor.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-lg border border-border bg-surface p-6 shadow-card">
        {err && <div className="rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</div>}
        <div>
          <label className="text-sm font-medium">Account type</label>
          <select className="mt-1 w-full rounded-md border border-border px-3 py-2" value={form.role} onChange={e=>setForm({...form, role: e.target.value as any})}>
            <option value="CUSTOMER">Customer</option>
            <option value="VENDOR">Vendor</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Full name</label>
          <input className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} required />
        </div>
        {form.role === "VENDOR" && (
          <div>
            <label className="text-sm font-medium">Store name</label>
            <input className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={form.storeName} onChange={e=>setForm({...form, storeName: e.target.value})} required />
          </div>
        )}
        <div>
          <label className="text-sm font-medium">Email</label>
          <input className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" type="email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} required />
        </div>
        <div>
          <label className="text-sm font-medium">Password (min 8 chars)</label>
          <input className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" type="password" minLength={8} value={form.password} onChange={e=>setForm({...form, password: e.target.value})} required />
        </div>
        <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">{loading ? "Creating..." : "Create account"}</button>
        <p className="text-sm text-foreground-muted">Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link></p>
      </form>
    </div>
  );
}
