"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import ShareModal from "../components/ShareModal";
import MemeCardActions from "../components/MemeCardActions";

function itemHref(item) {
  if (item.pagePath) return item.pagePath;
  return `/gallery/${item.id}`;
}

export default function GalleryGrid({ items, filters }) {
  const [filterId, setFilterId] = useState("all");
  const [toast, setToast] = useState("");
  const [shareItem, setShareItem] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  }, []);

  const visible = useMemo(() => {
    if (filterId === "all") return items;
    return items.filter((g) => g.situations.includes(filterId));
  }, [items, filterId]);

  return (
    <>
      <div className="gallery-filters">
        {filters.map((f) => (
          <button
            key={f.id}
            className={`chip ${filterId === f.id ? "active" : ""}`}
            onClick={() => setFilterId(f.id)}
          >
            <span className="chip-emoji">{f.emoji}</span>
            <span className="chip-label">{f.label}</span>
          </button>
        ))}
      </div>

      <div className="gallery-meta">
        Showing <strong>{visible.length}</strong> of {items.length} memes
      </div>

      <div className="gallery-grid">
        {visible.map((item) => (
          <article key={item.id} className="gallery-card">
            <Link href={itemHref(item)} className="gallery-thumb">
              <img src={item.file} alt={item.captionPreview} loading="lazy" />
            </Link>
            <div className="gallery-card-body">
              <div className="gallery-format" title={item.formatName}>
                {item.formatName}
              </div>
              <MemeCardActions
                item={item}
                onShare={setShareItem}
                onToast={showToast}
              />
            </div>
          </article>
        ))}
      </div>

      <ShareModal
        open={Boolean(shareItem)}
        onClose={() => setShareItem(null)}
        item={shareItem}
        onToast={showToast}
      />

      <div className={`toast ${toast ? "visible" : ""}`}>{toast}</div>
    </>
  );
}
