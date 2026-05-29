"use client";

import { useCallback } from "react";
import {
  copyImageToClipboard,
  fetchAndDownloadSquare,
} from "../lib/download-square";
import { resolveShareContext } from "../lib/share-links";
import { MemeActionIcon } from "./MemeCardActions";

/** Primary save / copy / download / share controls on share pages. */
export default function MemeQuickActions({
  item,
  meme,
  imageUrl,
  share,
  onToast,
  onShareMore,
  compact = false,
}) {
  const ctx = resolveShareContext({ share, item, imageUrl });
  const imgSrc =
    imageUrl || item?.file || meme?.pngUrl || share?.imageUrl || "";
  const downloadName =
    item?.file?.split("?")[0]?.split("/").pop() ||
    meme?.id ||
    "teacher-meme.png";

  const toast = useCallback(
    (msg) => onToast?.(msg),
    [onToast]
  );

  const download = async () => {
    try {
      await fetchAndDownloadSquare(imgSrc, downloadName);
      toast("Saved: square PNG downloaded");
    } catch {
      toast("Download failed, try again");
    }
  };

  const copyImage = async () => {
    try {
      await copyImageToClipboard(imgSrc);
      toast("Copied: paste the image into chat or email");
    } catch {
      toast("Couldn't copy image, try Download instead");
    }
  };

  const deviceShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: ctx.shareTitle,
          text: ctx.shareText,
          url: ctx.pageUrl,
        });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }
    onShareMore?.();
  };

  return (
    <div
      className={`meme-quick-actions${compact ? " compact" : ""}`}
      role="group"
      aria-label="Save, copy, download, or share this meme"
    >
      {!compact && (
        <p className="meme-quick-actions-hint">
          Save it, copy it, download it, or share with your team — no account
          needed.
        </p>
      )}
      <div className="meme-card-actions meme-card-actions--icons-only">
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
        <button
          type="button"
          className="meme-icon-btn"
          aria-label="Share"
          title="Share"
          onClick={deviceShare}
        >
          <MemeActionIcon name="share" size={18} />
        </button>
      </div>
    </div>
  );
}
