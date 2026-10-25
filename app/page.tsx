import { CatalogExperience } from "@/components/catalog-experience";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalogPayload, getVisibleCategoryNames } from "@/lib/catalog-data";
import { getSocialLinks } from "@/lib/social-links";
import { defaultSocialLinks } from "@/lib/social-links-config";

export default async function Home() {
  const initialData = await (async () => {
    try {
      const user = await getSessionUser();
      const [payload, categories, socialLinks] = await Promise.all([
        getCatalogPayload({ user }),
        getVisibleCategoryNames(),
        getSocialLinks(),
      ]);
      return { payload, categories, socialLinks };
    } catch {
      return null;
    }
  })();

  return (
    <div className="site-page">
      <SiteHeader active="catalog" />
      <CatalogExperience initialPayload={initialData?.payload} initialCategories={initialData?.categories} initialSocialLinks={initialData?.socialLinks ?? defaultSocialLinks} />
      <footer className="site-footer shell"><div className="footer-brand">ШМАВИТО <span>×</span> STEEL</div><p>Независимый каталог предложений сообщества. Не является сервисом Avito.</p><div><a href="#">Правила</a><a href="#">Политика данных</a><a href="https://www.twitch.tv/steel" target="_blank" rel="noreferrer">Twitch</a></div></footer>
    </div>
  );
}
