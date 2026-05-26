import { notFound } from "next/navigation";
import Link from "next/link";
import { getGalleryItemById } from "../../lib/gallery";
import ShareGalleryActions from "./ShareGalleryActions";
import LolSignupCta from "../../components/LolSignupCta";
import LolNavBrand from "../../components/LolNavBrand";
import { LOL_FOOTER_LINE } from "../../lib/lol-copy";

// Permanent, shareable, social-preview-ready URL for a single
// gallery item. Mirrors /meme/[id] but reads from the curated
// gallery dataset instead of the persisted user-generated store.
//
// The OG/Twitter image is the gallery PNG itself (already
// watermarked at build time by scripts/build-gallery.mjs), so
// rich previews on Slack / WhatsApp / X / iMessage all show the
// meme image with our logo intact.

function buildOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3001";
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const item = getGalleryItemById(id);
  if (!item) {
    return { title: "Meme not found · Legends of Learning" };
  }
  const origin = buildOrigin();
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
        <Link href="/" className="nav-link">
          ← All memes
        </Link>
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

        <LolSignupCta />

        {item.remixFormatId && item.captions ? (
          <div className="share-cta-card">
            <h2>Make it yours</h2>
            <p>
              Same template, your words. Edit the captions in two clicks and
              download a fresh version — automatically reviewed for the
              classroom.
            </p>
            <Link
              href={`/customize?id=${encodeURIComponent(item.id)}`}
              className="cta-button"
            >
              Customize this template
            </Link>
          </div>
        ) : (
          <div className="share-cta-card">
            <h2>Make your own</h2>
            <p>
              Browse the library, pick a template, and share a laugh with
              your team — free from Legends of Learning.
            </p>
            <Link href="/" className="cta-button">
              Create your own teacher meme
            </Link>
          </div>
        )}
      </main>

      <footer className="footer">{LOL_FOOTER_LINE}</footer>
    </>
  );
}
