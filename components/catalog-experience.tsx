"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Eye,
  ExternalLink,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { categories as demoCategories, initialComments, listings as demoListings } from "@/lib/demo-data";
import type { Category, CommentItem, Listing } from "@/lib/types";

const VIEWED_KEY = "shmavito.viewed";
const LIKED_KEY = "shmavito.likes";
type CatalogViewer = { id: string; login: string; displayName: string; avatarUrl: string | null; likedIds: string[]; viewedIds: string[] };
type ApiComment = { id: string; body: string; parentId: string | null; createdAt: string; author: { id: string; login: string; displayName: string; avatarUrl: string | null } };

function commentFromApi(comment: ApiComment): CommentItem {
  return {
    id: comment.id,
    authorId: comment.author.id,
    author: comment.author.displayName || comment.author.login,
    avatar: comment.author.avatarUrl || "/images/avatar-blackline.svg",
    text: comment.body,
    time: "только что",
    parentId: comment.parentId || undefined,
  };
}

export function CatalogExperience() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("Все");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("new");
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [viewed, setViewed] = useState<string[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [comments, setComments] = useState<Record<string, CommentItem[]>>(initialComments);
  const [catalogListings, setCatalogListings] = useState<Listing[]>(demoListings);
  const [catalogCategories, setCatalogCategories] = useState<readonly string[]>(demoCategories);
  const [catalogMode, setCatalogMode] = useState<"loading" | "live" | "demo">("loading");
  const [viewer, setViewer] = useState<CatalogViewer | null>(null);

  useEffect(() => {
    const hydrateLocalState = window.setTimeout(() => {
      setViewed(JSON.parse(localStorage.getItem(VIEWED_KEY) || "[]"));
      setLiked(JSON.parse(localStorage.getItem(LIKED_KEY) || "[]"));
    }, 0);
    return () => window.clearTimeout(hydrateLocalState);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/listings", { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" }),
    ])
      .then(async ([listingResponse, categoryResponse]) => {
        if (!listingResponse.ok || !categoryResponse.ok) throw new Error("catalog unavailable");
        const listingPayload = await listingResponse.json() as { listings: Listing[]; viewer: CatalogViewer | null };
        const categoryPayload = await categoryResponse.json() as { categories: { name: string }[] };
        setCatalogCategories(["Все", ...categoryPayload.categories.map((item) => item.name)]);
        if (listingPayload.listings.length) {
          const likedIds = listingPayload.viewer?.likedIds || [];
          setCatalogListings(listingPayload.listings.map((item) => ({ ...item, likes: Math.max(0, item.likes - Number(likedIds.includes(item.id))) })));
          setViewer(listingPayload.viewer);
          if (listingPayload.viewer) {
            setLiked(likedIds);
            setViewed(listingPayload.viewer.viewedIds);
          }
          setComments({});
          setCatalogMode("live");
        } else {
          setCatalogMode("demo");
        }
      })
      .catch(() => setCatalogMode("demo"));
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const result = catalogListings.filter((item) => {
      const categoryMatch = category === "Все" || item.category === category;
      const queryMatch = !normalized || `${item.title} ${item.description} ${item.location}`.toLowerCase().includes(normalized);
      const unseenMatch = !unseenOnly || !viewed.includes(item.id);
      return categoryMatch && queryMatch && unseenMatch;
    });
    return result.toSorted((a, b) => {
      if (sort === "popular") return b.likes + Number(liked.includes(b.id)) - (a.likes + Number(liked.includes(a.id)));
      if (sort === "discussed") return b.comments - a.comments;
      if (sort === "old") return catalogListings.indexOf(b) - catalogListings.indexOf(a);
      return catalogListings.indexOf(a) - catalogListings.indexOf(b);
    });
  }, [catalogListings, category, liked, query, sort, unseenOnly, viewed]);

  function persistViewed(next: string[]) {
    setViewed(next);
    localStorage.setItem(VIEWED_KEY, JSON.stringify(next));
  }

  function openListing(item: Listing) {
    if (!viewed.includes(item.id)) persistViewed([...viewed, item.id]);
    if (catalogMode === "live") {
      fetch(`/api/listings/${encodeURIComponent(item.id)}/view`, { method: "POST" }).catch(() => undefined);
      fetch(`/api/listings/${encodeURIComponent(item.id)}/comments`, { cache: "no-store" })
        .then(async (response) => response.ok ? response.json() as Promise<{ comments: ApiComment[] }> : Promise.reject())
        .then((payload) => setComments((current) => ({ ...current, [item.id]: payload.comments.map(commentFromApi) })))
        .catch(() => undefined);
    }
    setSelected(item);
  }

  async function toggleLike(id: string) {
    const item = catalogListings.find((listing) => listing.id === id);
    const own = catalogMode === "live" ? Boolean(viewer?.id && item?.author.id === viewer.id) : item?.author.name === "rafchibiskus";
    if (!item || own || item.unavailable) return;
    if (catalogMode === "live" && !viewer) {
      router.push("/api/auth/twitch/start?returnTo=/");
      return;
    }
    const previous = liked;
    const next = liked.includes(id) ? liked.filter((itemId) => itemId !== id) : [...liked, id];
    setLiked(next);
    localStorage.setItem(LIKED_KEY, JSON.stringify(next));
    if (catalogMode === "live") {
      try {
        const response = await fetch(`/api/listings/${encodeURIComponent(id)}/like`, { method: "POST" });
        if (response.status === 401) { router.push("/api/auth/twitch/start?returnTo=/"); return; }
        const payload = await response.json() as { liked?: boolean; count?: number; message?: string };
        if (!response.ok) throw new Error(payload.message || "Не удалось поставить лайк.");
        setLiked((current) => payload.liked ? [...new Set([...current, id])] : current.filter((itemId) => itemId !== id));
        if (typeof payload.count === "number") {
          const baseLikes = Math.max(0, payload.count - Number(payload.liked));
          setCatalogListings((items) => items.map((listing) => listing.id === id ? { ...listing, likes: baseLikes } : listing));
          setSelected((current) => current?.id === id ? { ...current, likes: baseLikes } : current);
        }
      } catch {
        setLiked(previous);
        localStorage.setItem(LIKED_KEY, JSON.stringify(previous));
      }
    }
  }

  async function addComment(listingId: string, text: string, parentId?: string) {
    if (catalogMode === "live") {
      if (!viewer) { router.push("/api/auth/twitch/start?returnTo=/"); return false; }
      const response = await fetch(`/api/listings/${encodeURIComponent(listingId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, parentId }),
      });
      if (response.status === 401) { router.push("/api/auth/twitch/start?returnTo=/"); return false; }
      const payload = await response.json() as { comment?: ApiComment; message?: string };
      if (!response.ok || !payload.comment) return false;
      setComments((current) => ({ ...current, [listingId]: [...(current[listingId] || []), commentFromApi(payload.comment!)] }));
      setCatalogListings((items) => items.map((listing) => listing.id === listingId ? { ...listing, comments: listing.comments + 1 } : listing));
      return true;
    }
    const next: CommentItem = {
      id: crypto.randomUUID(),
      author: "rafchibiskus",
      avatar: "/images/avatar-founder.svg",
      text,
      time: "только что",
      parentId,
    };
    setComments((current) => ({ ...current, [listingId]: [...(current[listingId] || []), next] }));
    return true;
  }

  async function reportTarget(targetType: "listing" | "comment", targetId: string, reason: string) {
    if (!viewer) { router.push("/api/auth/twitch/start?returnTo=/"); return "Нужен вход через Twitch."; }
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason }),
    });
    const payload = await response.json() as { message?: string };
    return response.ok ? null : payload.message || "Не удалось отправить жалобу.";
  }

  return (
    <>
      <section className="hero">
        <Image className="hero-bg" src="/images/hero-car.png" alt="Автомобили STEEL ночью" fill preload sizes="100vw" />
        <div className="hero-overlay" />
        <div className="hero-copy shell">
          <div className="eyebrow"><Sparkles size={15} /> ПРЕДЛОЖКА STEEL</div>
          <h1>НАХОДКИ,<br /><span>ДОСТОЙНЫЕ ЭФИРА</span></h1>
          <p>Сообщество находит интересные объявления. Модераторы отбирают лучшее. STEEL смотрит вместе с вами.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/submit">Предложить объявление <ArrowRight size={18} /></Link>
            <a className="button button-ghost" href="#catalog">Смотреть каталог</a>
          </div>
          <div className="hero-stats" aria-label="Статистика каталога">
            <div><strong>1 284</strong><span>находки</span></div>
            <div><strong>48</strong><span>на модерации</span></div>
            <div><strong>26 910</strong><span>переходов</span></div>
          </div>
        </div>
        <a className="steel-card" href="https://www.twitch.tv/steel" target="_blank" rel="noreferrer" aria-label="Открыть Twitch-канал STEEL">
          <Image src="/images/steel-portrait.png" alt="STEEL" fill sizes="340px" loading="eager" />
          <div><span>CURATED BY</span><strong>STEEL</strong><small>twitch.tv/steel</small></div>
        </a>
      </section>

      <main className="catalog-section shell" id="catalog">
        <div className="section-heading">
          <div><span className="section-kicker">КАТАЛОГ</span><h2>Свежие предложения</h2></div>
        </div>

        <div className="catalog-toolbar">
          <label className="search-box">
            <Search size={19} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Марка, модель, город или описание" />
            {query && <button onClick={() => setQuery("")} aria-label="Очистить поиск"><X size={16} /></button>}
          </label>
          <label className="select-box"><SlidersHorizontal size={17} /><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="new">Сначала новые</option><option value="popular">Популярные</option><option value="discussed">Обсуждаемые</option><option value="old">Сначала старые</option></select><ChevronDown size={15} /></label>
          <label className="check-chip"><input type="checkbox" checked={unseenOnly} onChange={(event) => setUnseenOnly(event.target.checked)} /><span /> Только непросмотренные</label>
        </div>

        <div className="category-row" aria-label="Категории">
          {catalogCategories.map((item) => <button key={item} className={item === category ? "active" : ""} onClick={() => setCategory(item)}>{item}{item !== "Все" && <small>{catalogListings.filter((listing) => listing.category === item).length}</small>}</button>)}
        </div>

        <div className="result-bar"><span>Найдено: <b>{filtered.length}</b></span><span className={`demo-badge ${catalogMode === "live" ? "is-live" : ""}`}>{catalogMode === "live" ? "ЖИВОЙ КАТАЛОГ" : catalogMode === "loading" ? "ЗАГРУЗКА" : "ДЕМО ДО ПЕРВОЙ ПУБЛИКАЦИИ"}</span></div>

        {filtered.length ? (
          <div className="listing-grid">
            {filtered.map((item) => (
              <ListingCard key={item.id} item={item} viewed={viewed.includes(item.id)} liked={liked.includes(item.id)} own={catalogMode === "live" ? item.author.id === viewer?.id : item.author.name === "rafchibiskus"} onOpen={() => openListing(item)} onLike={() => toggleLike(item.id)} />
            ))}
          </div>
        ) : (
          <div className="empty-state"><Search size={30} /><h3>Ничего не найдено</h3><p>Попробуйте другой запрос или сбросьте фильтры.</p><button className="button button-ghost" onClick={() => { setCategory("Все"); setQuery(""); setUnseenOnly(false); }}>Сбросить фильтры</button></div>
        )}
      </main>

      <section className="submit-cta">
        <div className="shell submit-cta-inner"><div><span className="section-kicker">НАШЛИ ЧТО-ТО ИНТЕРЕСНОЕ?</span><h2>Отправьте ссылку — остальное сделаем мы</h2><p>Вставьте объявление Avito, выберите категорию и проверьте данные.</p></div><Link className="button button-light" href="/submit">Предложить объявление <ArrowRight size={18} /></Link></div>
      </section>

      {selected && <ListingDrawer item={selected} liked={liked.includes(selected.id)} own={catalogMode === "live" ? selected.author.id === viewer?.id : selected.author.name === "rafchibiskus"} viewerAvatar={viewer?.avatarUrl || null} comments={comments[selected.id] || []} onClose={() => setSelected(null)} onLike={() => toggleLike(selected.id)} onComment={(text, parent) => addComment(selected.id, text, parent)} onReport={reportTarget} />}
    </>
  );
}

function ListingCard({ item, viewed, liked, own, onOpen, onLike }: { item: Listing; viewed: boolean; liked: boolean; own: boolean; onOpen: () => void; onLike: () => void }) {
  return (
    <article className={`listing-card ${viewed ? "is-viewed" : ""} ${item.unavailable ? "is-unavailable" : ""}`}>
      <button className="card-media" onClick={onOpen} aria-label={`Открыть ${item.title}`}>
        <Image src={item.image} alt="" fill sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw" unoptimized={item.image.startsWith("https://")} />
        <span className="category-pill">{item.category}</span>
        {item.unavailable && <span className="unavailable-pill">Снято с публикации</span>}
        {viewed && !item.unavailable && <span className="viewed-pill"><Eye size={13} /> Просмотрено</span>}
      </button>
      <div className="card-content">
        <div className="card-topline"><strong>{item.price}</strong><span><MapPin size={13} /> {item.location}</span></div>
        <button className="card-title" onClick={onOpen}>{item.title}</button>
        {(item.year || item.mileage) && <div className="spec-row">{item.year && <span>{item.year} год</span>}{item.mileage && <span>{item.mileage}</span>}</div>}
        <div className="author-row"><span className="avatar"><Image src={item.author.avatar} alt="" width={30} height={30} /></span><div><b>{item.author.name}</b><small>{item.published}</small></div><BadgeCheck size={15} /></div>
      </div>
      <div className="card-footer">
        <button className={liked ? "liked" : ""} disabled={own || item.unavailable} onClick={onLike} title={own ? "Это ваше предложение — свои объявления лайкать нельзя" : "Лайк"}><Heart size={16} fill={liked ? "currentColor" : "none"} /> {own ? "Ваше" : item.likes + Number(liked)}</button>
        <button onClick={onOpen}><MessageCircle size={16} /> {item.comments}</button>
        <span><Eye size={16} /> {item.views.toLocaleString("ru-RU")}</span>
        <button className="open-card" onClick={onOpen}><ArrowRight size={17} /></button>
      </div>
    </article>
  );
}

function ListingDrawer({ item, liked, own, viewerAvatar, comments, onClose, onLike, onComment, onReport }: { item: Listing; liked: boolean; own: boolean; viewerAvatar: string | null; comments: CommentItem[]; onClose: () => void; onLike: () => void; onComment: (text: string, parentId?: string) => Promise<boolean>; onReport: (targetType: "listing" | "comment", targetId: string, reason: string) => Promise<string | null> }) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [sending, setSending] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [reportTarget, setReportTarget] = useState<{ type: "listing" | "comment"; id: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportError, setReportError] = useState("");
  const [reporting, setReporting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || item.unavailable || sending) return;
    setSending(true);
    setCommentError("");
    const created = await onComment(text.trim(), replyTo?.id).catch(() => false);
    if (created) { setText(""); setReplyTo(null); }
    else setCommentError("Не удалось отправить комментарий. Проверьте вход и попробуйте снова.");
    setSending(false);
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (reportReason.trim().length < 5 || reporting) return;
    setReporting(true);
    setReportError("");
    if (!reportTarget) return;
    const error = await onReport(reportTarget.type, reportTarget.id, reportReason.trim()).catch(() => "Не удалось отправить жалобу.");
    if (error) setReportError(error);
    else { setReportTarget(null); setReportReason(""); }
    setReporting(false);
  }

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="listing-drawer" role="dialog" aria-modal="true" aria-label={item.title}>
        <button className="drawer-close" onClick={onClose} aria-label="Закрыть"><X /></button>
        <div className="drawer-image"><Image src={item.image} alt="" fill sizes="700px" unoptimized={item.image.startsWith("https://")} />{item.unavailable && <div className="drawer-unavailable">Снято с публикации</div>}</div>
        <div className="drawer-body">
          <div className="drawer-meta"><span>{item.category}</span><span><MapPin size={14} /> {item.location}</span><span><Eye size={14} /> {item.views.toLocaleString("ru-RU")}</span></div>
          <h2>{item.title}</h2>
          <div className="drawer-price">{item.price}</div>
          <p className="drawer-description">{item.description}</p>
          <div className="drawer-author"><span className="avatar"><Image src={item.author.avatar} alt="" width={38} height={38} /></span><div><small>Предложил</small><strong>{item.author.name}</strong></div><BadgeCheck size={16} /></div>
          <div className="drawer-actions">
            <a className={`button button-primary ${item.unavailable ? "disabled" : ""}`} href={item.unavailable ? undefined : item.sourceUrl} target="_blank" rel="noreferrer">Открыть на Avito <ExternalLink size={17} /></a>
            <button className={`button button-ghost ${liked ? "liked" : ""}`} onClick={onLike} disabled={own || item.unavailable} title={own ? "Свои объявления лайкать нельзя" : "Лайк"}><Heart size={17} fill={liked ? "currentColor" : "none"} /> {own ? "Ваше объявление" : item.likes + Number(liked)}</button>
            <button className="icon-button" title="Пожаловаться" onClick={() => setReportTarget({ type: "listing", id: item.id })}><Flag size={18} /></button>
          </div>
          <p className="external-note">ШМАВИТО не является Avito и не участвует в сделке. Проверяйте объявление и продавца на внешнем сайте.</p>
          <div className="comments-block">
            <div className="comments-title"><h3>Обсуждение</h3><span>{comments.length || item.comments}</span></div>
            {comments.length ? comments.map((comment) => (
              <div className={`comment ${comment.parentId ? "is-reply" : ""}`} key={comment.id}>
                <span className="avatar"><Image src={comment.avatar} alt="" width={30} height={30} /></span>
                <div><div><strong>{comment.author}</strong><small>{comment.time}</small></div><p>{comment.text}</p><div className="comment-actions">{!item.unavailable && !comment.parentId && <button onClick={() => setReplyTo(comment)}>Ответить</button>}<button onClick={() => setReportTarget({ type: "comment", id: comment.id })}><Flag size={11} /> Пожаловаться</button></div></div>
              </div>
            )) : <p className="muted">Пока без комментариев. Начните обсуждение.</p>}
            {item.unavailable ? <div className="comments-locked">Новые комментарии отключены: объявление снято.</div> : (
              <form className="comment-form" onSubmit={submit}>
                {replyTo && <div className="reply-banner">Ответ для @{replyTo.author}<button type="button" onClick={() => setReplyTo(null)}><X size={14} /></button></div>}
                <div>{viewerAvatar ? <span className="avatar"><Image src={viewerAvatar} alt="" width={30} height={30} unoptimized /></span> : <span className="avatar avatar-founder">?</span>}<textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Написать комментарий…" maxLength={500} /><button type="submit" aria-label="Отправить" disabled={!text.trim() || sending}><Send size={18} /></button></div>
                {commentError && <small className="comment-error">{commentError}</small>}
              </form>
            )}
          </div>
        </div>
        {reportTarget && <div className="drawer-report-layer"><form className="drawer-report" onSubmit={submitReport}><button type="button" className="drawer-close" onClick={() => setReportTarget(null)} aria-label="Закрыть"><X /></button><span className="section-kicker">ЖАЛОБА</span><h3>{reportTarget.type === "comment" ? "Что не так с комментарием?" : "Что не так с карточкой?"}</h3><p>Жалоба попадёт в закрытую очередь модераторов.</p><textarea autoFocus rows={5} maxLength={500} value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="Опишите нарушение или ошибку" />{reportError && <small>{reportError}</small>}<div><button type="button" className="button button-ghost" onClick={() => setReportTarget(null)}>Отмена</button><button className="button button-primary" disabled={reportReason.trim().length < 5 || reporting}>{reporting ? "Отправляем…" : "Отправить"}</button></div></form></div>}
      </aside>
    </div>
  );
}
