"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { socialIconNames, socialIconPaths, socialIconSource, type SocialLink } from "@/lib/social-links-config";

const iconChoices = Object.entries(socialIconNames) as [keyof typeof socialIconPaths, string][];

export function SocialLinksSettings({ notify }: { notify: (message: string) => void }) {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [editable, setEditable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings/social-links", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { links?: SocialLink[]; editable?: boolean; message?: string };
        if (!response.ok) throw new Error(data.message || "Не удалось загрузить соцсети.");
        setLinks(data.links || []);
        setEditable(Boolean(data.editable));
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Ошибка загрузки."))
      .finally(() => setLoading(false));
  }, []);

  function update(id: string, patch: Partial<SocialLink>) {
    setLinks((current) => current.map((link) => link.id === id ? { ...link, ...patch } : link));
  }

  function move(index: number, direction: -1 | 1) {
    setLinks((current) => {
      const copy = [...current];
      [copy[index], copy[index + direction]] = [copy[index + direction], copy[index]];
      return copy;
    });
  }

  async function upload(id: string, file?: File) {
    if (!file) return;
    if (!(["image/png", "image/jpeg", "image/webp"].includes(file.type)) || file.size > 80 * 1024) {
      setError("Иконка должна быть PNG, JPEG или WebP размером до 80 КБ.");
      return;
    }
    const image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Не удалось прочитать иконку."));
      reader.readAsDataURL(file);
    }).catch((cause) => { setError(cause instanceof Error ? cause.message : "Ошибка чтения иконки."); return ""; });
    if (image) { update(id, { icon: "custom", customIcon: image }); setError(""); }
  }

  async function save() {
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings/social-links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(links),
      });
      const result = await response.json() as { links?: SocialLink[]; message?: string };
      if (!response.ok) throw new Error(result.message || "Не удалось сохранить соцсети.");
      setLinks(result.links || []);
      notify("Соцсети сохранены");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка сохранения.");
    } finally { setSaving(false); }
  }

  return <section className="admin-card settings-form social-settings">
    <span className="section-kicker">ГЛАВНАЯ СТРАНИЦА</span>
    <h2>Соцсети STEEL</h2>
    <p>Ссылки показываются под счётчиками на главной. Можно добавить до восьми и расположить их в нужном порядке.</p>
    {loading ? <p>Загружаем…</p> : <div className="social-settings-list">
      {links.map((link, index) => <div className="social-settings-row" key={link.id}>
        <div className="social-settings-icon"><Image src={socialIconSource(link)} alt="" width={46} height={46} unoptimized={link.icon === "custom"} /></div>
        <div className="social-settings-fields">
          <label><span>Название</span><input value={link.label} maxLength={40} disabled={!editable} onChange={(event) => update(link.id, { label: event.target.value })} /></label>
          <label><span>Ссылка HTTPS</span><input type="url" value={link.url} maxLength={500} disabled={!editable} onChange={(event) => update(link.id, { url: event.target.value })} /></label>
          <label><span>Иконка</span><select value={link.icon} disabled={!editable} onChange={(event) => update(link.id, { icon: event.target.value as SocialLink["icon"] })}>
            {iconChoices.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
            {link.customIcon && <option value="custom">Своя иконка</option>}
          </select></label>
          {editable && <label className="social-upload"><span>Загрузить свою иконку (PNG, JPEG, WebP до 80 КБ)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void upload(link.id, event.target.files?.[0]); event.target.value = ""; }} /></label>}
        </div>
        {editable && <div className="social-settings-actions">
          <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Поднять ${link.label}`}><ArrowUp size={16} /></button>
          <button type="button" disabled={index === links.length - 1} onClick={() => move(index, 1)} aria-label={`Опустить ${link.label}`}><ArrowDown size={16} /></button>
          <button type="button" onClick={() => setLinks((current) => current.filter((item) => item.id !== link.id))} aria-label={`Удалить ${link.label}`}><Trash2 size={16} /></button>
        </div>}
      </div>)}
      {editable && <div className="social-settings-footer">
        <button type="button" className="button button-ghost" disabled={links.length >= 8} onClick={() => setLinks((current) => [...current, { id: crypto.randomUUID(), label: "Новая соцсеть", url: "https://", icon: "telegram" }])}><Plus size={16} /> Добавить</button>
        <button type="button" className="button button-primary" disabled={saving} onClick={save}><Save size={16} /> {saving ? "Сохраняем…" : "Сохранить соцсети"}</button>
      </div>}
    </div>}
    {error && <p className="social-settings-error" role="alert">{error}</p>}
  </section>;
}
