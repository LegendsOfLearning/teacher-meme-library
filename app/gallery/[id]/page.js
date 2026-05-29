import { notFound } from "next/navigation";
import Link from "next/link";
import { getGalleryItemById } from "../../lib/gallery";
import ShareGalleryActions from "./ShareGalleryActions";
import LolSignupCta from "../../components/LolSignupCta";
import LolNavBrand from "../../components/LolNavBrand";
import { LOL_FOOTER_LINE } from "../../lib/lol-copy";
import { serverShareOrigin } from "../../lib/share-links";

// Permanent, shareable, social-preview-ready URL for a single
// gallery item. Mirrors /meme/[id] but reads from the curated
// gallery dataset instead of the persisted user-generated store.
//
// The OG/Twitter image is the gallery PNG itself (already
// watermarked at build time by scripts/build-gallery.mjs), so
// rich previews on Slack / WhatsApp / X / iMessage all show the
// meme image with our logo intact.

export async function generateMetadata({ params }) {
  const { id } = await params;
  const item = getGalleryItemById(id);
  if (!item) {
    return { title: "Meme not found · Legends of Learning" };
  }
  const origin = serverShareOrigin();
  const title = `${item.formatName} · Teacher meme`;
  const description = item.captionPreview || "A teacher meme.";
  const fullImageUrl = `${origin}${item.file}`;
  const fullPageUrl = `${origin}/gallery/${item.id}`;
  return {
    title: `${title} | Legends of Learning`,
    description,
    openGraph: {
      title,
      description,
      url: fullPageUrl,
      siteName: "Legends of Learning",
      type: "article",
      images: [
        {
          url: fullImageUrl,
          width: 1200,
          height: 1200,
          alt: `${item.formatName} teacher meme`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [fullImageUrl],
    },
  };
}

export default async function GalleryItemPage({ params }) {
  const { id } = await params;
  const item = getGalleryItemById(id);
  if (!item) notFound();

  return (
    <>
      <nav className="nav">
        <div className="nav-left">
          <Link href="/" className="nav-link">
            ← All memes
          </Link>
          <Link href="/why-memes" className="nav-link nav-link--why">
            Why memes?
          </Link>
        </div>
        <LolNavBrand />
      </nav>

      <main className="share-page">
        <div className="share-meme-wrap">
          <img src={item.file} alt={`${item.formatName} teacher meme`} />
        </div>

        <div className="share-page-meta">
          <span className="meme-meta-pill">{item.formatName}</span>
          <span className="meme-meta-pill subtle">{item.captionPreview}</span>
        </div>

        <ShareGalleryActions item={item} />

        <LolSignupCta variant="landing" />
      </main>

      <footer className="footer">{LOL_FOOTER_LINE}</footer>
    </>
  );
}
