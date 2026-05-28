"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import SharePanel from "./SharePanel";
import { MemeActionIcon, canCustomizeItem } from "./MemeCardActions";
import {
  copyImageToClipboard,
  fetchAndDownloadSquare,
} from "../lib/download-square";
import { shareMemeAsFile } from "../lib/share-image";
import { resolveShareContext } from "../lib/share-links";
import { trackEvent } from "../lib/analytics";

/** Download / copy / edit / social share for shared meme landing pages. */
export default function SharePageActions({ item, meme, share, onToast }) {
  const [showSocial, setShowSocial] = useState(false);
  const imgSrc =
    item?.file || meme?.pngUrl || share?.imageUrl || "";
  const editable = item ? canCustomizeItem(item) : false;
  const editHref = editable
    ? `/customize?id=${encodeURIComponent(item.id)}`
    : null;
  const downloadName =
    item?.file?.split("?")[0]?.split("/").pop() ||
    meme?.id ||
    "teacher-meme.png";

  const shareContext = resolveShareContext({
    item,
    share,
    imageUrl: meme?.pngUrl,
  });

  const download = useCallback(async () => {
    if (!imgSrc) return;
    try {
      await fetchAndDownloadSquare(imgSrc, downloadName);
      trackEvent("meme_download", {
        page_path:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      onToast?.("Saved — square PNG downloaded");
    } catch {
      onToast?.("Download failed — try again");
    }
  }, [imgSrc, downloadName, onToast]);

  const copyImage = useCallback(async () => {
    if (!imgSrc) return;
    try {
      await copyImageToClipboard(imgSrc);
      trackEvent("meme_copy_image", {
        page_path:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      onToast?.("Copied — paste into chat or email");
    } catch {
      onToast?.("Couldn't copy image — try Download");
    }
  }, [imgSrc, onToast]);

  const shareImage = useCallback(async () => {
    if (!imgSrc) return;
    try {
      const result = await shareMemeAsFile({
        imageUrl: imgSrc,
        title: shareContext.shareTitle,
        text: shareContext.shareText,
        pageUrl: shareContext.pageUrl,
      });
      trackEvent("meme_share_image", {
        page_path:
          typeof window !== "undefined" ? window.location.pathname : undefined,
        method: result.method,
      });
      if (result.ok) {
        onToast?.("Choose WhatsApp, Messages, or another app");
        return;
      }
      setShowSocial(true);
      onToast?.("Pick an app below, or download the image");
    } catch {
      onToast?.("Couldn't share — try Download");
    }
  }, [imgSrc, shareContext, onToast]);

  const shareProps = item ? { item, onToast } : { share, imageUrl: meme?.pngUrl, onToast };

  const actionCount = editable ? 4 : 3;

  return (
    <>
      <div className="meme-quick-actions share-page-actions">
        <p className="meme-quick-actions-hint">
          Download or share the meme image — no account needed.
        </p>
        <div
          className="meme-card-actions meme-card-actions--icons-only"
          data-action-count={actionCount}
        >
          <button
            type="button"
            className="meme-icon-btn meme-icon-btn--primary"
            aria-label="Download"
            title="Download"
            onClick={download}
          >
            <MemeActionIcon name="download" size={18} />
          </button>
          <button
            type="button"
            className="meme-icon-btn"
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
            className="meme-icon-btn"
            aria-label="Share meme image"
            title="Share meme image"
            onClick={shareImage}
          >
            <MemeActionIcon name="share" size={18} />
          </button>
        </div>
        <button
          type="button"
          className="share-device-btn share-page-share-more"
          onClick={() => setShowSocial((open) => !open)}
          aria-expanded={showSocial}
        >
          {showSocial ? "Hide more share options" : "More share options (Facebook, email…)"}
        </button>
      </div>
      {showSocial ? <SharePanel {...shareProps} /> : null}
    </>
  );
}
