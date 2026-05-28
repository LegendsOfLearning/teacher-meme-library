"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import SharePanel from "./SharePanel";
import { MemeActionIcon, canCustomizeItem } from "./MemeCardActions";
import { copyImageToClipboard } from "../lib/download-square";
import { trackEvent } from "../lib/analytics";

/** Copy / edit / social share for shared meme landing pages. */
export default function SharePageActions({ item, meme, share, onToast }) {
  const [showSocial, setShowSocial] = useState(false);
  const imgSrc =
    item?.file || meme?.pngUrl || share?.imageUrl || "";
  const editable = item ? canCustomizeItem(item) : false;
  const editHref = editable
    ? `/customize?id=${encodeURIComponent(item.id)}`
    : null;

  const copyImage = useCallback(async () => {
    if (!imgSrc) return;
    try {
      await copyImageToClipboard(imgSrc);
      trackEvent("meme_copy_image", {
        page_path: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      onToast?.("Copied — paste into chat or email");
    } catch {
      onToast?.("Couldn't copy image — try again");
    }
  }, [imgSrc, onToast]);

  const shareProps = item ? { item, onToast } : { share, imageUrl: meme?.pngUrl, onToast };

  const actionCount = editable ? 3 : 2;

  return (
    <>
      <div className="meme-quick-actions share-page-actions">
        <p className="meme-quick-actions-hint">
          Copy, customize, or share with your team — no account needed.
        </p>
        <div
          className="meme-card-actions meme-card-actions--icons-only"
          data-action-count={actionCount}
        >
          <button
            type="button"
            className="meme-icon-btn meme-icon-btn--primary"
            aria-label="Copy image"
            title="Copy image"
            onClick={copyImage}
          >
            <MemeActionIcon name="copy" size={18} />
          </button>
          {editHref ? (
            <Link
              href={editHref}
              className="meme-icon-btn meme-icon-btn--edit"
              aria-label="Customize"
              title="Customize"
            >
              <MemeActionIcon name="edit" size={18} />
            </Link>
          ) : null}
          <button
            type="button"
            className={`meme-icon-btn${showSocial ? " meme-icon-btn--active" : ""}`}
            aria-label="Share on social"
            title="Share on social"
            aria-expanded={showSocial}
            onClick={() => {
              setShowSocial((open) => {
                if (!open) trackEvent("meme_share_open");
                return !open;
              });
            }}
          >
            <MemeActionIcon name="share" size={18} />
          </button>
        </div>
      </div>
      {showSocial ? <SharePanel {...shareProps} /> : null}
    </>
  );
}
