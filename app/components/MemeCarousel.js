"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import ShareModal from "./ShareModal";
import MemeQuickActions from "./MemeQuickActions";
import { fetchAndDownloadSquare } from "../lib/download-square";

function itemHref(item) {
  if (item.pagePath) return item.pagePath;
  return `/gallery/${item.id}`;
}

function Icon({ name }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  if (name === "download") {
    return (
      <svg {...common}>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    );
  }
  if (name === "share") {
    return (
      <svg {...common}>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    );
  }
  return null;
}

function CarouselCard({ item, onShare, onToast }) {
  const download = async () => {
    try {
      const name =
        item.file.split("?")[0].split("/").pop() || "teacher-meme.png";
      await fetchAndDownloadSquare(item.file, name);
      onToast("Square meme downloaded");
    } catch {
      onToast("Download failed — try again");
    }
  };

  return (
    <article className="carousel-card">
      <Link href={itemHref(item)} className="carousel-thumb">
        <img src={item.file} alt={item.captionPreview} loading="lazy" />
      </Link>
      <div className="carousel-card-body">
        <div className="carousel-format">{item.formatName}</div>
        <div className="carousel-card-actions">
          <button type="button" className="carousel-action-btn" onClick={download}>
            <Icon name="download" />
            <span>Download</span>
          </button>
          <button
            type="button"
            className="carousel-action-btn"
            onClick={() => onShare(item)}
          >
            <Icon name="share" />
            <span>Share</span>
          </button>
        </div>
      </div>
    </article>
  );
}

/** Horizontal carousel — shows ~3 memes per “page” on desktop. */
export default function MemeCarousel({
  title,
  subtitle,
  items,
  singleHighlight = false,
}) {
  const [toast, setToast] = useState("");
  const [shareItem, setShareItem] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  }, []);

  if (!items?.length) return null;

  if (singleHighlight && items.length === 1) {
    const item = items[0];
    return (
      <section className="meme-carousel-section meme-of-day">
        <header className="meme-carousel-header">
          <h2 className="meme-carousel-title">{title}</h2>
          {subtitle ? <p className="meme-carousel-subtitle">{subtitle}</p> : null}
        </header>
        <div className="meme-of-day-card">
          <Link href={itemHref(item)} className="meme-of-day-thumb">
            <img src={item.file} alt={item.captionPreview} />
          </Link>
          <div className="meme-of-day-side">
            <span className="meme-meta-pill">{item.formatName}</span>
            <p className="meme-of-day-caption">{item.captionPreview}</p>
            <MemeQuickActions
              item={item}
              onToast={showToast}
              onShareMore={() => setShareItem(item)}
            />
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

  return (
    <section className="meme-carousel-section">
      <header className="meme-carousel-header">
        <h2 className="meme-carousel-title">{title}</h2>
        {subtitle ? <p className="meme-carousel-subtitle">{subtitle}</p> : null}
      </header>
      <div className="meme-carousel-track" role="list">
        {items.map((item) => (
          <CarouselCard
            key={item.id}
            item={item}
            onShare={setShareItem}
            onToast={showToast}
          />
        ))}
      </div>
      <p className="meme-carousel-scroll-hint" aria-hidden>
        ← Scroll for more →
      </p>
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
