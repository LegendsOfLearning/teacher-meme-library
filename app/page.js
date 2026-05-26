import path from "node:path";
import { statSync } from "node:fs";
import {
  galleryItems,
  gallerySituationFilters,
} from "./lib/gallery.js";
import { getHotMemes, getMemeOfTheDay } from "./lib/gallery-featured";
import GalleryGrid from "./gallery/GalleryGrid";
import HomeFeaturedStrip from "./components/HomeFeaturedStrip";
import HomePageBottom from "./components/HomePageBottom";
import LolNavBrand from "./components/LolNavBrand";
import {
  LOL_HERO_BODY,
  LOL_HERO_TAGLINE,
  LOL_HERO_TITLE,
  LOL_LIBRARY_HEADING,
  LOL_LIBRARY_LEAD,
} from "./lib/lol-copy";

function withCacheBust(items) {
  const galleryDir = path.join(process.cwd(), "public", "gallery");
  return items.map((item) => {
    if (!item.file?.startsWith("/gallery/")) return item;
    try {
      const filePath = path.join(galleryDir, item.file.replace("/gallery/", ""));
      const v = statSync(filePath).mtimeMs | 0;
      return { ...item, file: `${item.file}?v=${v}` };
    } catch {
      return item;
    }
  });
}

export const metadata = {
  title: "Teacher Meme Library | Legends of Learning",
  description:
    "A free teacher meme library from Legends of Learning. Share or customize classroom-safe memes — then explore free game-based learning when you're ready.",
  openGraph: {
    title: "Teacher Meme Library",
    description:
      "Hand-picked, classroom-safe teacher memes. Share or remix in two clicks.",
    type: "website",
  },
};

export default async function Home() {
  const items = withCacheBust(galleryItems);
  const memeOfTheDay = getMemeOfTheDay(items);
  const excludeIds = memeOfTheDay ? [memeOfTheDay.id] : [];
  const trendingMemes = getHotMemes(items, 5).filter(
    (i) => !excludeIds.includes(i.id)
  );

  return (
    <>
      <nav className="nav">
        <LolNavBrand />
      </nav>

      <section className="hero hero-compact" aria-labelledby="hero-headline">
        <div className="hero-inner">
          <h1 className="hero-title" id="hero-headline">
            {LOL_HERO_TITLE}
          </h1>
          <p className="hero-tagline">{LOL_HERO_TAGLINE}</p>
          <p className="hero-body">{LOL_HERO_BODY}</p>
        </div>
      </section>

      <main className="container gallery-container">
        <HomeFeaturedStrip
          memeOfTheDay={memeOfTheDay}
          trendingMemes={trendingMemes}
        />

        <header className="library-header">
          <h2 className="library-header-title">{LOL_LIBRARY_HEADING}</h2>
          <p className="library-header-lead">{LOL_LIBRARY_LEAD}</p>
        </header>

        <GalleryGrid items={items} filters={gallerySituationFilters} />
      </main>

      <HomePageBottom />
    </>
  );
}
