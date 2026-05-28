import { notFound } from "next/navigation";
import Link from "next/link";
import { getMeme } from "../../lib/storage";
import ShareActions from "./ShareActions";
import MemeViewTracker from "../../components/MemeViewTracker";
import LolSignupCta from "../../components/LolSignupCta";
import LolNavBrand from "../../components/LolNavBrand";
import { LOL_FOOTER_LINE } from "../../lib/lol-copy";
import { absoluteUrl, serverShareOrigin } from "../../lib/share-links";

export const dynamic = "force-dynamic";

// Build a one-line summary from the caption fields. Used for the
// OG description, Twitter card, and the page subtitle. Designed so
// every format degrades cleanly even though zone keys differ.
function describeCaption(captions) {
  const parts = Object.values(captions || {})
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  if (parts.length === 0) return "A teacher meme.";
  return parts.join(" / ");
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const meme = await getMeme(id);
  if (!meme) {
    return { title: "Meme not found · Legends of Learning" };
  }
  const origin = serverShareOrigin();
  const description = describeCaption(meme.captions);
  const title = `${meme.formatName} · Teacher meme`;
  const fullImageUrl = absoluteUrl(meme.pngUrl);
  const fullPageUrl = `${origin}${meme.sharePath}`;
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
          alt: `${meme.formatName} teacher meme`,
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

export default async function MemePage({ params }) {
  const { id } = await params;
  const meme = await getMeme(id);
  if (!meme) notFound();

  return (
    <>
      <MemeViewTracker memeId={meme.id} />
      <nav className="nav">
        <LolNavBrand />
      </nav>

      <main className="share-page">
        <div className="share-meme-wrap">
          <img
            src={meme.pngUrl}
            alt={`${meme.formatName} teacher meme`}
            // Width/height hints from the format help avoid layout shift.
          />
        </div>

        <div className="share-page-meta">
          <span className="meme-meta-pill">{meme.formatName}</span>
          {meme.toneLabel && (
            <span className="meme-meta-pill subtle">{meme.toneLabel}</span>
          )}
          {meme.situationLabel && (
            <span className="meme-meta-pill subtle">{meme.situationLabel}</span>
          )}
        </div>

        <ShareActions meme={meme} />

        <LolSignupCta variant="landing" />
      </main>

      <footer className="footer">{LOL_FOOTER_LINE}</footer>
    </>
  );
}
