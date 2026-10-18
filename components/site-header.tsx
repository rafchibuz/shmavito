"use client";

import Link from "next/link";
import { Bell, Menu, Plus, Shield, X } from "lucide-react";
import { useState } from "react";
import { AuthButton } from "@/components/auth-button";

export function SiteHeader({ active = "catalog" }: { active?: "catalog" | "submit" | "profile" | "admin" }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Шмавито, на главную">
          <span className="brand-mark">Ш</span>
          <span>ШМАВИТО</span>
          <small>STEEL COMMUNITY</small>
        </Link>

        <nav className={`main-nav ${open ? "is-open" : ""}`} aria-label="Основная навигация">
          <Link className={active === "catalog" ? "active" : ""} href="/">Каталог</Link>
          <Link className={active === "profile" ? "active" : ""} href="/profile">Мои предложения</Link>
          <Link className={active === "admin" ? "active" : ""} href="/admin"><Shield size={15} /> Панель</Link>
          <button className="mobile-close" onClick={() => setOpen(false)} aria-label="Закрыть меню"><X /></button>
        </nav>

        <div className="header-actions">
          <Link href="/profile" className="icon-button notification-button" aria-label="Уведомления">
            <Bell size={18} />
            <span>2</span>
          </Link>
          <Link href="/submit" className="button button-primary compact"><Plus size={17} /> Предложить</Link>
          <AuthButton />
          <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Открыть меню"><Menu /></button>
        </div>
      </div>
    </header>
  );
}
