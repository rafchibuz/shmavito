"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  Flag,
  Heart,
  Maximize2,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { categories as demoCategories, initialComments, listings as demoListings } from "@/lib/demo-data";
import type { CatalogPayload, CatalogStats, CatalogViewer, Category, CommentItem, Listing } from "@/lib/types";

const VIEWED_KEY = "shmavito.viewed";
const LIKED_KEY = "shmavito.likes";
type ApiComment = { id: string; body: string; parentId: string | null; createdAt: string; author: { id: string; login: string; displayName: string; avatarUrl: string | null } };

type CatalogExperienceProps = {
  initialPayload?: CatalogPayload;
  initialCategories?: string[];
};

function listingsForViewer(payload: CatalogPayload) {
  const likedIds = payload.viewer?.likedIds || [];
  return payload.listings.map((item) => ({
    ...item,
    likes: Math.max(0, item.likes - Number(likedIds.includes(item.id))),
  }));
}

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

export function CatalogExperience({ initialPayload, initialCategories }: CatalogExperienceProps) {
  const router = useRouter();
  const hasInitialPayload = Boolean(initialPayload);
  const hydrateFromLocalStorage = !initialPayload?.viewer;
  const [category, setCategory] = useState<Category>("Все");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("new");
  const [city, setCity] = useState("Все города");
  const [availability, setAvailability] = useState<"all" | "active" | "unavailable">("all");
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [viewed, setViewed] = useState<string[]>(initialPayload?.viewer?.viewedIds || []);
  const [liked, setLiked] = useState<string[]>(initialPayload?.viewer?.likedIds || []);
  const [bookmarked, setBookmarked] = useState<string[]>(initialPayload?.viewer?.bookmarkIds || []);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [comments, setComments] = useState<Record<string, CommentItem[]>>(initialComments);
  const [catalogListings, setCatalogListings] = useState<Listing[]>(initialPayload ? listingsForViewer(initialPayload) : demoListings);
  const [catalogCategories, setCatalogCategories] = useState<readonly string[]>(initialCategories ? ["Все", ...initialCategories] : demoCategories);
  const [catalogMode, setCatalogMode] = useState<"loading" | "live" | "demo">(initialPayload ? "live" : "loading");
  const [viewer, setViewer] = useState<CatalogViewer | null>(initialPayload?.viewer || null);
  const [catalogStats, setCatalogStats] = useState<CatalogStats | null>(initialPayload?.stats || null);

  useEffect(() => {
    const hydrateLocalState = window.setTimeout(() => {
      if (hydrateFromLocalStorage) {
        setViewed(JSON.parse(localStorage.getItem(VIEWED_KEY) || "[]"));
        setLiked(JSON.parse(localStorage.getItem(LIKED_KEY) || "[]"));
      }
    }, 0);
    return () => window.clearTimeout(hydrateLocalState);
  }, [hydrateFromLocalStorage]);

  useEffect(() => {
    Promise.all([
      fetch("/api/listings", { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" }),
    ])
      .then(async ([listingResponse, categoryResponse]) => {
        if (!listingResponse.ok || !categoryResponse.ok) throw new Error("catalog unavailable");
        const listingPayload = await listingResponse.json() as CatalogPayload;
        const categoryPayload = await categoryResponse.json() as { categories: { name: string }[] };
        setCatalogStats(listingPayload.stats);
        setCatalogCategories(["Все", ...categoryPayload.categories.map((item) => item.name)]);
        setCatalogListings(listingsForViewer(listingPayload));
        setViewer(listingPayload.viewer);
        if (listingPayload.viewer) {
          setLiked(listingPayload.viewer.likedIds);
          setViewed(listingPayload.viewer.viewedIds);
          setBookmarked(listingPayload.viewer.bookmarkIds);
        }
        setComments({});
        setCatalogMode("live");
      })
      .catch(() => {
        if (!hasInitialPayload) setCatalogMode("demo");
      });
  }, [hasInitialPayload]);

  useEffect(() => {
    let active = true;
    let refreshing = false;

    async function refreshStats() {
      if (!active || refreshing || document.visibilityState === "hidden") return;
      refreshing = true;
      try {
        const response = await fetch("/api/listings", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as CatalogPayload;
        if (active) setCatalogStats(payload.stats);
      } catch {
        // Keep the last confirmed counts until the next refresh.
      } finally {
        refreshing = false;
      }
    }

    const timer = window.setInterval(refreshStats, 60_000);
    document.addEventListener("visibilitychange", refreshStats);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshStats);
    };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const result = catalogListings.filter((item) => {
      const categoryMatch = category === "Все" || item.category === category;
      const queryMatch = !normalized || `${item.title} ${item.originalTitle || ""} ${item.submitterComment || ""} ${item.description} ${item.location}`.toLowerCase().includes(normalized);
      const cityMatch = city === "Все города" || item.location === city;
      const availabilityMatch = availability === "all" || (availability === "unavailable" ? item.unavailable : !item.unavailable);
      const unseenMatch = !unseenOnly || !viewed.includes(item.id);
      const bookmarkedMatch = !bookmarkedOnly || bookmarked.includes(item.id);
      return categoryMatch && queryMatch && cityMatch && availabilityMatch && unseenMatch && bookmarkedMatch;
    });
    return result.toSorted((a, b) => {
      if (sort === "popular") return b.likes + Number(liked.includes(b.id)) - (a.likes + Number(liked.includes(a.id)));
      if (sort === "discussed") return b.comments - a.comments;
      if (sort === "old") return catalogListings.indexOf(b) - catalogListings.indexOf(a);
      return catalogListings.indexOf(a) - catalogListings.indexOf(b);
    });
  }, [availability, bookmarked, bookmarkedOnly, catalogListings, category, city, liked, query, sort, unseenOnly, viewed]);

  const cities = useMemo(() => ["Все города", ...[...new Set(catalogListings.map((item) => item.location).filter(Boolean))].toSorted((a, b) => a.localeCompare(b, "ru"))], [catalogListings]);

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

  async function toggleBookmark(id: string) {
    if (catalogMode === "live" && !viewer) {
      router.push("/api/auth/twitch/start?returnTo=/");
      return;
    }
    const previous = bookmarked;
    const next = bookmarked.includes(id) ? bookmarked.filter((itemId) => itemId !== id) : [...bookmarked, id];
    setBookmarked(next);
    if (catalogMode !== "live") return;

    try {
      const response = await fetch(`/api/listings/${encodeURIComponent(id)}/bookmark`, { method: "POST" });
      if (response.status === 401) { router.push("/api/auth/twitch/start?returnTo=/"); return; }
      const payload = await response.json() as { bookmarked?: boolean; message?: string };
      if (!response.ok) throw new Error(payload.message || "Не удалось сохранить закладку.");
      setBookmarked((current) => payload.bookmarked ? [...new Set([...current, id])] : current.filter((itemId) => itemId !== id));
    } catch {
      setBookmarked(previous);
    }
  }

  function trackOutbound(id: string) {
    if (catalogMode !== "live") return;
    fetch(`/api/listings/${encodeURIComponent(id)}/outbound`, { method: "POST", keepalive: true })
      .then(async (response) => response.ok ? response.json() as Promise<{ count: number }> : Promise.reject())
      .then(() => setCatalogStats((current) => current ? { ...current, outboundClicks: current.outboundClicks + 1 } : current))
      .catch(() => undefined);
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
          <div className="eyebrow"><Sparkles size={15} /> ШМАВИТО × STEEL</div>
          <h1>НАХОДКИ<br /><span>СТАИ</span></h1>
          <div className="hero-actions">
            <Link className="button button-primary" href="/submit">Предложить объявление <ArrowRight size={18} /></Link>
            <a className="button button-ghost" href="#catalog">Смотреть каталог</a>
          </div>
          <div className="hero-stats" aria-label="Статистика каталога">
            <div><strong>{catalogStats ? catalogStats.findings.toLocaleString("ru-RU") : "—"}</strong><span>находки</span></div>
            <div><strong>{catalogStats ? catalogStats.pending.toLocaleString("ru-RU") : "—"}</strong><span>на модерации</span></div>
            <div><strong>{catalogStats ? catalogStats.outboundClicks.toLocaleString("ru-RU") : "—"}</strong><span>переходов</span></div>
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
          <label className="select-box"><MapPin size={17} /><select value={city} onChange={(event) => setCity(event.target.value)} aria-label="Фильтр по городу">{cities.map((item) => <option value={item} key={item}>{item}</option>)}</select><ChevronDown size={15} /></label>
          <label className="select-box"><Eye size={17} /><select value={availability} onChange={(event) => setAvailability(event.target.value as "all" | "active" | "unavailable")} aria-label="Фильтр по доступности"><option value="all">Все объявления</option><option value="active">Только активные</option><option value="unavailable">Снятые с публикации</option></select><ChevronDown size={15} /></label>
          <div className="catalog-toggle-filters">
            <label className="check-chip"><input type="checkbox" checked={unseenOnly} onChange={(event) => setUnseenOnly(event.target.checked)} /><span /> Непросмотренные</label>
            <label className="check-chip"><input type="checkbox" checked={bookmarkedOnly} onChange={(event) => setBookmarkedOnly(event.target.checked)} /><span /> Закладки</label>
          </div>
        </div>

        <div className="category-row" aria-label="Категории">
          {catalogCategories.map((item) => <button key={item} className={item === category ? "active" : ""} onClick={() => setCategory(item)}>{item}{item !== "Все" && <small>{catalogListings.filter((listing) => listing.category === item).length}</small>}</button>)}
        </div>

        <div className="result-bar"><span>Найдено: <b>{filtered.length}</b></span></div>

        {filtered.length ? (
          <div className="listing-grid">
            {filtered.map((item) => (
              <ListingCard key={item.id} item={item} viewed={viewed.includes(item.id)} liked={liked.includes(item.id)} bookmarked={bookmarked.includes(item.id)} own={catalogMode === "live" ? item.author.id === viewer?.id : item.author.name === "rafchibiskus"} onOpen={() => openListing(item)} onLike={() => toggleLike(item.id)} onBookmark={() => toggleBookmark(item.id)} onOutbound={() => trackOutbound(item.id)} />
            ))}
          </div>
        ) : (
          <div className="empty-state"><Search size={30} /><h3>Ничего не найдено</h3><p>Попробуйте другой запрос или сбросьте фильтры.</p><button className="button button-ghost" onClick={() => { setCategory("Все"); setQuery(""); setCity("Все города"); setAvailability("all"); setUnseenOnly(false); setBookmarkedOnly(false); }}>Сбросить фильтры</button></div>
        )}
      </main>

      <section className="submit-cta">
        <div className="shell submit-cta-inner"><div><span className="section-kicker">НАШЛИ ЧТО-ТО ИНТЕРЕСНОЕ?</span><h2>Отправьте ссылку — остальное сделаем мы</h2><p>Вставьте объявление Avito, выберите категорию и проверьте данные.</p></div><Link className="button button-light" href="/submit">Предложить объявление <ArrowRight size={18} /></Link></div>
      </section>

      {selected && <ListingDrawer key={selected.id} item={selected} liked={liked.includes(selected.id)} bookmarked={bookmarked.includes(selected.id)} own={catalogMode === "live" ? selected.author.id === viewer?.id : selected.author.name === "rafchibiskus"} viewerAvatar={viewer?.avatarUrl || null} comments={comments[selected.id] || []} onClose={() => setSelected(null)} onLike={() => toggleLike(selected.id)} onBookmark={() => toggleBookmark(selected.id)} onOutbound={() => trackOutbound(selected.id)} onComment={(text, parent) => addComment(selected.id, text, parent)} onReport={reportTarget} />}
    </>
  );
}

function ListingCard({ item, viewed, liked, bookmarked, own, onOpen, onLike, onBookmark, onOutbound }: { item: Listing; viewed: boolean; liked: boolean; bookmarked: boolean; own: boolean; onOpen: () => void; onLike: () => void; onBookmark: () => void; onOutbound: () => void }) {
  const images = item.images?.length ? item.images : [item.image];
  const [imageIndex, setImageIndex] = useState(0);

  function moveImage(direction: -1 | 1) {
    setImageIndex((current) => (current + direction + images.length) % images.length);
  }

  return (
    <article className={`listing-card ${viewed ? "is-viewed" : ""} ${item.unavailable ? "is-unavailable" : ""}`}>
      <div className="card-media">
        <button className="card-media-open" onClick={onOpen} aria-label={`Открыть ${item.title}`}>
          <Image src={images[imageIndex]} alt={`${item.title}, фото ${imageIndex + 1}`} fill sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw" unoptimized={images[imageIndex].startsWith("https://")} />
        </button>
        <span className="category-pill">{item.category}</span>
        {item.unavailable && <span className="unavailable-pill">Снято с публикации</span>}
        {viewed && !item.unavailable && <span className="viewed-pill"><Eye size={13} /> Просмотрено</span>}
        {images.length > 1 && <>
          <button className="gallery-arrow gallery-arrow-left" onClick={() => moveImage(-1)} aria-label="Предыдущее фото"><ChevronLeft /></button>
          <button className="gallery-arrow gallery-arrow-right" onClick={() => moveImage(1)} aria-label="Следующее фото"><ChevronRight /></button>
          <span className="gallery-count">{imageIndex + 1} / {images.length}</span>
        </>}
      </div>
      <div className="card-content">
        <div className="card-summary"><div className="card-title-stack"><button className="card-title" onClick={onOpen}>{item.title}</button><p className="card-original-title">{item.originalTitle || item.title}</p></div><div className="card-price-location"><strong>{item.price}</strong><span><MapPin size={13} /> {item.location}</span></div></div>
        {item.submitterComment && <button className="card-submit-comment" onClick={onOpen}>«{item.submitterComment}»</button>}
        {(item.year || item.mileage) && <div className="spec-row">{item.year && <span>{item.year} год</span>}{item.mileage && <span>{item.mileage}</span>}</div>}
        <div className="author-row"><span className="avatar"><Image src={item.author.avatar} alt="" width={30} height={30} /></span><div><b>{item.author.name}</b><small>{item.published}</small></div><BadgeCheck size={15} /></div>
      </div>
      <div className="card-footer">
        <button className={liked ? "liked" : ""} disabled={own || item.unavailable} onClick={onLike} title={own ? "Это ваше предложение — свои объявления лайкать нельзя" : "Лайк"}><Heart size={16} fill={liked ? "currentColor" : "none"} /> {own ? "Ваше" : item.likes + Number(liked)}</button>
        <button className={bookmarked ? "bookmarked" : ""} onClick={onBookmark} title={bookmarked ? "Убрать из закладок" : "Сохранить в закладки"} aria-label={bookmarked ? "Убрать из закладок" : "Сохранить в закладки"}><Bookmark size={16} fill={bookmarked ? "currentColor" : "none"} /></button>
        <button onClick={onOpen}><MessageCircle size={16} /> {item.comments}</button>
        <span><Eye size={16} /> {item.views.toLocaleString("ru-RU")}</span>
        <button className="open-card" onClick={onOpen}>Подробнее <ArrowRight size={15} /></button>
        {!item.unavailable && <a className="card-avito-link" href={item.sourceUrl} target="_blank" rel="noreferrer" onClick={onOutbound}>На Avito <ExternalLink size={15} /></a>}
      </div>
    </article>
  );
}

function ListingDrawer({ item, liked, bookmarked, own, viewerAvatar, comments, onClose, onLike, onBookmark, onOutbound, onComment, onReport }: { item: Listing; liked: boolean; bookmarked: boolean; own: boolean; viewerAvatar: string | null; comments: CommentItem[]; onClose: () => void; onLike: () => void; onBookmark: () => void; onOutbound: () => void; onComment: (text: string, parentId?: string) => Promise<boolean>; onReport: (targetType: "listing" | "comment", targetId: string, reason: string) => Promise<string | null> }) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [sending, setSending] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [reportTarget, setReportTarget] = useState<{ type: "listing" | "comment"; id: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportError, setReportError] = useState("");
  const [reporting, setReporting] = useState(false);
  const images = item.images?.length ? item.images : [item.image];
  const [imageIndex, setImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (lightboxOpen) setLightboxOpen(false);
        else onClose();
      }
      if (event.key === "ArrowLeft" && images.length > 1) setImageIndex((current) => (current - 1 + images.length) % images.length);
      if (event.key === "ArrowRight" && images.length > 1) setImageIndex((current) => (current + 1) % images.length);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [images.length, lightboxOpen, onClose]);

  function moveImage(direction: -1 | 1) {
    setImageIndex((current) => (current + direction + images.length) % images.length);
    setZoom(1);
  }

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
        <div className="drawer-image">
          <button className="drawer-image-open" onClick={() => { setZoom(1); setLightboxOpen(true); }} aria-label="Увеличить фотографию">
            <Image src={images[imageIndex]} alt={`${item.title}, фото ${imageIndex + 1}`} fill sizes="700px" unoptimized={images[imageIndex].startsWith("https://")} />
            <span><Maximize2 size={16} /> Увеличить</span>
          </button>
          {images.length > 1 && <>
            <button className="gallery-arrow gallery-arrow-left" onClick={() => moveImage(-1)} aria-label="Предыдущее фото"><ChevronLeft /></button>
            <button className="gallery-arrow gallery-arrow-right" onClick={() => moveImage(1)} aria-label="Следующее фото"><ChevronRight /></button>
            <span className="gallery-count">{imageIndex + 1} / {images.length}</span>
          </>}
          {item.unavailable && <div className="drawer-unavailable">Снято с публикации</div>}
        </div>
        <div className="drawer-body">
          <div className="drawer-meta"><span>{item.category}</span><span><MapPin size={14} /> {item.location}</span><span><Eye size={14} /> {item.views.toLocaleString("ru-RU")}</span></div>
          <h2>{item.title}</h2>
          <p className="drawer-original-title">Оригинал на Avito: {item.originalTitle || item.title}</p>
          <div className="drawer-price">{item.price}</div>
          {item.submitterComment && <div className="drawer-submitter-comment"><small>Комментарий автора</small><p>«{item.submitterComment}»</p></div>}
          <h3 className="drawer-description-title">Описание на Avito</h3>
          <p className="drawer-description">{item.description}</p>
          <div className="drawer-author"><span className="avatar"><Image src={item.author.avatar} alt="" width={38} height={38} /></span><div><small>Предложил</small><strong>{item.author.name}</strong></div><BadgeCheck size={16} /></div>
          <div className="drawer-actions">
            <a className={`button button-primary ${item.unavailable ? "disabled" : ""}`} href={item.unavailable ? undefined : item.sourceUrl} target="_blank" rel="noreferrer" onClick={item.unavailable ? undefined : onOutbound}>Открыть на Avito <ExternalLink size={17} /></a>
            <button className={`button button-ghost ${liked ? "liked" : ""}`} onClick={onLike} disabled={own || item.unavailable} title={own ? "Свои объявления лайкать нельзя" : "Лайк"}><Heart size={17} fill={liked ? "currentColor" : "none"} /> {own ? "Ваше объявление" : item.likes + Number(liked)}</button>
            <button className={`button button-ghost ${bookmarked ? "bookmarked" : ""}`} onClick={onBookmark}><Bookmark size={17} fill={bookmarked ? "currentColor" : "none"} /> {bookmarked ? "В закладках" : "В закладки"}</button>
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
        {lightboxOpen && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={`Фотографии ${item.title}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setLightboxOpen(false); }}>
          <button className="gallery-lightbox-close" onClick={() => setLightboxOpen(false)} aria-label="Закрыть"><X /></button>
          <div className="gallery-lightbox-toolbar"><button onClick={() => setZoom((value) => Math.max(1, value - .5))} disabled={zoom <= 1} aria-label="Уменьшить"><Minus /></button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(3, value + .5))} disabled={zoom >= 3} aria-label="Увеличить"><Plus /></button></div>
          <div className="gallery-lightbox-scroll"><div style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}><Image src={images[imageIndex]} alt={`${item.title}, фото ${imageIndex + 1}`} fill sizes="100vw" unoptimized={images[imageIndex].startsWith("https://")} /></div></div>
          {images.length > 1 && <><button className="gallery-lightbox-arrow is-left" onClick={() => moveImage(-1)} aria-label="Предыдущее фото"><ChevronLeft /></button><button className="gallery-lightbox-arrow is-right" onClick={() => moveImage(1)} aria-label="Следующее фото"><ChevronRight /></button><span className="gallery-lightbox-count">{imageIndex + 1} / {images.length}</span></>}
        </div>}
      </aside>
    </div>
  );
}
