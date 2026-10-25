"use client";

import Image from "next/image";
import {
  Check,
  CircleAlert,
  Clock3,
  Eye,
  ExternalLink,
  FileClock,
  Flag,
  LayoutDashboard,
  MessageSquare,
  RefreshCw,
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
import { SocialLinksSettings } from "@/components/social-links-settings";

type Section = "overview" | "moderation" | "categories" | "comments" | "reports" | "users" | "audit" | "settings";
type QueueItem = { id: string; title: string; originalTitle: string; submitterComment: string; description: string; price: number | null; city: string; sourceUrl: string; author: string; category: string; categoryId: string; time: string; image: string; imageUrls: string[] };
type ApiCategory = { id: string; name: string; slug: string; position: number; isVisible: boolean };
type ApiUser = { id: string; login: string; displayName: string; avatarUrl: string | null; role: "USER" | "MODERATOR" | "FOUNDER"; status: "ACTIVE" | "BLOCKED"; createdAt: string; _count: { submissions: number; comments: number } };
type AuditItem = { id: string; action: string; targetType: string; targetId: string; createdAt: string; actor: { login: string; displayName: string } | null };
type ApiComment = { id: string; body: string; createdAt: string; author: { login: string; displayName: string; avatarUrl: string | null }; listing: { id: string; title: string; submission: { sourceUrl: string } } };
type ReportListing = { id: string; title: string; submission: { sourceUrl: string } };
type ApiReport = { id: string; reason: string; status: "OPEN" | "RESOLVED" | "DISMISSED"; createdAt: string; reporter: { login: string; displayName: string; avatarUrl: string | null }; listing: ReportListing | null; comment: { id: string; body: string; listing: ReportListing } | null };
type OverviewStats = { pendingCount: number; publishedCount: number; openReportCount: number; availabilityErrors24h: number; lastAvailabilityCheckAt: string | null };

const sectionMeta: Record<Section, { kicker: string; title: string }> = {
  overview: { kicker: "ПАНЕЛЬ УПРАВЛЕНИЯ", title: "Добрый вечер, Раф" },
  moderation: { kicker: "МОДЕРАЦИЯ", title: "Очередь предложений" },
  categories: { kicker: "СТРУКТУРА КАТАЛОГА", title: "Категории" },
  comments: { kicker: "СООБЩЕСТВО", title: "Комментарии" },
  reports: { kicker: "БЕЗОПАСНОСТЬ", title: "Жалобы" },
  users: { kicker: "ДОСТУП", title: "Пользователи" },
  audit: { kicker: "СИСТЕМА", title: "Журнал действий" },
  settings: { kicker: "СИСТЕМА", title: "Настройки" },
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
  const [reportCount, setReportCount] = useState(0);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
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
      const payload = await response.json() as { submissions: Array<{ id: string; sourceUrl: string; createdAt: string; rawSnapshot: unknown; author: { displayName: string; login: string }; category: { id: string; name: string; slug: string } }> };
      if (!response.ok) throw new Error("queue unavailable");
      setQueue(payload.submissions.map((submission) => {
        const snapshot = submission.rawSnapshot && typeof submission.rawSnapshot === "object" && !Array.isArray(submission.rawSnapshot) ? submission.rawSnapshot as Record<string, unknown> : {};
        const imageUrls = Array.isArray(snapshot.imageUrls) ? snapshot.imageUrls.filter((value): value is string => typeof value === "string") : [];
        return {
          id: submission.id,
          title: typeof snapshot.title === "string" ? snapshot.title : "Новое объявление Avito",
          originalTitle: typeof snapshot.originalTitle === "string" ? snapshot.originalTitle : typeof snapshot.title === "string" ? snapshot.title : "Новое объявление Avito",
          submitterComment: typeof snapshot.submitterComment === "string" ? snapshot.submitterComment : "",
          description: typeof snapshot.description === "string" ? snapshot.description : "",
          price: typeof snapshot.price === "number" ? snapshot.price : null,
          city: typeof snapshot.city === "string" ? snapshot.city : "",
          sourceUrl: submission.sourceUrl,
          author: submission.author.displayName || submission.author.login,
          category: submission.category.name,
          categoryId: submission.category.id,
          time: timeAgo(submission.createdAt),
          imageUrls,
          image: imageUrls[0]
            ? imageUrls[0]
            : categoryImages[submission.category.slug] || "/images/car-lineup.png",
        };
      }));
      setQueueMode("live");
    } catch { setQueueMode("error"); }
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const stats = await api<OverviewStats>("/api/admin/overview");
      setOverviewStats(stats);
      setReportCount(stats.openReportCount);
    } catch {
      setOverviewStats(null);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadQueue(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadQueue]);

  useEffect(() => {
    api<{ reports: ApiReport[] }>("/api/admin/reports?status=OPEN")
      .then((value) => setReportCount(value.reports.length))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOverview(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOverview, queue.length, reportCount]);

  return (
    <div className="site-page interior admin-screen">
      <SiteHeader active="admin" />
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <AdminNav section={section} queueCount={queue.length} reportCount={reportCount} onSelect={setSection} />
          <small>{queueMode === "live" ? "DATABASE CONNECTED" : "LOCAL MODE"} • v0.3.0</small>
        </aside>
        <main className="admin-main">
          <div className="admin-title">
            <div><span className="section-kicker">{meta.kicker}</span><h1>{meta.title}</h1></div>
            <div className="admin-search"><Search /><input placeholder="Поиск по панели" /><kbd>⌘ K</kbd></div>
          </div>

          {section === "overview" && <Overview queue={queue} queueMode={queueMode} reportCount={reportCount} stats={overviewStats} notify={notify} onQueueChange={setQueue} onOpenQueue={() => setSection("moderation")} />}
          {section === "moderation" && <QueuePanel queue={queue} mode={queueMode} notify={notify} onQueueChange={setQueue} />}
          {section === "categories" && <CategoriesPanel notify={notify} />}
          {section === "comments" && <CommentsPanel notify={notify} />}
          {section === "reports" && <ReportsPanel notify={notify} onCountChange={setReportCount} />}
          {section === "users" && <UsersPanel notify={notify} />}
          {section === "audit" && <AuditPanel />}
          {section === "settings" && <SettingsPanel notify={notify} />}
        </main>
      </div>
      {toast && <div className="admin-toast"><Check /> {toast}</div>}
    </div>
  );
}

function AdminNav({ section, queueCount, reportCount, onSelect }: { section: Section; queueCount: number; reportCount: number; onSelect: (section: Section) => void }) {
  const item = (id: Section, icon: ReactNode, label: string, count?: number) => <button className={section === id ? "active" : ""} onClick={() => onSelect(id)}>{icon}{label}{Boolean(count) && <b>{count}</b>}</button>;
  return <div className="admin-nav-groups"><div><span>УПРАВЛЕНИЕ</span>{item("overview", <LayoutDashboard />, "Обзор")}{item("moderation", <FileClock />, "Модерация", queueCount)}{item("categories", <Tags />, "Категории")}{item("comments", <MessageSquare />, "Комментарии")}{item("reports", <Flag />, "Жалобы", reportCount)}</div><div><span>СИСТЕМА</span>{item("users", <Users />, "Пользователи")}{item("audit", <Shield />, "Журнал действий")}{item("settings", <Settings />, "Настройки")}</div></div>;
}

function Overview({ queue, queueMode, reportCount, stats, notify, onQueueChange, onOpenQueue }: { queue: QueueItem[]; queueMode: "loading" | "live" | "auth" | "error"; reportCount: number; stats: OverviewStats | null; notify: (message: string) => void; onQueueChange: (items: QueueItem[]) => void; onOpenQueue: () => void }) {
  const lastCheckDetail = stats?.lastAvailabilityCheckAt
    ? `последняя: ${new Date(stats.lastAvailabilityCheckAt).toLocaleString("ru-RU")}`
    : "проверок пока не было";
  return <><div className="admin-metrics"><Metric icon={<Clock3 />} value={(stats?.pendingCount ?? queue.length).toString()} label="ждут проверки" detail="живая очередь" accent="amber" /><Metric icon={<Eye />} value={stats?.publishedCount.toString() ?? "—"} label="опубликовано" detail="включая снятые с Avito" accent="green" /><Metric icon={<Flag />} value={reportCount.toString()} label="новые жалобы" detail={reportCount ? "нужна проверка" : "очередь чиста"} accent="red" /><Metric icon={<CircleAlert />} value={stats?.availabilityErrors24h.toString() ?? "—"} label="ошибок проверки" detail={lastCheckDetail} accent="blue" /></div><QueuePanel queue={queue} displayLimit={5} mode={queueMode} notify={notify} onQueueChange={onQueueChange} /><div className="admin-section-actions"><button className="button button-ghost" onClick={onOpenQueue}>Открыть всю модерацию</button></div></>;
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
  function updateItem(itemId: string, patch: Partial<QueueItem>) {
    onQueueChange(queue.map((item) => item.id === itemId ? { ...item, ...patch } : item));
  }
  function changeCategory(itemId: string, categoryId: string) {
    const category = categories.find((value) => value.id === categoryId);
    if (!category) return;
    updateItem(itemId, { categoryId, category: category.name });
  }
  async function decide(item: QueueItem, decision: "APPROVED" | "REJECTED", rejectionReason?: string) {
    setBusyId(item.id);
    try {
      await api(`/api/admin/submissions/${encodeURIComponent(item.id)}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, rejectionReason, categoryId: item.categoryId, title: item.title, originalTitle: item.originalTitle, submitterComment: item.submitterComment || undefined, description: item.description, price: item.price, city: item.city || null }) });
      onQueueChange(queue.filter((value) => value.id !== item.id));
      setRejecting(null); setReason(""); notify(decision === "APPROVED" ? "Заявка опубликована" : "Заявка отклонена");
    } catch (error) { notify(error instanceof Error ? error.message : "Ошибка модерации"); } finally { setBusyId(""); }
  }
  return <section className="admin-card"><div className="admin-card-head"><div><span className="section-kicker">ОЧЕРЕДЬ</span><h2>Новые предложения</h2></div></div>{mode === "auth" ? <AdminEmpty icon={<Shield />} title="Нужен вход модератора" text="Войдите через Twitch. Доступ определяется по Twitch ID." action={<a className="button button-primary" href="/api/auth/twitch/start?returnTo=/admin">Войти через Twitch</a>} /> : mode === "loading" ? <AdminEmpty icon={<Clock3 />} title="Загружаем очередь" text="Проверяем новые предложения." /> : mode === "error" ? <AdminEmpty icon={<CircleAlert />} title="Очередь недоступна" text="Обновите страницу или проверьте базу." /> : queue.length ? <div className="moderation-list">{queue.slice(0, displayLimit).map((item) => <article className="moderation-item" key={item.id}>
    <div className="moderation-media">
      <div className="moderation-cover"><Image src={item.image} alt={item.title} fill sizes="(max-width: 800px) 100vw, 360px" unoptimized={item.image.startsWith("https://")} /></div>
      {item.imageUrls.length > 1 && <div className="moderation-thumbs">{item.imageUrls.slice(0, 5).map((image, index) => <span key={image}><Image src={image} alt={`Фото ${index + 1}`} fill sizes="70px" unoptimized /></span>)}</div>}
    </div>
    <div className="moderation-fields">
      <div className="moderation-meta"><span>#{item.id.slice(-6).toUpperCase()}</span><span>от <b>{item.author}</b> • {item.time} назад</span></div>
      <a className="moderation-source" href={item.sourceUrl} target="_blank" rel="noreferrer">Открыть исходное объявление на Avito <ExternalLink size={14} /></a>
      <label><span>Название от автора</span><input value={item.title} maxLength={120} onChange={(event) => updateItem(item.id, { title: event.target.value })} /></label>
      <label><span>Оригинальное название на Avito</span><input value={item.originalTitle} maxLength={160} onChange={(event) => updateItem(item.id, { originalTitle: event.target.value })} /></label>
      <div className="moderation-field-row">
        <label><span>Категория</span><select value={item.categoryId} onChange={(event) => changeCategory(item.id, event.target.value)}>{categories.length ? categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>) : <option value={item.categoryId}>{item.category}</option>}</select></label>
        <label><span>Цена, ₽</span><input type="number" min={0} value={item.price ?? ""} onChange={(event) => updateItem(item.id, { price: event.target.value ? Number(event.target.value) : null })} /></label>
        <label><span>Город</span><input value={item.city} maxLength={100} onChange={(event) => updateItem(item.id, { city: event.target.value })} /></label>
      </div>
      <label><span>Комментарий автора</span><textarea rows={3} maxLength={280} value={item.submitterComment} onChange={(event) => updateItem(item.id, { submitterComment: event.target.value })} /></label>
      <label><span>Полное описание с Avito</span><textarea rows={7} maxLength={12000} value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} /></label>
      <div className="moderation-decisions"><button className="approve" disabled={busyId === item.id || item.title.trim().length < 2} onClick={() => decide(item, "APPROVED")}><Check /> Одобрить и опубликовать</button><button className="reject" disabled={busyId === item.id} onClick={() => setRejecting(item)}><X /> Отклонить</button></div>
    </div>
  </article>)}</div> : <AdminEmpty icon={<Check />} title="Очередь разобрана" text="Новых заявок пока нет." />}{rejecting && <div className="moderation-backdrop"><section className="moderation-modal" role="dialog" aria-modal="true"><button className="drawer-close" onClick={() => setRejecting(null)} aria-label="Закрыть"><X /></button><span className="section-kicker">ОТКЛОНЕНИЕ</span><h2>{rejecting.title}</h2><p>Автор увидит эту причину.</p><label className="field"><span>Причина <b>*</b></span><textarea autoFocus rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="moderation-modal-actions"><button className="button button-ghost" onClick={() => setRejecting(null)}>Отмена</button><button className="button button-primary" disabled={!reason.trim() || busyId === rejecting.id} onClick={() => decide(rejecting, "REJECTED", reason.trim())}>Отклонить</button></div></section></div>}</section>;
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
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ checked: number; available: number; unavailable: number; errors: number } | null>(null);
  useEffect(() => { api<{ limit: number }>("/api/admin/settings/submission-limit").then((value) => setLimit(value.limit)).catch(() => undefined); }, []);
  async function save() { try { await api("/api/admin/settings/submission-limit", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit }) }); notify("Лимит сохранён"); } catch (error) { notify(error instanceof Error ? error.message : "Ошибка"); } }
  async function checkAvailability() {
    setChecking(true);
    try {
      const result = await api<{ checked: number; available: number; unavailable: number; errors: number }>("/api/admin/availability", { method: "POST" });
      setCheckResult(result);
      notify(`Проверено объявлений: ${result.checked}`);
    } catch (error) { notify(error instanceof Error ? error.message : "Ошибка проверки"); } finally { setChecking(false); }
  }
  return <div className="settings-grid"><section className="admin-card settings-form"><span className="section-kicker">ПРЕДЛОЖЕНИЯ</span><h2>Лимит активных заявок</h2><p>Сколько заявок со статусом «На проверке» может одновременно иметь один пользователь.</p><label className="field"><span>Количество</span><input type="number" min={1} max={100} value={limit} onChange={(event) => setLimit(Number(event.target.value))} /></label><button className="button button-primary" onClick={save}><Save /> Сохранить</button></section><section className="admin-card settings-form"><span className="section-kicker">НАДЁЖНОСТЬ</span><h2>Доступность объявлений</h2><p>Ежедневная задача проверяет активные ссылки. Недоступные объявления остаются в каталоге серыми с пометкой «Снято с публикации».</p>{checkResult && <div className="availability-result"><span>Проверено <b>{checkResult.checked}</b></span><span>Доступно <b>{checkResult.available}</b></span><span>Снято <b>{checkResult.unavailable}</b></span><span>Ошибки <b>{checkResult.errors}</b></span></div>}<button className="button button-primary" disabled={checking} onClick={checkAvailability}><RefreshCw className={checking ? "spin" : ""} /> {checking ? "Проверяем…" : "Проверить сейчас"}</button></section><SocialLinksSettings notify={notify} /></div>;
}

function CommentsPanel({ notify }: { notify: (message: string) => void }) {
  const [comments, setComments] = useState<ApiComment[]>([]);
  useEffect(() => { api<{ comments: ApiComment[] }>("/api/admin/comments").then((value) => setComments(value.comments)).catch((error) => notify(error.message)); }, [notify]);
  async function remove(id: string) { try { await api(`/api/admin/comments/${id}`, { method: "DELETE" }); setComments((current) => current.filter((comment) => comment.id !== id)); notify("Комментарий удалён"); } catch (error) { notify(error instanceof Error ? error.message : "Ошибка"); } }
  return <section className="admin-card admin-workspace"><div className="admin-card-head"><div><span className="section-kicker">{comments.length} КОММЕНТАРИЕВ</span><h2>Последние обсуждения</h2></div></div>{comments.length ? <div className="comment-moderation-list">{comments.map((comment) => <article key={comment.id}><div><strong>{comment.author.displayName || comment.author.login}</strong><small>{new Date(comment.createdAt).toLocaleString("ru-RU")}</small><p>{comment.body}</p><a className="moderation-source" href={comment.listing.submission.sourceUrl} target="_blank" rel="noreferrer">«{comment.listing.title}» <ExternalLink size={12} /></a></div><button className="table-action danger" onClick={() => remove(comment.id)}><Trash2 /> Удалить</button></article>)}</div> : <AdminEmpty icon={<MessageSquare />} title="Комментариев пока нет" text="Новых обсуждений нет." />}</section>;
}

function ReportsPanel({ notify, onCountChange }: { notify: (message: string) => void; onCountChange: (count: number) => void }) {
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [busyId, setBusyId] = useState("");
  const load = useCallback(() => api<{ reports: ApiReport[] }>("/api/admin/reports?status=OPEN").then((value) => setReports(value.reports)).catch((error) => notify(error.message)), [notify]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { onCountChange(reports.length); }, [onCountChange, reports.length]);
  async function decide(report: ApiReport, input: { status: "DISMISSED" } | { action: "REMOVE_CONTENT" }) {
    setBusyId(report.id);
    try {
      await api(`/api/admin/reports/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      await load();
      notify("action" in input ? (report.comment ? "Комментарий удалён" : "Объявление снято с публикации") : "Жалоба удалена из очереди");
    } catch (error) { notify(error instanceof Error ? error.message : "Ошибка"); } finally { setBusyId(""); }
  }
  return <section className="admin-card admin-workspace"><div className="admin-card-head"><div><span className="section-kicker">{reports.length} ОТКРЫТЫХ</span><h2>Очередь жалоб</h2></div></div>{reports.length ? <div className="report-list">{reports.map((report) => { const listing = report.listing || report.comment?.listing; return <article key={report.id}><div><span>{report.comment ? "КОММЕНТАРИЙ" : "ОБЪЯВЛЕНИЕ"}</span><h3>{listing?.title || "Удалённый материал"}</h3><p>{report.reason}</p><small>от @{report.reporter.login} • {new Date(report.createdAt).toLocaleString("ru-RU")}</small>{report.comment && <blockquote>{report.comment.body}</blockquote>}{listing && <a className="moderation-source" href={listing.submission.sourceUrl} target="_blank" rel="noreferrer">Открыть на Avito <ExternalLink size={13} /></a>}</div><div><button className="table-action" disabled={busyId === report.id} onClick={() => decide(report, { status: "DISMISSED" })}><Trash2 /> Удалить жалобу</button><button className="table-action danger" disabled={busyId === report.id} onClick={() => decide(report, { action: "REMOVE_CONTENT" })}><Trash2 /> {report.comment ? "Удалить комментарий" : "Снять объявление"}</button></div></article>; })}</div> : <AdminEmpty icon={<Flag />} title="Жалоб пока нет" text="Новых жалоб нет." />}</section>;
}
function AdminEmpty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) { return <div className="queue-empty">{icon}<h3>{title}</h3><p>{text}</p>{action}</div>; }
function Metric({ icon, value, label, detail, accent }: { icon: ReactNode; value: string; label: string; detail: string; accent: string }) { return <div className={`metric ${accent}`}><span>{icon}</span><div><strong>{value}</strong><p>{label}</p><small>{detail}</small></div></div>; }
