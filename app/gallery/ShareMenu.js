"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  buildSocialShareLinks,
  resolveShareContext,
} from "../lib/share-links";

// Compact share popover for gallery cards (full panel on share pages).

function Icon({ name }) {
  const c = {
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
  switch (name) {
    case "share":
      return (
        <svg {...c}>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      );
    case "copy":
      return (
        <svg {...c}>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      );
    case "image":
      return (
        <svg {...c}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case "x":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
        </svg>
      );
    case "facebook":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "pinterest":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.403.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.26 7.929-7.26 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
        </svg>
      );
    case "reddit":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-2.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
        </svg>
      );
    case "sms":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
          <path d="M7 9h10v2H7zm0-3h7v2H7z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.52 3.48A11.83 11.83 0 0012 0a11.93 11.93 0 00-10.34 17.85L0 24l6.31-1.65A11.93 11.93 0 0012 24a11.92 11.92 0 008.52-20.52ZM12 21.82a9.84 9.84 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.38A9.86 9.86 0 1112 21.82Zm5.43-7.36c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.66.15-.2.3-.76.97-.94 1.17-.17.2-.34.22-.64.07a8.09 8.09 0 01-2.38-1.47 9 9 0 01-1.66-2.07c-.17-.3 0-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.49.1-.2.05-.37-.03-.52-.07-.15-.66-1.6-.9-2.18-.24-.58-.49-.5-.66-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.19 5.07 4.47.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    case "email":
      return (
        <svg {...c}>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      );
    default:
      return null;
  }
}

export default function ShareMenu({
  item,
  share,
  imageUrl: imageUrlProp,
  onToast,
  buttonClassName = "gallery-action",
  buttonLabel = "Share",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const ctx = resolveShareContext({ share, item, imageUrl: imageUrlProp });
  const social = buildSocialShareLinks({
    pageUrl: ctx.pageUrl,
    shareText: ctx.shareText,
    shareTitle: ctx.shareTitle,
    imageUrl: ctx.imageUrl,
  });

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  }, []);

  const copyText = useCallback(
    async (text, msg) => {
      try {
        await navigator.clipboard.writeText(text);
        onToast?.(msg);
      } catch {
        onToast?.("Couldn't copy. Long-press to copy manually");
      }
      setOpen(false);
    },
    [onToast]
  );

  const iconClass = {
    facebook: "facebook",
    x: "x",
    pinterest: "pinterest",
    reddit: "reddit",
    sms: "sms",
    whatsapp: "whatsapp",
    instagram: "instagram",
    email: "email",
  };

  return (
    <span className="share-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className={buttonClassName}
        onClick={handleClick}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={buttonLabel}
      >
        <Icon name="share" />
        <span>{buttonLabel}</span>
      </button>
      {open && (
        <div className="share-menu" role="menu">
          {social.map((s) =>
            s.action === "copy" ? (
              <button
                key={s.id}
                type="button"
                className="share-menu-item"
                role="menuitem"
                onClick={() => copyText(s.copyValue, s.copyMessage)}
              >
                <span className={`share-menu-icon ${iconClass[s.id]}`}>
                  <Icon name={s.id} />
                </span>
                <span>{s.label}</span>
              </button>
            ) : (
              <a
                key={s.id}
                className="share-menu-item"
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <span className={`share-menu-icon ${iconClass[s.id]}`}>
                  <Icon name={s.id} />
                </span>
                <span>{s.label}</span>
              </a>
            )
          )}
          <button
            type="button"
            className="share-menu-item"
            role="menuitem"
            onClick={() => copyText(ctx.pageUrl, "Page link copied")}
          >
            <span className="share-menu-icon copy">
              <Icon name="copy" />
            </span>
            <span>Copy page link</span>
          </button>
          <button
            type="button"
            className="share-menu-item"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              if (typeof navigator !== "undefined" && navigator.share) {
                try {
                  await navigator.share({
                    title: ctx.shareTitle,
                    text: ctx.shareText,
                    url: ctx.pageUrl,
                  });
                  return;
                } catch {
                  /* user cancelled */
                }
              }
              onToast?.("Use a social button above or copy a link");
            }}
          >
            <span className="share-menu-icon copy">
              <Icon name="share" />
            </span>
            <span>Share via your device</span>
          </button>
          {ctx.imageUrl ? (
            <>
              <button
                type="button"
                className="share-menu-item"
                role="menuitem"
                onClick={() => copyText(ctx.imageUrl, "Image link copied")}
              >
                <span className="share-menu-icon copy">
                  <Icon name="copy" />
                </span>
                <span>Copy image link</span>
              </button>
              <button
                type="button"
                className="share-menu-item"
                role="menuitem"
                onClick={() =>
                  copyText(ctx.embedHtml, "Image HTML copied")
                }
              >
                <span className="share-menu-icon copy">
                  <Icon name="copy" />
                </span>
                <span>Copy image HTML</span>
              </button>
              <a
                className="share-menu-item"
                href={ctx.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <span className="share-menu-icon image">
                  <Icon name="image" />
                </span>
                <span>Open image</span>
              </a>
            </>
          ) : null}
        </div>
      )}
    </span>
  );
}
