"use client";

import { ArrowLeft, ArrowRight, Check, ImagePlus, Link2, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

const formCategories = ["Автомобили", "Другая техника", "Недвижимость", "Запчасти", "Разное"];

export function SubmitForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("BMW M3 Competition, 2023");
  const [price, setPrice] = useState("9 850 000");
  const [city, setCity] = useState("Москва");
  const [description, setDescription] = useState("Автоматически полученное описание объявления. Проверьте данные перед отправкой.");
  const [agreed, setAgreed] = useState(false);

  const validUrl = /^https:\/\/(www\.)?avito\.ru\//i.test(url);

  function importListing(event: FormEvent) {
    event.preventDefault();
    if (!validUrl || !category) return;
    setLoading(true);
    window.setTimeout(() => { setLoading(false); setStep(2); }, 900);
  }

  if (step === 3) {
    return (
      <div className="success-panel">
        <span className="success-icon"><Check /></span>
        <span className="section-kicker">ЗАЯВКА #1285</span>
        <h1>Отправлено на модерацию</h1>
        <p>Мы сообщим в личном кабинете, когда модератор примет решение.</p>
        <div className="status-timeline"><span className="done">Заявка создана</span><span className="active">На проверке</span><span>Публикация</span></div>
        <div className="success-actions"><Link href="/profile" className="button button-primary">Мои предложения</Link><Link href="/" className="button button-ghost">Вернуться в каталог</Link></div>
      </div>
    );
  }

  return (
    <div className="form-layout">
      <section className="form-panel">
        <div className="form-progress"><span className={step >= 1 ? "active" : ""}>1 <small>Ссылка</small></span><i /><span className={step >= 2 ? "active" : ""}>2 <small>Проверка</small></span><i /><span>3 <small>Готово</small></span></div>
        {step === 1 ? (
          <form onSubmit={importListing}>
            <span className="section-kicker">НОВОЕ ПРЕДЛОЖЕНИЕ</span>
            <h1>Что вы нашли?</h1>
            <p className="lead">Вставьте ссылку на объявление Avito. Мы попробуем забрать фото, название, цену и описание автоматически.</p>
            <label className="field"><span>Ссылка на Avito</span><div className={`field-input ${url && !validUrl ? "invalid" : ""}`}><Link2 size={19} /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.avito.ru/..." autoFocus /></div>{url && !validUrl && <small>Нужна полная HTTPS-ссылка на avito.ru</small>}</label>
            <label className="field"><span>Категория <b>*</b></span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Выберите категорию</option>{formCategories.map((item) => <option key={item}>{item}</option>)}</select><small>Без категории предложение отправить нельзя. Модератор сможет исправить выбор.</small></label>
            <div className="info-box"><Sparkles size={20} /><div><strong>Автоматический импорт</strong><p>Если Avito не отдаст данные, откроется ручная форма. Ссылка и выбранная категория сохранятся.</p></div></div>
            <button className="button button-primary form-submit" disabled={!validUrl || !category || loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Получаем данные…</> : <>Продолжить <ArrowRight size={18} /></>}</button>
          </form>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); if (agreed) setStep(3); }}>
            <button type="button" className="back-link" onClick={() => setStep(1)}><ArrowLeft size={16} /> Изменить ссылку</button>
            <span className="section-kicker">ПРОВЕРЬТЕ ДАННЫЕ</span>
            <h1>Всё выглядит правильно?</h1>
            <p className="lead">Это демонстрация результата импорта. Перед отправкой можно исправить любое поле.</p>
            <div className="import-preview"><div className="upload-placeholder"><ImagePlus /><span>Обложка объявления</span><small>До 5 изображений</small></div><div className="preview-fields"><label className="field"><span>Название</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label><div className="field-pair"><label className="field"><span>Цена, ₽</span><input value={price} onChange={(event) => setPrice(event.target.value)} /></label><label className="field"><span>Город</span><input value={city} onChange={(event) => setCity(event.target.value)} /></label></div></div></div>
            <label className="field"><span>Описание</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} /></label>
            <label className="rules-check"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /><span><Check size={14} /></span><p>Я подтверждаю, что предложение не нарушает правила, не содержит запрещённых товаров и персональных данных.</p></label>
            <button className="button button-primary form-submit" disabled={!agreed}>Отправить на модерацию <ArrowRight size={18} /></button>
          </form>
        )}
      </section>
      <aside className="form-aside"><div className="aside-steel" /><ShieldCheck size={28} /><span className="section-kicker">КАК ЭТО РАБОТАЕТ</span><h2>Сначала проверка.<br />Потом каталог.</h2><ol><li><b>01</b><span><strong>Вы отправляете</strong>Ссылка и основные данные</span></li><li><b>02</b><span><strong>Модератор проверяет</strong>Исправляет категорию и текст</span></li><li><b>03</b><span><strong>Карточка публикуется</strong>Сообщество обсуждает находку</span></li></ol><p>Текущий лимит: <strong>3 активные заявки</strong></p></aside>
    </div>
  );
}
