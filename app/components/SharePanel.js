"use client";

import { useCallback, useMemo } from "react";
import {
  buildSocialShareLinks,
  resolveShareContext,
} from "../lib/share-links";
import { LOL_SHARE_PANEL_INTRO } from "../lib/lol-copy";
import { trackEvent, trackMemeShared } from "../lib/analytics";
import { shareMemeAsFile } from "../lib/share-image";

function SocialIcon({ id }) {
  const common = { width: 20, height: 20, "aria-hidden": true };
  switch (id) {
    case "facebook":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "x":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
        </svg>
      );
    case "pinterest":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.403.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.26 7.929-7.26 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
        </svg>
      );
    case "reddit":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-2.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
        </svg>
      );
    case "sms":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
          <path d="M7 9h10v2H7zm0-3h7v2H7z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.52 3.48A11.83 11.83 0 0012 0a11.93 11.93 0 00-10.34 17.85L0 24l6.31-1.65A11.93 11.93 0 0012 24a11.92 11.92 0 008.52-20.52ZM12 21.82a9.84 9.84 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.38A9.86 9.86 0 1112 21.82Zm5.43-7.36c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.66.15-.2.3-.76.97-.94 1.17-.17.2-.34.22-.64.07a8.09 8.09 0 01-2.38-1.47 9 9 0 01-1.66-2.07c-.17-.3 0-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.49.1-.2.05-.37-.03-.52-.07-.15-.66-1.6-.9-2.18-.24-.58-.49-.5-.66-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.19 5.07 4.47.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      );
    case "email":
      return (
        <svg
          {...common}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      );
    default:
      return null;
  }
}

function CopyField({ label, value, onCopy, mono }) {
  if (!value) return null;
  return (
    <div className="share-copy-field">
      <label className="share-copy-label">{label}</label>
      <div className="share-copy-row">
        <input
          type="text"
          className={`share-copy-input${mono ? " mono" : ""}`}
          value={value}
          readOnly
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className="share-copy-btn"
          onClick={() => onCopy(value, `${label} copied`)}
        >
          Copy
        </button>
      </div>
    </div>
  );
}

/** Imgflip-style share block: social row, optional device share, copyable links. */
export default function SharePanel({ item, share, imageUrl, onToast }) {
  const ctx = useMemo(
    () => resolveShareContext({ share, item, imageUrl }),
    [share, item, imageUrl]
  );

  const social = useMemo(
    () =>
      buildSocialShareLinks({
        pageUrl: ctx.pageUrl,
        shareText: ctx.shareText,
        shareTitle: ctx.shareTitle,
        imageUrl: ctx.imageUrl,
      }),
    [ctx]
  );

  const copy = useCallback(
    async (text, msg) => {
      try {
        await navigator.clipboard.writeText(text);
        onToast?.(msg);
      } catch {
        onToast?.("Couldn't copy. Select the text and copy manually");
      }
    },
    [onToast]
  );

  const deviceShare = useCallback(async () => {
    if (!ctx.imageUrl) {
      onToast?.("Use the social buttons or copy a link below");
      return;
    }
    trackMemeShared({
      method: "native",
      page_path:
        typeof window !== "undefined" ? window.location.pathname : undefined,
    });
    try {
      const result = await shareMemeAsFile({
        imageUrl: ctx.imageUrl,
        title: ctx.shareTitle,
        text: ctx.shareText,
        pageUrl: ctx.pageUrl,
      });
      if (result.ok) {
        onToast?.("Shared via your device");
        return;
      }
      onToast?.("Use a social button above, or download the image");
    } catch (err) {
      if (err?.name !== "AbortError") {
        onToast?.("Share cancelled or not available on this device");
      }
    }
  }, [ctx, onToast]);

  return (
    <section className="share-panel" aria-label="Share this meme">
      <h3 className="share-panel-title" id="share-modal-title">
        Share on social or copy a link
      </h3>
      <p className="share-panel-intro">{LOL_SHARE_PANEL_INTRO}</p>

      <div className="share-social-row">
        {social.map((s) =>
          s.action === "copy" ? (
            <button
              key={s.id}
              type="button"
              className={`share-social-btn ${s.className}`}
              title={s.copyMessage}
              aria-label={s.copyMessage}
              onClick={() => {
                trackEvent("meme_share_social", { platform: s.id });
                copy(s.copyValue, s.copyMessage);
              }}
            >
              <SocialIcon id={s.id} />
            </button>
          ) : (
            <a
              key={s.id}
              href={s.href}
              className={`share-social-btn ${s.className}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Share on ${s.label}`}
              aria-label={`Share on ${s.label}`}
              onClick={() => {
                trackMemeShared({
                  method: "social",
                  platform: s.id,
                  page_path:
                    typeof window !== "undefined"
                      ? window.location.pathname
                      : undefined,
                });
                trackEvent("meme_share_social", {
                  platform: s.id,
                  page_path:
                    typeof window !== "undefined"
                      ? window.location.pathname
                      : undefined,
                });
              }}
            >
              <SocialIcon id={s.id} />
            </a>
          )
        )}
      </div>

      <button type="button" className="share-device-btn" onClick={deviceShare}>
        Share via your device
      </button>

      <CopyField
        label="Image link"
        value={ctx.imageUrl}
        onCopy={copy}
      />
      <CopyField label="Page link" value={ctx.pageUrl} onCopy={copy} />
      <CopyField
        label="Image HTML"
        value={ctx.embedHtml}
        onCopy={copy}
        mono
      />
    </section>
  );
}
