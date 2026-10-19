"use client";

import Image from "next/image";
import { Check, ChevronRight, CircleAlert, Clock3, Eye, FileClock, Flag, LayoutDashboard, ListFilter, MessageSquare, Search, Settings, Shield, Tags, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";

type QueueItem = { id: string; title: string; description: string; author: string; category: string; categoryId: string; time: string; image: string };

const categoryImages: Record<string, string> = {
  cars: "/images/car-lineup.png",
  parts: "/images/bmw-wheel.png",
  "other-vehicles": "/images/motorcycle.svg",
  "real-estate": "/images/garage.svg",
  misc: "/images/racing-suit.png",
};

function timeAgo(value: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} мин.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч.`;
  return `${Math.floor(hours / 24)} дн.`;
}

export default function AdminPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [toast, setToast] = useState("");
  const [mode, setMode] = useState<"loading" | "live" | "auth" | "error">("loading");
  const [rejecting, setRejecting] = useState<QueueItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    fetch("/api/admin/submissions", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) { setMode("auth"); return null; }
        if (!response.ok) throw new Error("queue unavailable");
        return response.json() as Promise<{ submissions: Array<{
          id: string;
          createdAt: string;
          rawSnapshot: unknown;
          author: { displayName: string; login: string };
          category: { id: string; name: string; slug: string };
        }> }>;
      })
      .then((payload) => {
        if (!payload) return;
        setQueue(payload.submissions.map((submission) => {
          const snapshot = submission.rawSnapshot && typeof submission.rawSnapshot === "object" && !Array.isArray(submission.rawSnapshot)
            ? submission.rawSnapshot as Record<string, unknown>
            : {};
          return {
            id: submission.id,
            title: typeof snapshot.title === "string" ? snapshot.title : "Новое объявление Avito",
            description: typeof snapshot.description === "string" ? snapshot.description : "",
            author: submission.author.displayName || submission.author.login,
            category: submission.category.name,
            categoryId: submission.category.id,
            time: timeAgo(submission.createdAt),
            image: categoryImages[submission.category.slug] || "/images/car-lineup.png",
          };
        }));
        setMode("live");
      })
      .catch(() => setMode("error"));
  }, []);

  async function decide(item: QueueItem, decision: "APPROVED" | "REJECTED", reason?: string) {
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/admin/submissions/${encodeURIComponent(item.id)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          rejectionReason: reason,
          categoryId: item.categoryId,
          title: item.title,
          description: item.description,
        }),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || "Не удалось обработать заявку.");
      setQueue((items) => items.filter((queueItem) => queueItem.id !== item.id));
      setRejecting(null);
      setRejectionReason("");
      setToast(`Заявка: ${decision === "APPROVED" ? "одобрена" : "отклонена"}`);
      window.setTimeout(() => setToast(""), 2200);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Ошибка модерации");
    } finally {
      setBusyId("");
    }
  }
  return (
    <div className="site-page interior admin-screen"><SiteHeader active="admin" /><div className="admin-shell">
      <aside className="admin-sidebar"><div><span>УПРАВЛЕНИЕ</span><a className="active"><LayoutDashboard /> Обзор</a><a><FileClock /> Модерация <b>{queue.length}</b></a><a><Tags /> Категории</a><a><MessageSquare /> Комментарии</a><a><Flag /> Жалобы <b>4</b></a></div><div><span>СИСТЕМА</span><a><Users /> Пользователи</a><a><Shield /> Журнал действий</a><a><Settings /> Настройки</a></div><small>{mode === "live" ? "DATABASE CONNECTED" : "LOCAL MODE"} • v0.2.0</small></aside>
      <main className="admin-main"><div className="admin-title"><div><span className="section-kicker">ПАНЕЛЬ УПРАВЛЕНИЯ</span><h1>Добрый вечер, Раф</h1><p>Вот что происходит в ШМАВИТО прямо сейчас.</p></div><div className="admin-search"><Search /><input placeholder="Поиск по панели" /><kbd>⌘ K</kbd></div></div>
      <div className="admin-metrics"><Metric icon={<Clock3 />} value={queue.length.toString()} label="ждут проверки" detail="среднее: 24 мин" accent="amber" /><Metric icon={<Eye />} value="1 284" label="опубликовано" detail="+18 за неделю" accent="green" /><Metric icon={<Flag />} value="4" label="новые жалобы" detail="2 на комментарии" accent="red" /><Metric icon={<CircleAlert />} value="7" label="ошибок проверки" detail="за последние сутки" accent="blue" /></div>
      <section className="admin-card"><div className="admin-card-head"><div><span className="section-kicker">ОЧЕРЕДЬ</span><h2>Новые предложения</h2></div><button className="filter-button"><ListFilter /> Фильтры</button></div>{mode === "auth" ? <div className="queue-empty"><Shield /><h3>Нужен вход модератора</h3><p>Войдите через Twitch. Доступ определяется по вашему Twitch ID.</p><a className="button button-primary" href="/api/auth/twitch/start?returnTo=/admin">Войти через Twitch</a></div> : mode === "loading" ? <div className="queue-empty"><Clock3 /><h3>Загружаем очередь</h3><p>Проверяем новые предложения.</p></div> : mode === "error" ? <div className="queue-empty"><CircleAlert /><h3>Очередь недоступна</h3><p>Проверьте соединение с базой и обновите страницу.</p></div> : queue.length ? <div className="queue-list">{queue.map((item) => <article key={item.id}><div className="queue-image"><Image src={item.image} alt="" fill sizes="110px" /></div><div className="queue-id">#{item.id.slice(-6).toUpperCase()}</div><div className="queue-info"><span>{item.category}</span><h3>{item.title}</h3><p>от <b>{item.author}</b> • {item.time} назад</p></div><div className="queue-actions"><button className="approve" disabled={busyId === item.id} onClick={() => decide(item, "APPROVED")}><Check /> Одобрить</button><button className="reject" disabled={busyId === item.id} onClick={() => setRejecting(item)}><X /> Отклонить</button><button aria-label="Открыть"><ChevronRight /></button></div></article>)}</div> : <div className="queue-empty"><Check /><h3>Очередь разобрана</h3><p>Новых заявок пока нет.</p></div>}</section>
      <div className="admin-bottom"><section className="admin-card"><div className="admin-card-head"><div><span className="section-kicker">АКТИВНОСТЬ</span><h2>Последние действия</h2></div></div><ul className="audit-list"><li><span className="audit-icon green"><Check /></span><p><b>moderator_1</b> одобрил заявку #1284<small>12 минут назад</small></p></li><li><span className="audit-icon red"><X /></span><p><b>rafchibiskus</b> заблокировал пользователя spammer88<small>48 минут назад</small></p></li><li><span className="audit-icon blue"><Tags /></span><p><b>moderator_2</b> изменил категорию объявления #1281<small>1 час назад</small></p></li></ul></section><section className="admin-card settings-preview"><span className="section-kicker">БЫСТРЫЕ НАСТРОЙКИ</span><h2>Лимиты предложений</h2><label><span>Активных заявок</span><input value="3" readOnly /></label><label><span>Интервал, секунд</span><input value="60" readOnly /></label><button className="button button-ghost">Открыть настройки</button></section></div>
      </main></div>{rejecting && <div className="moderation-backdrop" role="presentation"><section className="moderation-modal" role="dialog" aria-modal="true" aria-label="Причина отклонения"><button className="drawer-close" onClick={() => setRejecting(null)} aria-label="Закрыть"><X /></button><span className="section-kicker">ОТКЛОНЕНИЕ ЗАЯВКИ</span><h2>{rejecting.title}</h2><p>Автор увидит эту причину в личном кабинете.</p><label className="field"><span>Причина <b>*</b></span><textarea autoFocus rows={4} maxLength={500} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Например: ссылка не открывается или товар не подходит для эфира" /></label><div className="moderation-modal-actions"><button className="button button-ghost" onClick={() => setRejecting(null)}>Отмена</button><button className="button button-primary" disabled={!rejectionReason.trim() || busyId === rejecting.id} onClick={() => decide(rejecting, "REJECTED", rejectionReason.trim())}>Отклонить заявку</button></div></section></div>}{toast && <div className="admin-toast"><Check /> {toast}</div>}</div>
  );
}

function Metric({ icon, value, label, detail, accent }: { icon: React.ReactNode; value: string; label: string; detail: string; accent: string }) { return <div className={`metric ${accent}`}><span>{icon}</span><div><strong>{value}</strong><p>{label}</p><small>{detail}</small></div></div>; }
