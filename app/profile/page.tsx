import Image from "next/image";
import Link from "next/link";
import { Bell, CheckCircle2, Clock3, Heart, MessageCircle, Plus, XCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const submissions = [
  { title: "Кованые диски R21 комплект", category: "Запчасти", status: "approved", date: "16 октября", image: "/images/bmw-wheel.png" },
  { title: "BMW M4 Competition 2022", category: "Автомобили", status: "pending", date: "18 октября", image: "/images/car-lineup.png" },
  { title: "Комплект карбоновых элементов", category: "Запчасти", status: "rejected", date: "12 октября", image: "/images/hero-car.png" },
];

export default function ProfilePage() {
  return (
    <div className="site-page interior"><SiteHeader active="profile" /><main className="shell profile-page">
      <section className="profile-hero"><div className="large-avatar">R</div><div><span className="section-kicker">TWITCH PROFILE</span><h1>rafchibiskus</h1><p>Основатель проекта • Twitch ID будет сохранён после подключения OAuth</p></div><Link href="/submit" className="button button-primary"><Plus size={17} /> Новое предложение</Link></section>
      <div className="profile-stats"><div><strong>12</strong><span>предложений</span></div><div><strong>9</strong><span>опубликовано</span></div><div><strong>1 284</strong><span>получено лайков</span></div><div><strong>6 410</strong><span>просмотров</span></div></div>
      <div className="profile-grid"><section><div className="block-heading"><div><span className="section-kicker">ИСТОРИЯ</span><h2>Мои предложения</h2></div><button>Все статусы</button></div><div className="submission-list">{submissions.map((item) => <article key={item.title}><div className="submission-image"><Image src={item.image} alt="" fill sizes="100px" /></div><div className="submission-main"><span>{item.category}</span><h3>{item.title}</h3><small>{item.date}</small>{item.status === "rejected" && <p>Причина: недостаточно фотографий товара.</p>}</div><Status status={item.status} /></article>)}</div></section>
      <aside className="notifications"><div className="block-heading"><div><span className="section-kicker">ЦЕНТР</span><h2>Уведомления</h2></div><Bell size={20} /></div><div className="notification-item unread"><span><CheckCircle2 /></span><div><strong>Заявка опубликована</strong><p>«Кованые диски R21» уже в каталоге.</p><small>2 часа назад</small></div></div><div className="notification-item unread"><span><MessageCircle /></span><div><strong>Новый ответ</strong><p>lowboost ответил на ваш комментарий.</p><small>5 часов назад</small></div></div><div className="notification-item"><span><Heart /></span><div><strong>50 лайков</strong><p>Ваше предложение набирает популярность.</p><small>вчера</small></div></div></aside></div>
    </main></div>
  );
}

function Status({ status }: { status: string }) {
  if (status === "approved") return <div className="status approved"><CheckCircle2 /> Опубликовано</div>;
  if (status === "pending") return <div className="status pending"><Clock3 /> На проверке</div>;
  return <div className="status rejected"><XCircle /> Отклонено</div>;
}
