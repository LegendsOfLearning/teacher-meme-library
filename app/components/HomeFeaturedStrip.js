"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import ShareModal from "./ShareModal";
import MemeCardActions from "./MemeCardActions";
import { galleryImg } from "../lib/gallery";

function itemHref(item) {
  if (item.pagePath) return item.pagePath;
  return `/gallery/${item.id}`;
}

/** One featured section: Meme of the Day + trending row. */
export default function HomeFeaturedStrip({ memeOfTheDay, trendingMemes }) {
  const [toast, setToast] = useState("");
  const [shareItem, setShareItem] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }, []);

  if (!memeOfTheDay && !trendingMemes?.length) return null;

  return (
    <section className="featured-memes" aria-label="Featured teacher memes">
      <div className="featured-memes-layout">
        {memeOfTheDay ? (
          <article className="featured-day-card">
            <p className="featured-day-label">Meme of the day</p>
            <Link href={itemHref(memeOfTheDay)} className="featured-day-thumb">
              <img
                src={galleryImg(memeOfTheDay.file)}
                alt={memeOfTheDay.captionPreview}
              />
            </Link>
            <p className="featured-day-format">{memeOfTheDay.formatName}</p>
            <MemeCardActions
              item={memeOfTheDay}
              onShare={setShareItem}
              onToast={showToast}
            />
          </article>
        ) : null}

        {trendingMemes?.length > 0 ? (
          <div className="featured-trending">
            <p className="featured-trending-label">Trending teacher memes</p>
            <div className="featured-trending-grid">
              {trendingMemes.map((item) => (
                <article key={item.id} className="featured-trending-card">
                  <Link href={itemHref(item)} className="featured-trending-thumb">
                    <img src={galleryImg(item.file)} alt="" loading="lazy" />
                  </Link>
                  <p className="featured-trending-format">{item.formatName}</p>
                  <MemeCardActions
                    item={item}
                    onShare={setShareItem}
                    onToast={showToast}
                    compact
                  />
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <ShareModal
        open={Boolean(shareItem)}
        onClose={() => setShareItem(null)}
        item={shareItem}
        onToast={showToast}
      />
      <div className={`toast ${toast ? "visible" : ""}`}>{toast}</div>
    </section>
  );
}
