"use client";

import { ArrowLeft, ArrowRight, Check, ImagePlus, Link2, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type FormCategory = { id: string; name: string; slug: string };
type ImportPayload = {
  mode: "automatic" | "manual";
  normalizedUrl: string;
  title: string;
  description: string;
  price: number | null;
  city: string;
  imageUrls: string[];
  importedFields: string[];
  warning: string | null;
  message?: string;
};

export function SubmitForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<"automatic" | "manual" | null>(null);
  const [importWarning, setImportWarning] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [categories, setCategories] = useState<FormCategory[]>([]);
  const [categoriesError, setCategoriesError] = useState("");
  const [error, setError] = useState("");
  const [submissionId, setSubmissionId] = useState("1285");

  useEffect(() => {
    fetch("/api/categories")
      .then(async (response) => {
        if (!response.ok) throw new Error("categories unavailable");
        return response.json() as Promise<{ categories: FormCategory[] }>;
      })
      .then((payload) => {
        if (payload.categories.length) {
          setCategories(payload.categories);
          setCategoriesError("");
        }
      })
      .catch(() => setCategoriesError("Категории сейчас недоступны. Обновите страницу после запуска базы данных."));
  }, []);

  const validUrl = /^https:\/\/(www\.)?avito\.ru\//i.test(url);

  async function importListing(event: FormEvent) {
    event.preventDefault();
    if (!validUrl || !category) return;
    setLoading(true);
    setError("");
    setImportWarning("");
    try {
      const response = await fetch("/api/import/avito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: url }),
      });
      const payload = await response.json() as ImportPayload;
      if (!response.ok) throw new Error(payload.message || "Не удалось прочитать объявление.");
      setUrl(payload.normalizedUrl);
      setTitle(payload.title);
      setDescription(payload.description);
      setPrice(payload.price === null ? "" : payload.price.toLocaleString("ru-RU"));
      setCity(payload.city);
      setImageUrls(payload.imageUrls);
      setImportMode(payload.mode);
      setImportWarning(payload.warning || "");
      setStep(2);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Не удалось прочитать объявление.");
    } finally {
      setLoading(false);
    }
  }

  if (step === 3) {
    return (
      <div className="success-panel">
        <span className="success-icon"><Check /></span>
        <span className="section-kicker">ЗАЯВКА #{submissionId}</span>
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
            <label className="field"><span>Категория <b>*</b></span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Выберите категорию</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small>Без категории предложение отправить нельзя. Модератор сможет исправить выбор.</small></label>
            {categoriesError && <div className="info-box form-error"><ShieldCheck size={20} /><div><strong>Категории не загрузились</strong><p>{categoriesError}</p></div></div>}
            <div className="info-box"><Sparkles size={20} /><div><strong>Автоматический импорт</strong><p>Если Avito не отдаст данные, откроется ручная форма. Ссылка и выбранная категория сохранятся.</p></div></div>
            {error && <div className="info-box form-error"><ShieldCheck size={20} /><div><strong>Не удалось продолжить</strong><p>{error}</p></div></div>}
            <button className="button button-primary form-submit" disabled={!validUrl || !category || loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Получаем данные…</> : <>Продолжить <ArrowRight size={18} /></>}</button>
          </form>
        ) : (
          <form onSubmit={async (event) => {
            event.preventDefault();
            if (!agreed || loading) return;
            setError("");
            setLoading(true);
            try {
              const response = await fetch("/api/submissions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sourceUrl: url,
                  categoryId: category,
                  title,
                  description,
                  price: Number(price.replace(/\D/g, "")) || null,
                  city,
                  imageUrls,
                }),
              });
              const payload = await response.json() as { submission?: { id: string }; message?: string };
              if (!response.ok) throw new Error(payload.message || "Не удалось отправить заявку.");
              setSubmissionId(payload.submission?.id.slice(-6).toUpperCase() || "NEW");
              setStep(3);
            } catch (submissionError) {
              setError(submissionError instanceof Error ? submissionError.message : "Не удалось отправить заявку.");
            } finally {
              setLoading(false);
            }
          }}>
            <button type="button" className="back-link" onClick={() => setStep(1)}><ArrowLeft size={16} /> Изменить ссылку</button>
            <span className="section-kicker">ПРОВЕРЬТЕ ДАННЫЕ</span>
            <h1>Всё выглядит правильно?</h1>
            <p className="lead">{importMode === "automatic" ? "Мы получили доступные данные объявления. Проверьте их перед отправкой." : "Автоматический доступ ограничен. Заполните основные данные вручную."}</p>
            {importWarning && <div className="info-box import-warning"><Sparkles size={20} /><div><strong>{importMode === "automatic" ? "Импорт выполнен частично" : "Ручной режим"}</strong><p>{importWarning}</p></div></div>}
            <div className="import-preview"><div className={`upload-placeholder ${imageUrls[0] ? "has-image" : ""}`} style={imageUrls[0] ? { backgroundImage: `linear-gradient(rgba(8,10,13,.08),rgba(8,10,13,.5)), url(${JSON.stringify(imageUrls[0]).slice(1, -1)})` } : undefined}>{!imageUrls[0] && <ImagePlus />}<span>{imageUrls[0] ? "Фото с Avito" : "Фото не получено"}</span><small>{imageUrls.length ? `${imageUrls.length} фото импортировано` : "Модератор увидит ссылку"}</small></div><div className="preview-fields"><label className="field"><span>Название <b>*</b></span><input required minLength={2} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название объявления" /></label><div className="field-pair"><label className="field"><span>Цена, ₽</span><input inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Не указана" /></label><label className="field"><span>Город</span><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Не указан" /></label></div></div></div>
            <label className="field"><span>Описание</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} /></label>
            <label className="rules-check"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /><span><Check size={14} /></span><p>Я подтверждаю, что предложение не нарушает правила, не содержит запрещённых товаров и персональных данных.</p></label>
            {error && <div className="info-box form-error"><ShieldCheck size={20} /><div><strong>Не удалось отправить</strong><p>{error}</p></div></div>}
            <button className="button button-primary form-submit" disabled={!agreed || !title.trim() || loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Отправляем…</> : <>Отправить на модерацию <ArrowRight size={18} /></>}</button>
          </form>
        )}
      </section>
      <aside className="form-aside"><div className="aside-steel" /><ShieldCheck size={28} /><span className="section-kicker">КАК ЭТО РАБОТАЕТ</span><h2>Сначала проверка.<br />Потом каталог.</h2><ol><li><b>01</b><span><strong>Вы отправляете</strong>Ссылка и основные данные</span></li><li><b>02</b><span><strong>Модератор проверяет</strong>Исправляет категорию и текст</span></li><li><b>03</b><span><strong>Карточка публикуется</strong>Сообщество обсуждает находку</span></li></ol><p>Текущий лимит: <strong>3 активные заявки</strong></p></aside>
    </div>
  );
}
