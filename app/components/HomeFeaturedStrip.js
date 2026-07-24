"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import ShareModal from "./ShareModal";
import MemeCardActions, { canCustomizeItem } from "./MemeCardActions";
import { galleryImg } from "../lib/gallery";

function itemHref(item) {
  if (canCustomizeItem(item)) {
    return `/customize?id=${encodeURIComponent(item.id)}`;
  }
  if (item.pagePath) return item.pagePath;
  return `/gallery/${item.id}`;
}

function CompactCard({ item, onShare, onToast }) {
  return (
    <article className="home-rail-card">
      <Link href={itemHref(item)} className="home-rail-thumb" title={item.formatName}>
        <img
          src={galleryImg(item.file)}
          alt={item.captionPreview || item.formatName}
          loading="lazy"
        />
      </Link>
      <MemeCardActions
        item={item}
        onShare={onShare}
        onToast={onToast}
        compact
      />
    </article>
  );
}

/** Compact Trending now rail ranked by real engagement. */
export default function HomeFeaturedStrip({ trendingMemes }) {
  const [toast, setToast] = useState("");
  const [shareItem, setShareItem] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }, []);

  if (!trendingMemes?.length) return null;

  return (
    <section className="home-rail" aria-label="Trending teacher memes">
      <div className="home-rail-block home-rail-block--trending">
        <p className="home-rail-label">Trending now</p>
        <div className="home-rail-track home-rail-track--trending">
          {trendingMemes.map((item) => (
            <CompactCard
              key={item.id}
              item={item}
              onShare={setShareItem}
              onToast={showToast}
            />
          ))}
        </div>
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
