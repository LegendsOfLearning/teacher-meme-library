"use client";

import Link from "next/link";
import { useCallback } from "react";
import {
  copyImageToClipboard,
  fetchAndDownloadSquare,
} from "../lib/download-square";

export function MemeActionIcon({ name, size = 16 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  switch (name) {
    case "download":
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    case "copy":
      return (
        <svg {...common}>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      );
    case "share":
      return (
        <svg {...common}>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      );
    case "edit":
      return (
        <svg {...common}>
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      );
    default:
      return null;
  }
}

export function canCustomizeItem(item) {
  return Boolean(
    item?.remixFormatId && item?.captions && item?.customizable !== false
  );
}

/** Icon CTAs: download, copy, share, and edit (customize). */
export default function MemeCardActions({
  item,
  onShare,
  onToast,
  compact = false,
}) {
  const customizable = canCustomizeItem(item);
  const iconSize = compact ? 14 : 16;
  const actionCount = customizable ? 4 : 3;

  const download = useCallback(async () => {
    try {
      const name =
        item.file.split("?")[0].split("/").pop() || "teacher-meme.png";
      await fetchAndDownloadSquare(item.file, name);
      onToast?.("Downloaded");
    } catch {
      onToast?.("Download failed");
    }
  }, [item, onToast]);

  const copyImage = useCallback(async () => {
    try {
      await copyImageToClipboard(item.file);
      onToast?.("Copied — paste into chat or email");
    } catch {
      onToast?.("Couldn't copy — try Download");
    }
  }, [item, onToast]);

  return (
    <div
      className={`meme-card-actions${compact ? " meme-card-actions--compact" : ""}`}
      data-action-count={actionCount}
    >
      <button
        type="button"
        className="meme-icon-btn"
        aria-label="Download"
        title="Download"
        onClick={download}
      >
        <MemeActionIcon name="download" size={iconSize} />
      </button>
      <button
        type="button"
        className="meme-icon-btn"
        aria-label="Copy image"
        title="Copy image"
        onClick={copyImage}
      >
        <MemeActionIcon name="copy" size={iconSize} />
      </button>
      <button
        type="button"
        className="meme-icon-btn"
        aria-label="Share"
        title="Share"
        onClick={() => onShare?.(item)}
      >
        <MemeActionIcon name="share" size={iconSize} />
      </button>
      {customizable ? (
        <Link
          href={`/customize?id=${encodeURIComponent(item.id)}`}
          className="meme-icon-btn meme-icon-btn--edit"
          aria-label="Customize"
          title="Customize"
        >
          <MemeActionIcon name="edit" size={iconSize} />
        </Link>
      ) : null}
    </div>
  );
}
