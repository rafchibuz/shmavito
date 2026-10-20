"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, Check, CheckCircle2, Clock3, Heart, LoaderCircle, MessageCircle, Plus, Shield, XCircle } from "lucide-react";
import { ReactNode, useEffect, useMemo, useState } from "react";

type SessionUser = {
  login: string;
  displayName: string;
  avatarUrl: string | null;
  role: "USER" | "MODERATOR" | "FOUNDER";
};

type Submission = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "DELETED";
  rejectionReason: string | null;
  rawSnapshot: unknown;
  createdAt: string;
  category: { name: string; slug: string };
  listing: { id: string; state: string; publishedAt: string; _count: { likes: number; views: number } } | null;
};

type NotificationItem = {
  id: string;
  type: string;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
};

const roleNames = { USER: "Участник сообщества", MODERATOR: "Модератор проекта", FOUNDER: "Основатель проекта" } as const;
const fallbackImages: Record<string, string> = {
  cars: "/images/car-lineup.png",
  parts: "/images/bmw-wheel.png",
  "other-vehicles": "/images/motorcycle.svg",
  "real-estate": "/images/garage.svg",
  misc: "/images/racing-suit.png",
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function timeAgo(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "только что";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч. назад`;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(value));
}

function submissionTitle(submission: Submission) {
  const title = asRecord(submission.rawSnapshot).title;
  return typeof title === "string" && title.trim() ? title : "Объявление Avito";
}

function submissionImage(submission: Submission) {
  const images = asRecord(submission.rawSnapshot).imageUrls;
  return Array.isArray(images) && typeof images[0] === "string" ? images[0] : fallbackImages[submission.category.slug] || "/images/car-lineup.png";
}

export function ProfileDashboard() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | Submission["status"]>("ALL");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/me", { cache: "no-store" }),
      fetch("/api/submissions", { cache: "no-store" }),
      fetch("/api/notifications", { cache: "no-store" }),
    ]).then(async ([meResponse, submissionsResponse, notificationsResponse]) => {
      if (meResponse.status === 401) { if (active) setUser(null); return; }
      if (!meResponse.ok || !submissionsResponse.ok || !notificationsResponse.ok) throw new Error("Не удалось загрузить личный кабинет.");
      const [mePayload, submissionsPayload, notificationsPayload] = await Promise.all([
        meResponse.json() as Promise<{ user: SessionUser }>,
        submissionsResponse.json() as Promise<{ submissions: Submission[] }>,
        notificationsResponse.json() as Promise<{ notifications: NotificationItem[] }>,
      ]);
      if (!active) return;
      setUser(mePayload.user);
      setSubmissions(submissionsPayload.submissions);
      setNotifications(notificationsPayload.notifications);
    }).catch((loadError) => {
      if (active) { setUser(null); setError(loadError instanceof Error ? loadError.message : "Ошибка загрузки."); }
    });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => filter === "ALL" ? submissions : submissions.filter((item) => item.status === filter), [filter, submissions]);
  const stats = useMemo(() => submissions.reduce((total, submission) => ({
    approved: total.approved + Number(submission.status === "APPROVED"),
    likes: total.likes + (submission.listing?._count.likes || 0),
    views: total.views + (submission.listing?._count.views || 0),
  }), { approved: 0, likes: 0, views: 0 }), [submissions]);
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  async function markAllRead() {
    const response = await fetch("/api/notifications", { method: "PUT" });
    if (!response.ok) return;
    const now = new Date().toISOString();
    setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || now })));
    window.dispatchEvent(new Event("shmavito:notifications-read"));
  }

  if (user === undefined) return <main className="shell profile-page profile-loading"><LoaderCircle className="spin" /><p>Загружаем личный кабинет…</p></main>;
  if (!user) return <main className="shell profile-page"><section className="profile-auth-empty"><Shield /><h1>Войдите через Twitch</h1><p>{error || "Личный кабинет хранит ваши предложения, решения модерации и уведомления."}</p><a className="button button-primary" href="/api/auth/twitch/start?returnTo=/profile">Войти через Twitch</a></section></main>;

  return <main className="shell profile-page">
    <section className="profile-hero">
      {user.avatarUrl ? <Image className="large-avatar profile-avatar-image" src={user.avatarUrl} alt="" width={90} height={90} unoptimized /> : <div className="large-avatar">{user.displayName.slice(0, 1).toUpperCase()}</div>}
      <div><span className="section-kicker">TWITCH PROFILE</span><h1>{user.displayName}</h1><p>{roleNames[user.role]} • @{user.login}</p></div>
      <Link href="/submit" className="button button-primary"><Plus size={17} /> Новое предложение</Link>
    </section>
    <div className="profile-stats"><div><strong>{submissions.length}</strong><span>предложений</span></div><div><strong>{stats.approved}</strong><span>опубликовано</span></div><div><strong>{stats.likes.toLocaleString("ru-RU")}</strong><span>получено лайков</span></div><div><strong>{stats.views.toLocaleString("ru-RU")}</strong><span>просмотров</span></div></div>
    <div className="profile-grid">
      <section><div className="block-heading"><div><span className="section-kicker">ИСТОРИЯ</span><h2>Мои предложения</h2></div><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="ALL">Все статусы</option><option value="PENDING">На проверке</option><option value="APPROVED">Опубликовано</option><option value="REJECTED">Отклонено</option></select></div>
        {filtered.length ? <div className="submission-list">{filtered.map((item) => { const image = submissionImage(item); return <article key={item.id}><div className="submission-image"><Image src={image} alt="" fill sizes="105px" unoptimized={image.startsWith("https://")} /></div><div className="submission-main"><span>{item.category.name}</span><h3>{submissionTitle(item)}</h3><small>{timeAgo(item.createdAt)} • #{item.id.slice(-6).toUpperCase()}</small>{item.status === "REJECTED" && <p>Причина: {item.rejectionReason || "не указана"}</p>}</div><Status status={item.status} /></article>; })}</div> : <ProfileEmpty title={submissions.length ? "Нет заявок с таким статусом" : "Вы ещё ничего не предложили"} text={submissions.length ? "Выберите другой фильтр." : "Найдите интересное объявление Avito и отправьте его на модерацию."} />}
      </section>
      <aside className="notifications"><div className="block-heading"><div><span className="section-kicker">ЦЕНТР</span><h2>Уведомления {unreadCount > 0 && <b className="notification-count">{unreadCount}</b>}</h2></div>{unreadCount ? <button onClick={markAllRead}><Check size={14} /> Прочитать все</button> : <Bell size={20} />}</div>{notifications.length ? notifications.map((item) => <Notification key={item.id} item={item} submissions={submissions} />) : <ProfileEmpty title="Пока тихо" text="Решения модерации появятся здесь." />}</aside>
    </div>
  </main>;
}

function Status({ status }: { status: Submission["status"] }) {
  if (status === "APPROVED") return <div className="status approved"><CheckCircle2 /> Опубликовано</div>;
  if (status === "PENDING") return <div className="status pending"><Clock3 /> На проверке</div>;
  return <div className="status rejected"><XCircle /> Отклонено</div>;
}

function Notification({ item, submissions }: { item: NotificationItem; submissions: Submission[] }) {
  const payload = asRecord(item.payload);
  const submission = submissions.find((value) => value.id === payload.submissionId);
  const title = submission ? submissionTitle(submission) : "Ваше предложение";
  const approved = item.type === "submission.approved";
  const rejected = item.type === "submission.rejected";
  const icon: ReactNode = approved ? <CheckCircle2 /> : rejected ? <XCircle /> : item.type.includes("comment") ? <MessageCircle /> : item.type.includes("like") ? <Heart /> : <Bell />;
  return <div className={`notification-item ${!item.readAt ? "unread" : ""}`}><span>{icon}</span><div><strong>{approved ? "Заявка опубликована" : rejected ? "Заявка отклонена" : "Новое событие"}</strong><p>«{title}»{rejected && typeof payload.reason === "string" ? ` — ${payload.reason}` : approved ? " уже в каталоге." : ""}</p><small>{timeAgo(item.createdAt)}</small></div></div>;
}

function ProfileEmpty({ title, text }: { title: string; text: string }) {
  return <div className="profile-empty"><Bell /><strong>{title}</strong><p>{text}</p></div>;
}
