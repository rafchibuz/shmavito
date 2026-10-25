"use client";

import Image from "next/image";
import { ExternalLink, RotateCcw, Search, Trash2, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

type ManagedListing = {
  id: string;
  title: string;
  originalTitle: string | null;
  price: number | null;
  city: string | null;
  state: "ACTIVE" | "UNAVAILABLE" | "DELETED";
  publishedAt: string;
  deletedAt: string | null;
  image: string | null;
  category: { name: string };
  submission: { sourceUrl: string; author: { login: string; displayName: string } };
};

type ListingPage = { listings: ManagedListing[]; total: number; page: number; pageSize: number; canManage: boolean };

export function AdminListingsPanel({ notify, onChanged }: { notify: (message: string) => void; onChanged: () => void }) {
  const [status, setStatus] = useState<"published" | "deleted">("published");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<ManagedListing | null>(null);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/listings?status=${status}&page=${targetPage}&q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const result = await response.json() as ListingPage & { message?: string };
      if (!response.ok) throw new Error(result.message || "Не удалось загрузить объявления.");
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка загрузки.");
    } finally { setLoading(false); }
  }, [status, query]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(page); });
    return () => { active = false; };
  }, [load, page]);

  function searchListings(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  async function changeListing(item: ManagedListing, action: "delete" | "restore") {
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/admin/listings/${encodeURIComponent(item.id)}`, { method: action === "delete" ? "DELETE" : "PATCH" });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "Не удалось изменить объявление.");
      setConfirming(null);
      setPage(1);
      await load(1);
      onChanged();
      notify(action === "delete" ? "Объявление удалено из каталога" : "Объявление восстановлено");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка сохранения.");
    } finally { setBusyId(""); }
  }

  return <section className="admin-card admin-workspace managed-listings">
    <div className="admin-card-head"><div><span className="section-kicker">КАТАЛОГ</span><h2>Объявления</h2></div><span className="managed-listings-total">{data?.total ?? "—"} {status === "deleted" ? "удалено" : "опубликовано"}</span></div>
    <div className="managed-listings-toolbar">
      <div className="managed-listings-tabs">
        <button className={status === "published" ? "active" : ""} onClick={() => { setStatus("published"); setPage(1); }}>Опубликованные</button>
        <button className={status === "deleted" ? "active" : ""} onClick={() => { setStatus("deleted"); setPage(1); }}>Удалённые</button>
      </div>
      <form onSubmit={searchListings}><Search size={17} /><input value={search} maxLength={120} onChange={(event) => setSearch(event.target.value)} placeholder="Название, город или ссылка" aria-label="Поиск объявлений" /><button type="submit">Найти</button></form>
    </div>
    {error && <div className="managed-listings-error" role="alert">{error}{error.includes("Twitch") && <a href="/api/auth/twitch/start?returnTo=/admin">Войти через Twitch</a>}</div>}
    {loading ? <div className="managed-listings-empty">Загружаем объявления…</div> : data?.listings.length ? <div className="managed-listings-list">
      {data.listings.map((item) => <article className="managed-listing" key={item.id}>
        <div className="managed-listing-image"><Image src={item.image || "/images/car-lineup.png"} alt="" fill sizes="96px" unoptimized={Boolean(item.image?.startsWith("https://"))} /></div>
        <div className="managed-listing-info">
          <div className="managed-listing-meta"><span>{item.category.name}</span><span>{item.state === "DELETED" ? "Удалено" : item.state === "UNAVAILABLE" ? "Снято с Avito" : "В каталоге"}</span></div>
          <h3>{item.title}</h3>
          {item.originalTitle && item.originalTitle !== item.title && <p>{item.originalTitle}</p>}
          <small>{item.price === null ? "Цена не указана" : `${item.price.toLocaleString("ru-RU")} ₽`} · {item.city || "Город не указан"} · @{item.submission.author.login}</small>
          <a href={item.submission.sourceUrl} target="_blank" rel="noopener noreferrer">Открыть на Avito <ExternalLink size={13} /></a>
        </div>
        {data.canManage && <div className="managed-listing-actions">
          {status === "published"
            ? <button className="table-action danger" disabled={busyId === item.id} onClick={() => setConfirming(item)}><Trash2 size={15} /> Удалить</button>
            : <button className="table-action" disabled={busyId === item.id} onClick={() => void changeListing(item, "restore")}><RotateCcw size={15} /> Восстановить</button>}
        </div>}
      </article>)}
    </div> : <div className="managed-listings-empty">{status === "deleted" ? "Удалённых объявлений нет." : "Объявлений не найдено."}</div>}
    {data && data.total > data.pageSize && <div className="managed-listings-pagination"><button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Назад</button><span>{page} / {Math.ceil(data.total / data.pageSize)}</span><button disabled={page >= Math.ceil(data.total / data.pageSize) || loading} onClick={() => setPage((current) => current + 1)}>Дальше</button></div>}
    {confirming && <div className="moderation-backdrop"><div className="moderation-modal" role="dialog" aria-modal="true" aria-label="Удалить объявление">
      <button className="drawer-close" onClick={() => setConfirming(null)} aria-label="Закрыть"><X /></button>
      <span className="section-kicker">УДАЛЕНИЕ ИЗ КАТАЛОГА</span><h2>{confirming.title}</h2>
      <p>Объявление исчезнет с главной страницы. Автор получит уведомление. Его можно восстановить в разделе «Удалённые».</p>
      <div className="moderation-modal-actions"><button className="button button-ghost" onClick={() => setConfirming(null)}>Отмена</button><button className="button button-primary" disabled={busyId === confirming.id} onClick={() => void changeListing(confirming, "delete")}><Trash2 size={16} /> {busyId === confirming.id ? "Удаляем…" : "Удалить объявление"}</button></div>
    </div></div>}
  </section>;
}
