"use client";

import Image from "next/image";
import Link from "next/link";
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

export function CatalogExperience() {
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
        const listingPayload = await listingResponse.json() as { listings: Listing[] };
        const categoryPayload = await categoryResponse.json() as { categories: { name: string }[] };
        setCatalogCategories(["Все", ...categoryPayload.categories.map((item) => item.name)]);
        if (listingPayload.listings.length) {
          setCatalogListings(listingPayload.listings);
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
    }
    setSelected(item);
  }

  function toggleLike(id: string) {
    const item = catalogListings.find((listing) => listing.id === id);
    if (!item || item.author.name === "rafchibiskus" || item.unavailable) return;
    const next = liked.includes(id) ? liked.filter((itemId) => itemId !== id) : [...liked, id];
    setLiked(next);
    localStorage.setItem(LIKED_KEY, JSON.stringify(next));
  }

  function addComment(listingId: string, text: string, parentId?: string) {
    const next: CommentItem = {
      id: crypto.randomUUID(),
      author: "rafchibiskus",
      avatar: "/images/avatar-founder.svg",
      text,
      time: "только что",
      parentId,
    };
    setComments((current) => ({ ...current, [listingId]: [...(current[listingId] || []), next] }));
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
        <div className="steel-card">
          <Image src="/images/steel-portrait.png" alt="STEEL" fill sizes="340px" loading="eager" />
          <div><span>CURATED BY</span><strong>STEEL</strong><small>twitch.tv/steel</small></div>
        </div>
      </section>

      <main className="catalog-section shell" id="catalog">
        <div className="section-heading">
          <div><span className="section-kicker">КАТАЛОГ</span><h2>Свежие предложения</h2></div>
          <p>Все карточки проверены модераторами. Серые вы уже открывали.</p>
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
              <ListingCard key={item.id} item={item} viewed={viewed.includes(item.id)} liked={liked.includes(item.id)} onOpen={() => openListing(item)} onLike={() => toggleLike(item.id)} />
            ))}
          </div>
        ) : (
          <div className="empty-state"><Search size={30} /><h3>Ничего не найдено</h3><p>Попробуйте другой запрос или сбросьте фильтры.</p><button className="button button-ghost" onClick={() => { setCategory("Все"); setQuery(""); setUnseenOnly(false); }}>Сбросить фильтры</button></div>
        )}
      </main>

      <section className="submit-cta">
        <div className="shell submit-cta-inner"><div><span className="section-kicker">НАШЛИ ЧТО-ТО ИНТЕРЕСНОЕ?</span><h2>Отправьте ссылку — остальное сделаем мы</h2><p>Вставьте объявление Avito, выберите категорию и проверьте данные.</p></div><Link className="button button-light" href="/submit">Предложить объявление <ArrowRight size={18} /></Link></div>
      </section>

      {selected && <ListingDrawer item={selected} liked={liked.includes(selected.id)} comments={comments[selected.id] || []} onClose={() => setSelected(null)} onLike={() => toggleLike(selected.id)} onComment={(text, parent) => addComment(selected.id, text, parent)} />}
    </>
  );
}

function ListingCard({ item, viewed, liked, onOpen, onLike }: { item: Listing; viewed: boolean; liked: boolean; onOpen: () => void; onLike: () => void }) {
  const own = item.author.name === "rafchibiskus";
  return (
    <article className={`listing-card ${viewed ? "is-viewed" : ""} ${item.unavailable ? "is-unavailable" : ""}`}>
      <button className="card-media" onClick={onOpen} aria-label={`Открыть ${item.title}`}>
        <Image src={item.image} alt="" fill sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw" />
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
        <button className={liked ? "liked" : ""} disabled={own || item.unavailable} onClick={onLike} title={own ? "Нельзя лайкнуть собственное предложение" : "Лайк"}><Heart size={16} fill={liked ? "currentColor" : "none"} /> {item.likes + Number(liked)}</button>
        <button onClick={onOpen}><MessageCircle size={16} /> {item.comments}</button>
        <span><Eye size={16} /> {item.views.toLocaleString("ru-RU")}</span>
        <button className="open-card" onClick={onOpen}><ArrowRight size={17} /></button>
      </div>
    </article>
  );
}

function ListingDrawer({ item, liked, comments, onClose, onLike, onComment }: { item: Listing; liked: boolean; comments: CommentItem[]; onClose: () => void; onLike: () => void; onComment: (text: string, parentId?: string) => void }) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || item.unavailable) return;
    onComment(text.trim(), replyTo?.id);
    setText("");
    setReplyTo(null);
  }

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="listing-drawer" role="dialog" aria-modal="true" aria-label={item.title}>
        <button className="drawer-close" onClick={onClose} aria-label="Закрыть"><X /></button>
        <div className="drawer-image"><Image src={item.image} alt="" fill sizes="700px" />{item.unavailable && <div className="drawer-unavailable">Снято с публикации</div>}</div>
        <div className="drawer-body">
          <div className="drawer-meta"><span>{item.category}</span><span><MapPin size={14} /> {item.location}</span><span><Eye size={14} /> {item.views.toLocaleString("ru-RU")}</span></div>
          <h2>{item.title}</h2>
          <div className="drawer-price">{item.price}</div>
          <p className="drawer-description">{item.description}</p>
          <div className="drawer-author"><span className="avatar"><Image src={item.author.avatar} alt="" width={38} height={38} /></span><div><small>Предложил</small><strong>{item.author.name}</strong></div><BadgeCheck size={16} /></div>
          <div className="drawer-actions">
            <a className={`button button-primary ${item.unavailable ? "disabled" : ""}`} href={item.unavailable ? undefined : item.sourceUrl} target="_blank" rel="noreferrer">Открыть на Avito <ExternalLink size={17} /></a>
            <button className={`button button-ghost ${liked ? "liked" : ""}`} onClick={onLike} disabled={item.author.name === "rafchibiskus" || item.unavailable}><Heart size={17} fill={liked ? "currentColor" : "none"} /> {item.likes + Number(liked)}</button>
            <button className="icon-button" title="Пожаловаться"><Flag size={18} /></button>
          </div>
          <p className="external-note">ШМАВИТО не является Avito и не участвует в сделке. Проверяйте объявление и продавца на внешнем сайте.</p>
          <div className="comments-block">
            <div className="comments-title"><h3>Обсуждение</h3><span>{comments.length || item.comments}</span></div>
            {comments.length ? comments.map((comment) => (
              <div className={`comment ${comment.parentId ? "is-reply" : ""}`} key={comment.id}>
                <span className="avatar"><Image src={comment.avatar} alt="" width={30} height={30} /></span>
                <div><div><strong>{comment.author}</strong><small>{comment.time}</small></div><p>{comment.text}</p>{!item.unavailable && !comment.parentId && <button onClick={() => setReplyTo(comment)}>Ответить</button>}</div>
              </div>
            )) : <p className="muted">Пока без комментариев. Начните обсуждение.</p>}
            {item.unavailable ? <div className="comments-locked">Новые комментарии отключены: объявление снято.</div> : (
              <form className="comment-form" onSubmit={submit}>
                {replyTo && <div className="reply-banner">Ответ для @{replyTo.author}<button type="button" onClick={() => setReplyTo(null)}><X size={14} /></button></div>}
                <div><span className="avatar avatar-founder">R</span><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Написать комментарий…" maxLength={500} /><button type="submit" aria-label="Отправить" disabled={!text.trim()}><Send size={18} /></button></div>
              </form>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
