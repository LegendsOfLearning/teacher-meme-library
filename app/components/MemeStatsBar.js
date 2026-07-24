"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatStatCount,
  hasLocalUpvote,
  markLocalUpvote,
  trackEngagement,
} from "../lib/engagement-client";

/**
 * Card/share engagement UI.
 * - inline (default on cards): muted "12 · 5 uses" — no extra chrome
 * - share: same counts + text upvote (for detail pages)
 */
export default function MemeStatsBar({
  item,
  variant = "inline",
  onToast,
  onUpvoteChange,
}) {
  const [views, setViews] = useState(Number(item?.views) || 0);
  const [uses, setUses] = useState(Number(item?.uses) || 0);
  const [upvotes, setUpvotes] = useState(Number(item?.upvotes) || 0);
  const [upvoted, setUpvoted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setViews(Number(item?.views) || 0);
    setUses(Number(item?.uses) || 0);
    setUpvotes(Number(item?.upvotes) || 0);
  }, [item?.id, item?.views, item?.uses, item?.upvotes]);

  useEffect(() => {
    if (!item?.id) return;
    setUpvoted(hasLocalUpvote(item.id));
  }, [item?.id]);

  const onUpvote = useCallback(async () => {
    if (!item?.id || upvoted || busy) return;
    setBusy(true);
    setUpvoted(true);
    setUpvotes((n) => n + 1);
    markLocalUpvote(item.id);
    onUpvoteChange?.(true);
    try {
      const res = await trackEngagement(item.id, "upvote");
      if (!res) return;
      const data = await res.json().catch(() => null);
      if (data?.upvotes != null) setUpvotes(Number(data.upvotes) || 0);
      if (data?.views != null) setViews(Number(data.views) || 0);
      if (data?.uses != null) setUses(Number(data.uses) || 0);
      if (data?.ok === false && data?.error === "rate_limited") {
        onToast?.("Too many votes — try again in a minute");
      }
    } finally {
      setBusy(false);
    }
  }, [item?.id, upvoted, busy, onToast, onUpvoteChange]);

  if (!item?.id) return null;

  if (variant === "inline") {
    // Quiet proof line — skip when everything is still zero.
    if (!views && !uses && !upvotes) return null;
    return (
      <p className="meme-stats-inline" aria-label="Meme engagement">
        <span title="Views">{formatStatCount(views)}</span>
        <span className="meme-stat-sep" aria-hidden>
          ·
        </span>
        <span title="Downloads + shares">{formatStatCount(uses)} uses</span>
      </p>
    );
  }

  return (
    <div className="meme-stats meme-stats--share" aria-label="Meme engagement">
      <span className="meme-stat" title="Views">
        <span className="meme-stat-value">{formatStatCount(views)}</span>
        <span className="meme-stat-label">views</span>
      </span>
      <span className="meme-stat-sep" aria-hidden>
        ·
      </span>
      <span className="meme-stat" title="Downloads + shares">
        <span className="meme-stat-value">{formatStatCount(uses)}</span>
        <span className="meme-stat-label">uses</span>
      </span>
      <button
        type="button"
        className={`meme-upvote-btn${upvoted ? " is-upvoted" : ""}`}
        aria-pressed={upvoted}
        aria-label={upvoted ? "Upvoted" : "Upvote"}
        title={upvoted ? "You upvoted this" : "Upvote"}
        disabled={upvoted || busy}
        onClick={onUpvote}
      >
        <span aria-hidden>👍</span>
        <span className="meme-upvote-count">{formatStatCount(upvotes)}</span>
      </button>
    </div>
  );
}

/** Upvote control sized for the icon action row. */
export function MemeUpvoteButton({ item, compact = false, onToast }) {
  const [upvotes, setUpvotes] = useState(Number(item?.upvotes) || 0);
  const [upvoted, setUpvoted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUpvotes(Number(item?.upvotes) || 0);
  }, [item?.id, item?.upvotes]);

  useEffect(() => {
    if (!item?.id) return;
    setUpvoted(hasLocalUpvote(item.id));
  }, [item?.id]);

  const onUpvote = useCallback(async () => {
    if (!item?.id || upvoted || busy) return;
    setBusy(true);
    setUpvoted(true);
    setUpvotes((n) => n + 1);
    markLocalUpvote(item.id);
    try {
      const res = await trackEngagement(item.id, "upvote");
      if (!res) return;
      const data = await res.json().catch(() => null);
      if (data?.upvotes != null) setUpvotes(Number(data.upvotes) || 0);
      if (data?.ok === false && data?.error === "rate_limited") {
        onToast?.("Too many votes — try again in a minute");
      }
    } finally {
      setBusy(false);
    }
  }, [item?.id, upvoted, busy, onToast]);

  if (!item?.id) return null;

  return (
    <button
      type="button"
      className={`meme-icon-btn meme-upvote-icon${upvoted ? " is-upvoted" : ""}`}
      aria-pressed={upvoted}
      aria-label={upvoted ? `Upvoted, ${upvotes}` : `Upvote, ${upvotes}`}
      title={upvoted ? "You upvoted this" : "Upvote"}
      disabled={upvoted || busy}
      onClick={onUpvote}
    >
      <span className="meme-upvote-icon-count">{formatStatCount(upvotes)}</span>
      <span className="meme-upvote-icon-emoji" aria-hidden>
        👍
      </span>
    </button>
  );
}
