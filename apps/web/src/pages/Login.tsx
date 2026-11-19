import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try { await login(email, password); nav("/"); }
    catch (e: any) { setErr(e.message || "Login failed"); }
    finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-3xl font-bold">Welcome back</h1>
      <p className="mt-2 text-foreground-muted">Sign in to your Bazaar account.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-lg border border-border bg-surface p-6 shadow-card">
        {err && <div className="rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</div>}
        <div>
          <label className="text-sm font-medium">Email</label>
          <input className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm font-medium">Password</label>
          <input className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">{loading ? "Signing in..." : "Sign in"}</button>
        <p className="text-sm text-foreground-muted">No account? <Link to="/register" className="text-primary font-medium hover:underline">Create one</Link></p>
      </form>
    </div>
  );
}
