"use client";

import Image from "next/image";
import {
  Check,
  CircleAlert,
  Clock3,
  Eye,
  FileClock,
  Flag,
  LayoutDashboard,
  MessageSquare,
  Save,
  Search,
  Settings,
  Shield,
  Tags,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";

type Section = "overview" | "moderation" | "categories" | "comments" | "reports" | "users" | "audit" | "settings";
type QueueItem = { id: string; title: string; description: string; author: string; category: string; categoryId: string; time: string; image: string };
type ApiCategory = { id: string; name: string; slug: string; position: number; isVisible: boolean };
type ApiUser = { id: string; login: string; displayName: string; avatarUrl: string | null; role: "USER" | "MODERATOR" | "FOUNDER"; status: "ACTIVE" | "BLOCKED"; createdAt: string; _count: { submissions: number; comments: number } };
type AuditItem = { id: string; action: string; targetType: string; targetId: string; createdAt: string; actor: { login: string; displayName: string } | null };
type ApiComment = { id: string; body: string; createdAt: string; author: { login: string; displayName: string; avatarUrl: string | null }; listing: { id: string; title: string } };

const sectionMeta: Record<Section, { kicker: string; title: string; description: string }> = {
  overview: { kicker: "ПАНЕЛЬ УПРАВЛЕНИЯ", title: "Добрый вечер, Раф", description: "Вот что происходит в ШМАВИТО прямо сейчас." },
  moderation: { kicker: "МОДЕРАЦИЯ", title: "Очередь предложений", description: "Проверяйте данные, исправляйте категорию и принимайте решение." },
  categories: { kicker: "СТРУКТУРА КАТАЛОГА", title: "Категории", description: "Добавляйте, переименовывайте и скрывайте разделы каталога." },
  comments: { kicker: "СООБЩЕСТВО", title: "Комментарии", description: "Последние обсуждения и инструменты модерации." },
  reports: { kicker: "БЕЗОПАСНОСТЬ", title: "Жалобы", description: "Очередь сигналов от участников сообщества." },
  users: { kicker: "ДОСТУП", title: "Пользователи", description: "Роли привязаны к Twitch ID, а выдаются по найденному нику." },
  audit: { kicker: "СИСТЕМА", title: "Журнал действий", description: "Неизменяемая история критичных действий модераторов." },
  settings: { kicker: "СИСТЕМА", title: "Настройки", description: "Рабочие лимиты и параметры предложки." },
};

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
  return hours < 24 ? `${hours} ч.` : `${Math.floor(hours / 24)} дн.`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || "Не удалось выполнить запрос.");
  return payload;
}

export function AdminDashboard() {
  const [section, setSection] = useState<Section>("overview");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueMode, setQueueMode] = useState<"loading" | "live" | "auth" | "error">("loading");
  const [toast, setToast] = useState("");
  const meta = sectionMeta[section];

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/submissions", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) { setQueueMode("auth"); return; }
      const payload = await response.json() as { submissions: Array<{ id: string; createdAt: string; rawSnapshot: unknown; author: { displayName: string; login: string }; category: { id: string; name: string; slug: string } }> };
      if (!response.ok) throw new Error("queue unavailable");
      setQueue(payload.submissions.map((submission) => {
        const snapshot = submission.rawSnapshot && typeof submission.rawSnapshot === "object" && !Array.isArray(submission.rawSnapshot) ? submission.rawSnapshot as Record<string, unknown> : {};
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
      setQueueMode("live");
    } catch { setQueueMode("error"); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadQueue(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadQueue]);

  return (
    <div className="site-page interior admin-screen">
      <SiteHeader active="admin" />
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <AdminNav section={section} queueCount={queue.length} onSelect={setSection} />
          <small>{queueMode === "live" ? "DATABASE CONNECTED" : "LOCAL MODE"} • v0.3.0</small>
        </aside>
        <main className="admin-main">
          <div className="admin-title">
            <div><span className="section-kicker">{meta.kicker}</span><h1>{meta.title}</h1><p>{meta.description}</p></div>
            <div className="admin-search"><Search /><input placeholder="Поиск по панели" /><kbd>⌘ K</kbd></div>
          </div>

          {section === "overview" && <Overview queue={queue} queueMode={queueMode} notify={notify} onQueueChange={setQueue} onOpenQueue={() => setSection("moderation")} />}
          {section === "moderation" && <QueuePanel queue={queue} mode={queueMode} notify={notify} onQueueChange={setQueue} />}
          {section === "categories" && <CategoriesPanel notify={notify} />}
          {section === "comments" && <CommentsPanel notify={notify} />}
          {section === "reports" && <ReportsPanel />}
          {section === "users" && <UsersPanel notify={notify} />}
          {section === "audit" && <AuditPanel />}
          {section === "settings" && <SettingsPanel notify={notify} />}
        </main>
      </div>
      {toast && <div className="admin-toast"><Check /> {toast}</div>}
    </div>
  );
}

function AdminNav({ section, queueCount, onSelect }: { section: Section; queueCount: number; onSelect: (section: Section) => void }) {
  const item = (id: Section, icon: ReactNode, label: string, count?: number) => <button className={section === id ? "active" : ""} onClick={() => onSelect(id)}>{icon}{label}{count !== undefined && <b>{count}</b>}</button>;
  return <div className="admin-nav-groups"><div><span>УПРАВЛЕНИЕ</span>{item("overview", <LayoutDashboard />, "Обзор")}{item("moderation", <FileClock />, "Модерация", queueCount)}{item("categories", <Tags />, "Категории")}{item("comments", <MessageSquare />, "Комментарии")}{item("reports", <Flag />, "Жалобы", 0)}</div><div><span>СИСТЕМА</span>{item("users", <Users />, "Пользователи")}{item("audit", <Shield />, "Журнал действий")}{item("settings", <Settings />, "Настройки")}</div></div>;
}

function Overview({ queue, queueMode, notify, onQueueChange, onOpenQueue }: { queue: QueueItem[]; queueMode: "loading" | "live" | "auth" | "error"; notify: (message: string) => void; onQueueChange: (items: QueueItem[]) => void; onOpenQueue: () => void }) {
  return <><div className="admin-metrics"><Metric icon={<Clock3 />} value={queue.length.toString()} label="ждут проверки" detail="живая очередь" accent="amber" /><Metric icon={<Eye />} value="—" label="опубликовано" detail="из базы каталога" accent="green" /><Metric icon={<Flag />} value="0" label="новые жалобы" detail="очередь чиста" accent="red" /><Metric icon={<CircleAlert />} value="0" label="ошибок проверки" detail="за последние сутки" accent="blue" /></div><QueuePanel queue={queue} displayLimit={5} mode={queueMode} notify={notify} onQueueChange={onQueueChange} /><div className="admin-section-actions"><button className="button button-ghost" onClick={onOpenQueue}>Открыть всю модерацию</button></div></>;
}

function QueuePanel({ queue, mode, notify, onQueueChange, displayLimit }: { queue: QueueItem[]; mode: "loading" | "live" | "auth" | "error"; notify: (message: string) => void; onQueueChange: (items: QueueItem[]) => void; displayLimit?: number }) {
  const [rejecting, setRejecting] = useState<QueueItem | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState("");
  const [categories, setCategories] = useState<Array<Pick<ApiCategory, "id" | "name">>>([]);
  useEffect(() => {
    api<{ categories: Array<Pick<ApiCategory, "id" | "name">> }>("/api/categories")
      .then((value) => setCategories(value.categories))
      .catch(() => undefined);
  }, []);
  function changeCategory(itemId: string, categoryId: string) {
    const category = categories.find((value) => value.id === categoryId);
    if (!category) return;
    onQueueChange(queue.map((item) => item.id === itemId ? { ...item, categoryId, category: category.name } : item));
  }
  async function decide(item: QueueItem, decision: "APPROVED" | "REJECTED", rejectionReason?: string) {
    setBusyId(item.id);
    try {
      await api(`/api/admin/submissions/${encodeURIComponent(item.id)}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, rejectionReason, categoryId: item.categoryId, title: item.title, description: item.description }) });
      onQueueChange(queue.filter((value) => value.id !== item.id));
      setRejecting(null); setReason(""); notify(decision === "APPROVED" ? "Заявка опубликована" : "Заявка отклонена");
    } catch (error) { notify(error instanceof Error ? error.message : "Ошибка модерации"); } finally { setBusyId(""); }
  }
  return <section className="admin-card"><div className="admin-card-head"><div><span className="section-kicker">ОЧЕРЕДЬ</span><h2>Новые предложения</h2></div></div>{mode === "auth" ? <AdminEmpty icon={<Shield />} title="Нужен вход модератора" text="Войдите через Twitch. Доступ определяется по Twitch ID." action={<a className="button button-primary" href="/api/auth/twitch/start?returnTo=/admin">Войти через Twitch</a>} /> : mode === "loading" ? <AdminEmpty icon={<Clock3 />} title="Загружаем очередь" text="Проверяем новые предложения." /> : mode === "error" ? <AdminEmpty icon={<CircleAlert />} title="Очередь недоступна" text="Обновите страницу или проверьте базу." /> : queue.length ? <div className="queue-list">{queue.slice(0, displayLimit).map((item) => <article key={item.id}><div className="queue-image"><Image src={item.image} alt="" fill sizes="110px" /></div><div className="queue-id">#{item.id.slice(-6).toUpperCase()}</div><div className="queue-info"><select className="queue-category" aria-label={`Категория: ${item.title}`} value={item.categoryId} onChange={(event) => changeCategory(item.id, event.target.value)}>{categories.length ? categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>) : <option value={item.categoryId}>{item.category}</option>}</select><h3>{item.title}</h3><p>от <b>{item.author}</b> • {item.time} назад</p></div><div className="queue-actions"><button className="approve" disabled={busyId === item.id} onClick={() => decide(item, "APPROVED")}><Check /> Одобрить</button><button className="reject" disabled={busyId === item.id} onClick={() => setRejecting(item)}><X /> Отклонить</button></div></article>)}</div> : <AdminEmpty icon={<Check />} title="Очередь разобрана" text="Новых заявок пока нет." />}{rejecting && <div className="moderation-backdrop"><section className="moderation-modal" role="dialog" aria-modal="true"><button className="drawer-close" onClick={() => setRejecting(null)} aria-label="Закрыть"><X /></button><span className="section-kicker">ОТКЛОНЕНИЕ</span><h2>{rejecting.title}</h2><p>Автор увидит эту причину.</p><label className="field"><span>Причина <b>*</b></span><textarea autoFocus rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="moderation-modal-actions"><button className="button button-ghost" onClick={() => setRejecting(null)}>Отмена</button><button className="button button-primary" disabled={!reason.trim() || busyId === rejecting.id} onClick={() => decide(rejecting, "REJECTED", reason.trim())}>Отклонить</button></div></section></div>}</section>;
}

function CategoriesPanel({ notify }: { notify: (message: string) => void }) {
  const [items, setItems] = useState<ApiCategory[]>([]);
  const [name, setName] = useState(""); const [slug, setSlug] = useState("");
  const load = useCallback(() => api<{ categories: ApiCategory[] }>("/api/admin/categories").then((value) => setItems(value.categories)).catch((error) => notify(error.message)), [notify]);
  useEffect(() => { void load(); }, [load]);
  async function create() { try { await api("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug, position: items.length * 10 + 10, isVisible: true }) }); setName(""); setSlug(""); await load(); notify("Категория добавлена"); } catch (error) { notify(error instanceof Error ? error.message : "Ошибка"); } }
  async function save(item: ApiCategory) { try { await api(`/api/admin/categories/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: item.name, slug: item.slug, position: item.position, isVisible: item.isVisible }) }); notify("Категория сохранена"); } catch (error) { notify(error instanceof Error ? error.message : "Ошибка"); } }
  return <section className="admin-card admin-workspace"><div className="admin-card-head"><div><span className="section-kicker">{items.length} РАЗДЕЛОВ</span><h2>Категории каталога</h2></div></div><div className="admin-create-row"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Название" /><input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="slug-latin" /><button className="button button-primary" disabled={!name.trim() || !slug.trim()} onClick={create}>Добавить</button></div><div className="admin-table">{items.map((item, index) => <div className="admin-table-row category-edit-row" key={item.id}><b>{index + 1}</b><input value={item.name} onChange={(event) => setItems((current) => current.map((value) => value.id === item.id ? { ...value, name: event.target.value } : value))} /><input value={item.slug} onChange={(event) => setItems((current) => current.map((value) => value.id === item.id ? { ...value, slug: event.target.value } : value))} /><input className="short-input" type="number" value={item.position} onChange={(event) => setItems((current) => current.map((value) => value.id === item.id ? { ...value, position: Number(event.target.value) } : value))} /><label className="admin-switch"><input type="checkbox" checked={item.isVisible} onChange={(event) => setItems((current) => current.map((value) => value.id === item.id ? { ...value, isVisible: event.target.checked } : value))} /><span>{item.isVisible ? "Видна" : "Скрыта"}</span></label><button className="table-action" onClick={() => save(item)}><Save /> Сохранить</button></div>)}</div></section>;
}

function UsersPanel({ notify }: { notify: (message: string) => void }) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [query, setQuery] = useState("");
  const load = useCallback(() => api<{ users: ApiUser[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`).then((value) => setUsers(value.users)).catch((error) => notify(error.message)), [notify, query]);
  useEffect(() => { void load(); }, [load]);
  async function update(user: ApiUser, patch: { role?: "USER" | "MODERATOR"; status?: "ACTIVE" | "BLOCKED" }) { try { await api(`/api/admin/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); setUsers((current) => current.map((value) => value.id === user.id ? { ...value, ...patch } : value)); notify("Пользователь обновлён"); } catch (error) { notify(error instanceof Error ? error.message : "Ошибка"); } }
  return <section className="admin-card admin-workspace"><div className="admin-card-head"><div><span className="section-kicker">{users.length} АККАУНТОВ</span><h2>Пользователи Twitch</h2></div><label className="inline-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ник Twitch" /></label></div><div className="admin-table">{users.map((user) => <div className="admin-table-row user-row" key={user.id}>{user.avatarUrl ? <Image className="avatar" src={user.avatarUrl} alt="" width={36} height={36} unoptimized /> : <span className="avatar avatar-founder">{user.displayName.slice(0, 1)}</span>}<div><strong>{user.displayName}</strong><small>@{user.login}</small></div><span>{user._count.submissions} заявок</span><select disabled={user.role === "FOUNDER"} value={user.role} onChange={(event) => update(user, { role: event.target.value as "USER" | "MODERATOR" })}><option value="USER">Участник</option><option value="MODERATOR">Модератор</option>{user.role === "FOUNDER" && <option value="FOUNDER">Основатель</option>}</select><button className={`table-action ${user.status === "BLOCKED" ? "danger" : ""}`} disabled={user.role === "FOUNDER"} onClick={() => update(user, { status: user.status === "ACTIVE" ? "BLOCKED" : "ACTIVE" })}>{user.status === "ACTIVE" ? "Заблокировать" : "Разблокировать"}</button></div>)}</div></section>;
}

function AuditPanel() {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  useEffect(() => { api<{ logs: AuditItem[] }>("/api/admin/audit").then((value) => setLogs(value.logs)).catch(() => setLogs([])); }, []);
  return <section className="admin-card admin-workspace"><div className="admin-card-head"><div><span className="section-kicker">ПОСЛЕДНИЕ 100 СОБЫТИЙ</span><h2>Журнал действий</h2></div></div>{logs.length ? <ul className="audit-list full-audit">{logs.map((log) => <li key={log.id}><span className="audit-icon blue"><Shield /></span><p><b>{log.actor?.displayName || log.actor?.login || "system"}</b> · {log.action}<small>{log.targetType} #{log.targetId.slice(-6).toUpperCase()} · {new Date(log.createdAt).toLocaleString("ru-RU")}</small></p></li>)}</ul> : <AdminEmpty icon={<Shield />} title="Журнал пока пуст" text="Действия появятся после модерации или изменения настроек." />}</section>;
}

function SettingsPanel({ notify }: { notify: (message: string) => void }) {
  const [limit, setLimit] = useState(3);
  useEffect(() => { api<{ limit: number }>("/api/admin/settings/submission-limit").then((value) => setLimit(value.limit)).catch(() => undefined); }, []);
  async function save() { try { await api("/api/admin/settings/submission-limit", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit }) }); notify("Лимит сохранён"); } catch (error) { notify(error instanceof Error ? error.message : "Ошибка"); } }
  return <section className="admin-card settings-form"><span className="section-kicker">ПРЕДЛОЖЕНИЯ</span><h2>Лимит активных заявок</h2><p>Сколько заявок со статусом «На проверке» может одновременно иметь один пользователь.</p><label className="field"><span>Количество</span><input type="number" min={1} max={100} value={limit} onChange={(event) => setLimit(Number(event.target.value))} /></label><button className="button button-primary" onClick={save}><Save /> Сохранить</button></section>;
}

function CommentsPanel({ notify }: { notify: (message: string) => void }) {
  const [comments, setComments] = useState<ApiComment[]>([]);
  useEffect(() => { api<{ comments: ApiComment[] }>("/api/admin/comments").then((value) => setComments(value.comments)).catch((error) => notify(error.message)); }, [notify]);
  async function remove(id: string) { try { await api(`/api/admin/comments/${id}`, { method: "DELETE" }); setComments((current) => current.filter((comment) => comment.id !== id)); notify("Комментарий удалён"); } catch (error) { notify(error instanceof Error ? error.message : "Ошибка"); } }
  return <section className="admin-card admin-workspace"><div className="admin-card-head"><div><span className="section-kicker">{comments.length} КОММЕНТАРИЕВ</span><h2>Последние обсуждения</h2></div></div>{comments.length ? <div className="comment-moderation-list">{comments.map((comment) => <article key={comment.id}><div><strong>{comment.author.displayName || comment.author.login}</strong><small>{new Date(comment.createdAt).toLocaleString("ru-RU")}</small><p>{comment.body}</p><span>в «{comment.listing.title}»</span></div><button className="table-action danger" onClick={() => remove(comment.id)}><Trash2 /> Удалить</button></article>)}</div> : <AdminEmpty icon={<MessageSquare />} title="Комментариев пока нет" text="Новые обсуждения появятся здесь." />}</section>;
}

function ReportsPanel() { return <section className="admin-card"><AdminEmpty icon={<Flag />} title="Жалоб пока нет" text="Раздел уже готов к очереди жалоб на объявления и комментарии." /></section>; }
function AdminEmpty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) { return <div className="queue-empty">{icon}<h3>{title}</h3><p>{text}</p>{action}</div>; }
function Metric({ icon, value, label, detail, accent }: { icon: ReactNode; value: string; label: string; detail: string; accent: string }) { return <div className={`metric ${accent}`}><span>{icon}</span><div><strong>{value}</strong><p>{label}</p><small>{detail}</small></div></div>; }
