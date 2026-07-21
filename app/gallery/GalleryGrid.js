"use client";

import { Fragment, useState, useMemo, useCallback, useId } from "react";
import Link from "next/link";
import ShareModal from "../components/ShareModal";
import MemeCardActions from "../components/MemeCardActions";
import {
  buildSearchSuggestions,
  itemMatchesQuery,
} from "../lib/gallery-search";
import { galleryImg } from "../lib/gallery";

function itemHref(item) {
  if (item.pagePath) return item.pagePath;
  return `/gallery/${item.id}`;
}

export default function GalleryGrid({ items, filters }) {
  const [filterId, setFilterId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState("");
  const [shareItem, setShareItem] = useState(null);
  const searchId = useId();

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  }, []);

  const situationFiltered = useMemo(() => {
    if (filterId === "all") return items;
    return items.filter((g) => g.situations.includes(filterId));
  }, [items, filterId]);

  const visible = useMemo(() => {
    if (!searchQuery.trim()) return situationFiltered;
    return situationFiltered.filter((item) =>
      itemMatchesQuery(item, searchQuery)
    );
  }, [situationFiltered, searchQuery]);

  const suggestions = useMemo(
    () => buildSearchSuggestions(situationFiltered, searchQuery),
    [situationFiltered, searchQuery]
  );

  const applySuggestion = (query) => {
    setSearchQuery(query);
  };

  return (
    <>
      <div className="gallery-filters">
        {filters.map((f) => (
          <Fragment key={f.id}>
            <button
              type="button"
              className={`chip ${filterId === f.id ? "active" : ""}`}
              onClick={() => setFilterId(f.id)}
            >
              <span className="chip-emoji">{f.emoji}</span>
              <span className="chip-label">{f.label}</span>
            </button>
            {f.id === "all" ? (
              <label className="gallery-search" htmlFor={searchId}>
                <span className="sr-only">Search memes</span>
                <svg
                  className="gallery-search-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  id={searchId}
                  type="search"
                  className="gallery-search-input"
                  placeholder="Search memes…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                />
              </label>
            ) : null}
          </Fragment>
        ))}
      </div>

      {searchQuery.trim().length >= 2 && suggestions.length > 0 ? (
        <div
          className="gallery-search-suggestions"
          role="listbox"
          aria-label="Suggested searches"
        >
          <p className="gallery-search-suggestions-label">Suggested</p>
          <div className="gallery-search-suggestions-list">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                role="option"
                className="gallery-search-suggestion"
                onClick={() => applySuggestion(s.query)}
              >
                <span className="gallery-search-suggestion-title">{s.label}</span>
                <span className="gallery-search-suggestion-detail">{s.detail}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="gallery-meta">
        Showing <strong>{visible.length}</strong> of {items.length} memes
        {searchQuery.trim() ? (
          <>
            {" "}
            for <strong>&ldquo;{searchQuery.trim()}&rdquo;</strong>
          </>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="gallery-empty">
          No memes match that search. Try a format name like &ldquo;Drake&rdquo; or a
          keyword like &ldquo;grading&rdquo;.
        </p>
      ) : (
        <div className="gallery-grid">
          {visible.map((item) => (
            <article key={item.id} className="gallery-card">
              <Link href={itemHref(item)} className="gallery-thumb">
                <img src={galleryImg(item.file)} alt={item.captionPreview} loading="lazy" />
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
      )}

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
