import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground font-display font-bold">B</div>
            <div>
              <p className="font-display text-lg font-bold leading-none">Bazaar</p>
              <p className="text-xs text-foreground-muted">Marketplace</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-4 text-sm font-medium md:flex">
            <NavLink to="/products" className={({isActive}) => isActive ? "text-primary" : "text-foreground-muted hover:text-foreground"}>Browse</NavLink>
            {user && <NavLink to="/orders" className={({isActive}) => isActive ? "text-primary" : "text-foreground-muted hover:text-foreground"}>Orders</NavLink>}
            {user?.role === "VENDOR" && <NavLink to="/vendor" className={({isActive}) => isActive ? "text-primary" : "text-foreground-muted hover:text-foreground"}>Vendor</NavLink>}
            {user?.role === "ADMIN" && <NavLink to="/admin" className={({isActive}) => isActive ? "text-primary" : "text-foreground-muted hover:text-foreground"}>Admin</NavLink>}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/cart" className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-alt">Cart</Link>
            {!user ? (
              <>
                <Link to="/login" className="rounded-md px-3 py-2 text-sm font-medium text-foreground-muted hover:text-foreground">Sign in</Link>
                <Link to="/register" className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">Sign up</Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden text-sm text-foreground-muted sm:inline">{user.name}</span>
                <button onClick={async () => { await logout(); nav("/"); }} className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface-alt">Logout</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-16 border-t border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-foreground-muted sm:px-6 flex flex-col sm:flex-row gap-2 justify-between">
          <p>© {new Date().getFullYear()} Bazaar — Multi-vendor marketplace</p>
          <p>Customer · Vendor · Admin · Secure checkout</p>
        </div>
      </footer>
    </div>
  );
}
