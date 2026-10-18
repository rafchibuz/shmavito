import { CatalogExperience } from "@/components/catalog-experience";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="site-page">
      <SiteHeader active="catalog" />
      <CatalogExperience />
      <footer className="site-footer shell"><div className="footer-brand">ШМАВИТО <span>×</span> STEEL</div><p>Независимый каталог предложений сообщества. Не является сервисом Avito.</p><div><a href="#">Правила</a><a href="#">Политика данных</a><a href="https://www.twitch.tv/steel" target="_blank" rel="noreferrer">Twitch</a></div></footer>
    </div>
  );
}
