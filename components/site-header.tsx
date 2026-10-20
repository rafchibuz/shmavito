"use client";

import Link from "next/link";
import { Bell, Menu, Plus, Shield, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthButton } from "@/components/auth-button";

export function SiteHeader({ active = "catalog" }: { active?: "catalog" | "submit" | "profile" | "admin" }) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/notifications", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ notifications: Array<{ readAt: string | null }> }> : null)
      .then((payload) => { if (active && payload) setUnreadCount(payload.notifications.filter((item) => !item.readAt).length); })
      .catch(() => undefined);
    const markRead = () => setUnreadCount(0);
    window.addEventListener("shmavito:notifications-read", markRead);
    return () => { active = false; window.removeEventListener("shmavito:notifications-read", markRead); };
  }, []);

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
            {unreadCount > 0 && <span>{unreadCount}</span>}
          </Link>
          <Link href="/submit" className="button button-primary compact"><Plus size={17} /> Предложить</Link>
          <AuthButton />
          <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Открыть меню"><Menu /></button>
        </div>
      </div>
    </header>
  );
}
