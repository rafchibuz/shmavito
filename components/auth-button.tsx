"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

type SessionUser = {
  login: string;
  displayName: string;
  avatarUrl: string | null;
  role: "USER" | "MODERATOR" | "FOUNDER";
};

const roleNames = { USER: "участник", MODERATOR: "модератор", FOUNDER: "основатель" } as const;

export function AuthButton() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetch("/api/me", { cache: "no-store" })
      .then(async (response) => response.ok ? (await response.json()).user as SessionUser : null)
      .then((value) => { if (active) setUser(value); })
      .catch(() => { if (active) setUser(null); });
    return () => { active = false; };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.replace("/");
    router.refresh();
  }

  if (user === undefined) {
    return <span className="profile-chip auth-loading" aria-label="Проверяем вход"><span className="avatar" /></span>;
  }

  if (!user) {
    return <a className="button button-ghost compact twitch-login" href="/api/auth/twitch/start"><LogIn size={16} /> Войти через Twitch</a>;
  }

  return (
    <div className="session-actions">
      <Link href="/profile" className="profile-chip">
        {user.avatarUrl
          ? <Image className="avatar" src={user.avatarUrl} alt="" width={34} height={34} unoptimized />
          : <span className="avatar avatar-founder">{user.displayName.slice(0, 1).toUpperCase()}</span>}
        <span><b>{user.displayName}</b><small>{roleNames[user.role]}</small></span>
      </Link>
      <button className="session-logout" onClick={logout} aria-label="Выйти"><LogOut size={15} /></button>
    </div>
  );
}
