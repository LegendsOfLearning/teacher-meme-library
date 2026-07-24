import path from "node:path";
import { statSync } from "node:fs";
import {
  galleryItems,
  gallerySituationFilters,
} from "./lib/gallery.js";
import Link from "next/link";
import {
  getHotMemes,
  getTeacherCreatedForHome,
} from "./lib/gallery-featured";
import {
  getGalleryEngagementScores,
  getGalleryEngagementStats,
  mergeEngagementOntoItem,
} from "./lib/engagement";
import { listMemes } from "./lib/storage";
import GalleryGrid from "./gallery/GalleryGrid";
import HomeFeaturedStrip from "./components/HomeFeaturedStrip";
import HomePageBottom from "./components/HomePageBottom";
import LolNavBrand from "./components/LolNavBrand";
import {
  LOL_HERO_TAGLINE,
  LOL_HERO_TITLE,
  LOL_LIBRARY_HEADING,
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
  title: "Free Classroom Memes | Legends of Learning",
  description:
    "Free classroom memes from Legends of Learning. Share or customize classroom-safe memes, then explore free game-based learning when you're ready.",
  openGraph: {
    title: "Free Classroom Memes",
    description:
      "Hand-picked, classroom-safe teacher memes. Share or remix in two clicks.",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

export default async function Home() {
  let engagementScores = {};
  let engagementStats = {};
  try {
    [engagementScores, engagementStats] = await Promise.all([
      getGalleryEngagementScores(),
      getGalleryEngagementStats(),
    ]);
  } catch {
    engagementScores = {};
    engagementStats = {};
  }
  const items = withCacheBust(galleryItems).map((item) =>
    mergeEngagementOntoItem(item, engagementStats)
  );
  // Real ranking: downloads/shares/customizes/views/upvotes. Falls back to featured + daily shuffle.
  const trendingMemes = getHotMemes(items, 5, engagementScores).map((item) =>
    mergeEngagementOntoItem(item, engagementStats)
  );
  let teacherCreated = [];
  try {
    const community = await listMemes(48);
    teacherCreated = getTeacherCreatedForHome(community, { count: 8 }).map(
      (item) => mergeEngagementOntoItem(item, engagementStats)
    );
  } catch {
    teacherCreated = [];
  }

  return (
    <>
      <nav className="nav">
        <LolNavBrand />
        <Link href="/why-memes" className="nav-link nav-link--why">
          Why memes?
        </Link>
      </nav>

      <section className="hero hero-compact" aria-labelledby="hero-headline">
        <div className="hero-inner">
          <h1 className="hero-title" id="hero-headline">
            {LOL_HERO_TITLE}
          </h1>
          <p className="hero-tagline">{LOL_HERO_TAGLINE}</p>
        </div>
      </section>

      <main className="container gallery-container">
        <HomeFeaturedStrip trendingMemes={trendingMemes} />

        <header className="library-header">
          <h2 className="library-header-title">{LOL_LIBRARY_HEADING}</h2>
        </header>

        <GalleryGrid
          items={items}
          teacherCreatedItems={teacherCreated}
          filters={gallerySituationFilters}
        />
      </main>

      <HomePageBottom />
    </>
  );
}
