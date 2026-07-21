"use client";

import { useEffect, useRef } from "react";
import SharePanel from "./SharePanel";
import MemeQuickActions from "./MemeQuickActions";
import LolSignupStrip from "./LolSignupStrip";

/** Full Imgflip-style share UI in a modal (gallery cards, quick share). */
export default function ShareModal({ open, onClose, item, share, imageUrl, onToast }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="share-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        <button
          type="button"
          className="share-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <MemeQuickActions
          item={item}
          share={share}
          imageUrl={imageUrl}
          onToast={onToast}
          compact
          onShareMore={() => {
            /* Panel is already visible in this modal */
            onToast?.("Pick Facebook, X, WhatsApp, or another option below");
          }}
        />
        <SharePanel
          item={item}
          share={share}
          imageUrl={imageUrl}
          onToast={onToast}
        />
        <LolSignupStrip />
      </div>
    </div>
  );
}
