"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getFormatById, maxCharsForZone } from "../lib/meme-formats";
import { fetchAndDownloadSquare } from "../lib/download-square";
import {
  getGalleryItemById,
  getGalleryVariantsForFormat,
  galleryImg,
} from "../lib/gallery";
import SharePanel from "../components/SharePanel";
import MemeQuickActions from "../components/MemeQuickActions";
import LolSignupCta from "../components/LolSignupCta";
import LolNavBrand from "../components/LolNavBrand";
import MemeStatsBar from "../components/MemeStatsBar";
import { LOL_FOOTER_LINE } from "../lib/lol-copy";
import { trackEvent } from "../lib/analytics";
import MemeViewTracker from "../components/MemeViewTracker";
import { Suspense } from "react";

// ─── Inline icon set ─────────────────────────────────────────────────────
function Icon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  switch (name) {
    case "edit":
      return (
        <svg {...common}>
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    default:
      return null;
  }
}

// ─── Customize page ──────────────────────────────────────────────────────
//
// Route: /customize?id=<gallery-id>
// Lands a teacher straight into the edit form for a curated gallery
// meme — pre-fills captions by zone, hides every generator picker, and
// runs every save through the same 3-layer safety pipeline used by the
// agentic workflow (blocklist → OpenAI moderation → adversarial LLM
// review). If the user lands without a valid `?id=` we bounce back to
// the gallery homepage so they can pick one.

export default function CustomizePage() {
  return (
    <Suspense
      fallback={
        <>
          <nav className="nav">
            <LolNavBrand />
          </nav>
          <div className="loading-wrapper">
            <div className="loading-spinner" />
            <div className="loading-text">Loading template…</div>
          </div>
        </>
      }
    >
      <CustomizePageInner />
    </Suspense>
  );
}

function CustomizePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Source gallery item + matching format definition.
  const [item, setItem] = useState(null);
  const [format, setFormat] = useState(null);
  const [engagementById, setEngagementById] = useState({});

  // Edit form state.
  const [editValues, setEditValues] = useState({});
  const [editing, setEditing] = useState(true);

  // Result state — once the user hits Save & Render, this holds the
  // freshly persisted meme record (its own /meme/<id> share URL).
  const [meme, setMeme] = useState(null);

  // Async UI state.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showSocialShare, setShowSocialShare] = useState(false);

  const memeAnchorRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  }, []);

  const loadGalleryItem = useCallback(
    (galleryItem, { pushUrl = false } = {}) => {
      if (
        !galleryItem ||
        !galleryItem.remixFormatId ||
        !galleryItem.captions ||
        galleryItem.customizable === false
      ) {
        return false;
      }
      const fmt = getFormatById(galleryItem.remixFormatId);
      if (!fmt) return false;
      setItem(galleryItem);
      setFormat(fmt);
      setEditValues({ ...galleryItem.captions });
      setEditing(true);
      setError("");
      setMeme({
        id: `gallery-${galleryItem.id}`,
        formatId: fmt.id,
        formatName: fmt.name,
        captions: galleryItem.captions,
        pngUrl: galleryImg(galleryItem.file),
        sharePath: `/gallery/${galleryItem.id}`,
        _fromGallery: true,
      });
      if (pushUrl) {
        router.replace(`/customize?id=${encodeURIComponent(galleryItem.id)}`, {
          scroll: false,
        });
      }
      return true;
    },
    [router]
  );

  // Bootstrap / sync from ?id= (supports back/forward + variant clicks).
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) {
      router.replace("/");
      return;
    }
    if (item?.id === id && format) return;
    const galleryItem = getGalleryItemById(id);
    if (!loadGalleryItem(galleryItem)) {
      router.replace("/");
    }
  }, [searchParams, router, loadGalleryItem, item?.id, format]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/engagement")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.stats) setEngagementById(data.stats);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const [safetyError, setSafetyError] = useState("");

  useEffect(() => {
    const flat = Object.values(editValues || {})
      .filter((v) => typeof v === "string" && v.trim())
      .join("\n");
    if (!flat.trim()) {
      setSafetyError("");
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/moderate-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: flat }),
        });
        const data = await res.json();
        // Only hard-block on local blocklist hits. Moderation API false
        // positives must not freeze the Save button — /api/edit is source of truth.
        if (data.blocked && data.category === "blocklist") {
          setSafetyError(
            data.message || "Please use school-safe language."
          );
        } else {
          setSafetyError("");
        }
      } catch {
        // Network blip: allow save; server still validates.
        setSafetyError("");
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [editValues]);

  const saveEdit = useCallback(async () => {
    if (!format) return;
    const hasCaption = Object.values(editValues || {}).some(
      (v) => typeof v === "string" && v.trim()
    );
    if (!hasCaption) {
      setError("Add at least one caption.");
      return;
    }
    if (safetyError) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formatId: format.id,
          captions: editValues,
          // Gallery item id for validation; render uses cleanBase + zones.
          galleryFile: item?.file ?? null,
          situationId: item?.situations?.[0] || "lesson-planning",
          toneId: "relatable",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "moderation_unavailable") {
          throw new Error(
            data.error ||
              "Our safety check hiccuped for a second — nothing wrong with your captions. Tap Save & Render again and it should go through."
          );
        }
        throw new Error(data.error || "Edit failed");
      }
      setMeme(data);
      setEditing(false);
      trackEvent("meme_created", {
        meme_id: data.id,
        format_id: data.formatId,
        format_name: data.formatName,
        source_gallery_id: item?.id,
        ephemeral: Boolean(data.ephemeral),
      });
      if (data.ephemeral) {
        showToast("Ready to download. Ask your admin to enable Blob storage for share links");
      }
      setTimeout(
        () =>
          memeAnchorRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        120
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [editValues, format, item, safetyError, showToast]);

  const startEditAgain = () => {
    if (!meme) return;
    setEditValues({ ...meme.captions });
    setEditing(true);
  };

  const downloadPng = async () => {
    if (!meme) return;
    try {
      await fetchAndDownloadSquare(
        meme.pngUrl,
        `teacher-meme-${meme.id}.png`
      );
      showToast("Square meme downloaded");
    } catch {
      showToast("Download failed, try again");
    }
  };

  const shareTextLine = useMemo(() => {
    if (!meme) return "";
    if (item?.captionPreview) return item.captionPreview;
    return (
      Object.values(meme.captions || {})
        .filter((v) => typeof v === "string" && v.trim())
        .join(" / ") || meme.formatName
    );
  }, [meme, item]);

  const siblingVariants = useMemo(() => {
    if (!item?.remixFormatId) return [];
    return getGalleryVariantsForFormat(item.remixFormatId, {
      excludeId: item.id,
    }).map((variant) => ({
      ...variant,
      ...(engagementById[variant.id] || {}),
    }));
  }, [item, engagementById]);

  const selectVariant = useCallback(
    (variant) => {
      if (!variant || variant.id === item?.id) return;
      loadGalleryItem(variant, { pushUrl: true });
      requestAnimationFrame(() => {
        memeAnchorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    },
    [item?.id, loadGalleryItem]
  );

  // Loading splash while we resolve the gallery item / format on mount.
  if (!item || !format || !meme) {
    return (
      <>
        <nav className="nav">
          <LolNavBrand />
        </nav>
        <div className="loading-wrapper">
          <div className="loading-spinner" />
          <div className="loading-text">Loading template…</div>
        </div>
      </>
    );
  }

  return (
    <>
      {item?.id ? <MemeViewTracker memeId={item.id} /> : null}
      <nav className="nav">
        <Link href="/" className="nav-link">
          ← Back to memes
        </Link>
        <LolNavBrand />
      </nav>

      <section className="hero customize-hero">
        <h1>
          Customize this <span className="gradient-text">template</span>
        </h1>
      </section>

      <main className="container customize-page">
        {error && !editing ? (
          <div className="error-message">{error}</div>
        ) : null}

        {loading && (
          <div className="loading-wrapper">
            <div className="loading-spinner" />
            <div className="loading-text">Rendering & reviewing…</div>
          </div>
        )}

        {!loading && (
          <div className="meme-result" ref={memeAnchorRef}>
            {editing ? (
              <div className="customize-workspace">
                <div className="customize-preview-col">
                  <div className="meme-canvas-wrap">
                    <img
                      key={meme.id}
                      src={meme.pngUrl}
                      alt={`${meme.formatName} teacher meme`}
                      className="meme-image"
                    />
                  </div>
                  <div className="meme-meta">
                    <span className="meme-meta-pill">{meme.formatName}</span>
                  </div>
                  <MemeQuickActions
                    meme={meme}
                    item={item}
                    imageUrl={meme.pngUrl}
                    share={{
                      path: item?.pagePath || `/gallery/${item?.id}`,
                      title: `${meme.formatName} · Teacher meme`,
                      text: `Found my new favorite teacher meme: "${shareTextLine}"`,
                      imageUrl: meme.pngUrl,
                    }}
                    onToast={showToast}
                    onShareMore={() => setShowSocialShare(true)}
                    compact
                  />
                  {showSocialShare ? (
                    <SharePanel
                      item={item}
                      share={{
                        path: item?.pagePath || `/gallery/${item?.id}`,
                        title: `${meme.formatName} · Teacher meme`,
                        text: `Found my new favorite teacher meme: "${shareTextLine}"`,
                        imageUrl: meme.pngUrl,
                      }}
                      onToast={showToast}
                    />
                  ) : null}
                </div>
                <div className="customize-editor-col">
                  <EditPanel
                    format={format}
                    values={editValues}
                    onChange={setEditValues}
                    onSave={saveEdit}
                    safetyError={safetyError}
                    saveError={error}
                    loading={loading}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="meme-canvas-wrap">
                  <img
                    key={meme.id}
                    src={meme.pngUrl}
                    alt={`${meme.formatName} teacher meme`}
                    className="meme-image"
                  />
                </div>

                <div className="meme-meta">
                  <span className="meme-meta-pill">{meme.formatName}</span>
                </div>

                <MemeQuickActions
                  meme={meme}
                  share={{
                    path: meme.sharePath,
                    title: `${meme.formatName} · Teacher meme`,
                    text: `Found my new favorite teacher meme: "${shareTextLine}"`,
                    imageUrl: meme.pngUrl,
                  }}
                  onToast={showToast}
                  onShareMore={() => setShowSocialShare(true)}
                />
                <div className="meme-actions">
                  <button className="action-btn" onClick={startEditAgain}>
                    <Icon name="edit" />
                    Edit again
                  </button>
                </div>
                {showSocialShare ? (
                  <SharePanel
                    share={{
                      path: meme.sharePath,
                      title: `${meme.formatName} · Teacher meme`,
                      text: `Found my new favorite teacher meme: "${shareTextLine}"`,
                      imageUrl: meme.pngUrl,
                    }}
                    onToast={showToast}
                  />
                ) : null}
                <LolSignupCta />
              </>
            )}

            {siblingVariants.length > 0 ? (
              <section className="customize-variants" aria-label="More captions">
                <div className="customize-variants-header">
                  <h2 className="customize-variants-heading">
                    More {format.name} captions
                  </h2>
                  <p className="customize-variants-sub">
                    Tap a caption to edit it above. Scroll sideways for more.
                  </p>
                </div>
                <div className="customize-variants-rail">
                  {siblingVariants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      className="customize-variant-card"
                      onClick={() => selectVariant(variant)}
                    >
                      <img
                        src={galleryImg(variant.file)}
                        alt={variant.captionPreview || format.name}
                        loading="lazy"
                      />
                      <div className="customize-variant-meta">
                        <MemeStatsBar item={variant} variant="inline" force />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </main>

      <footer className="footer">{LOL_FOOTER_LINE}</footer>

      <div className={`toast ${toast ? "visible" : ""}`}>{toast}</div>
    </>
  );
}

function EditPanel({
  format,
  values,
  onChange,
  onSave,
  safetyError,
  saveError,
  loading,
}) {
  if (!format) return null;
  const retryHint =
    saveError &&
    /try again|tap save|hiccuped/i.test(saveError);
  return (
    <div className="edit-panel">
      <div className="edit-header">Edit captions</div>
      {safetyError ? (
        <p className="edit-safety-warn" role="alert">
          {safetyError}
        </p>
      ) : null}
      {saveError && !safetyError ? (
        <p
          className={
            retryHint ? "edit-safety-retry" : "edit-safety-warn"
          }
          role="alert"
        >
          {saveError}
        </p>
      ) : null}
      {format.zones.filter((z) => !z.decorative).map((z) => {
        const charLimit = maxCharsForZone(format, z);
        return (
          <label key={z.key} className="edit-field">
            <span className="edit-label">{z.label}</span>
            <input
              className="custom-input single-line"
              value={values[z.key] || ""}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, [z.key]: e.target.value }))
              }
              maxLength={charLimit}
              placeholder={`Type the ${z.label.toLowerCase()}…`}
            />
            <span className="edit-char-count">
              {(values[z.key] || "").length}/{charLimit}
            </span>
          </label>
        );
      })}
      <div className="edit-actions">
        <button
          className="action-btn primary"
          onClick={onSave}
          disabled={loading || Boolean(safetyError)}
        >
          {loading
            ? "Rendering…"
            : retryHint
              ? "Try again — Save & Render"
              : "Save & Render"}
        </button>
      </div>
      <p className="edit-hint">
        Every save runs through a K-8 safety check before download.
      </p>
    </div>
  );
}
