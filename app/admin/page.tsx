"use client";

import Image from "next/image";
import { Check, ChevronRight, CircleAlert, Clock3, Eye, FileClock, Flag, LayoutDashboard, ListFilter, MessageSquare, Search, Settings, Shield, Tags, Users, X } from "lucide-react";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";

const queueSeed = [
  { id: "1287", title: "Porsche 911 GT3 Touring", author: "apexdriver", category: "Автомобили", time: "8 минут", image: "/images/car-lineup.png" },
  { id: "1286", title: "Двигатель BMW S63 после ревизии", author: "lowboost", category: "Запчасти", time: "31 минуту", image: "/images/bmw-wheel.png" },
  { id: "1285", title: "Эвакуатор Mercedes-Benz Atego", author: "nightshift", category: "Другая техника", time: "1 час", image: "/images/motorcycle.svg" },
];

export default function AdminPage() {
  const [queue, setQueue] = useState(queueSeed);
  const [toast, setToast] = useState("");
  function decide(id: string, action: string) { setQueue((items) => items.filter((item) => item.id !== id)); setToast(`Заявка #${id}: ${action}`); window.setTimeout(() => setToast(""), 2200); }
  return (
    <div className="site-page interior admin-screen"><SiteHeader active="admin" /><div className="admin-shell">
      <aside className="admin-sidebar"><div><span>УПРАВЛЕНИЕ</span><a className="active"><LayoutDashboard /> Обзор</a><a><FileClock /> Модерация <b>{queue.length}</b></a><a><Tags /> Категории</a><a><MessageSquare /> Комментарии</a><a><Flag /> Жалобы <b>4</b></a></div><div><span>СИСТЕМА</span><a><Users /> Пользователи</a><a><Shield /> Журнал действий</a><a><Settings /> Настройки</a></div><small>DEMO MODE • v0.1.0</small></aside>
      <main className="admin-main"><div className="admin-title"><div><span className="section-kicker">ПАНЕЛЬ УПРАВЛЕНИЯ</span><h1>Добрый вечер, Раф</h1><p>Вот что происходит в ШМАВИТО прямо сейчас.</p></div><div className="admin-search"><Search /><input placeholder="Поиск по панели" /><kbd>⌘ K</kbd></div></div>
      <div className="admin-metrics"><Metric icon={<Clock3 />} value={queue.length.toString()} label="ждут проверки" detail="среднее: 24 мин" accent="amber" /><Metric icon={<Eye />} value="1 284" label="опубликовано" detail="+18 за неделю" accent="green" /><Metric icon={<Flag />} value="4" label="новые жалобы" detail="2 на комментарии" accent="red" /><Metric icon={<CircleAlert />} value="7" label="ошибок проверки" detail="за последние сутки" accent="blue" /></div>
      <section className="admin-card"><div className="admin-card-head"><div><span className="section-kicker">ОЧЕРЕДЬ</span><h2>Новые предложения</h2></div><button className="filter-button"><ListFilter /> Фильтры</button></div>{queue.length ? <div className="queue-list">{queue.map((item) => <article key={item.id}><div className="queue-image"><Image src={item.image} alt="" fill sizes="110px" /></div><div className="queue-id">#{item.id}</div><div className="queue-info"><span>{item.category}</span><h3>{item.title}</h3><p>от <b>{item.author}</b> • {item.time} назад</p></div><div className="queue-actions"><button className="approve" onClick={() => decide(item.id, "одобрена")}><Check /> Одобрить</button><button className="reject" onClick={() => decide(item.id, "отклонена")}><X /> Отклонить</button><button aria-label="Открыть"><ChevronRight /></button></div></article>)}</div> : <div className="queue-empty"><Check /><h3>Очередь разобрана</h3><p>Новых заявок пока нет.</p></div>}</section>
      <div className="admin-bottom"><section className="admin-card"><div className="admin-card-head"><div><span className="section-kicker">АКТИВНОСТЬ</span><h2>Последние действия</h2></div></div><ul className="audit-list"><li><span className="audit-icon green"><Check /></span><p><b>moderator_1</b> одобрил заявку #1284<small>12 минут назад</small></p></li><li><span className="audit-icon red"><X /></span><p><b>rafchibiskus</b> заблокировал пользователя spammer88<small>48 минут назад</small></p></li><li><span className="audit-icon blue"><Tags /></span><p><b>moderator_2</b> изменил категорию объявления #1281<small>1 час назад</small></p></li></ul></section><section className="admin-card settings-preview"><span className="section-kicker">БЫСТРЫЕ НАСТРОЙКИ</span><h2>Лимиты предложений</h2><label><span>Активных заявок</span><input value="3" readOnly /></label><label><span>Интервал, секунд</span><input value="60" readOnly /></label><button className="button button-ghost">Открыть настройки</button></section></div>
      </main></div>{toast && <div className="admin-toast"><Check /> {toast}</div>}</div>
  );
}

function Metric({ icon, value, label, detail, accent }: { icon: React.ReactNode; value: string; label: string; detail: string; accent: string }) { return <div className={`metric ${accent}`}><span>{icon}</span><div><strong>{value}</strong><p>{label}</p><small>{detail}</small></div></div>; }
