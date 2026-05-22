"use client";

import { useEffect, useRef } from "react";

/** Fire-and-forget view count for community meme ranking. */
export default function MemeViewTracker({ memeId }) {
  const sent = useRef(false);

  useEffect(() => {
    if (!memeId || sent.current) return;
    sent.current = true;
    fetch(`/api/meme/${encodeURIComponent(memeId)}/view`, {
      method: "POST",
    }).catch(() => {});
  }, [memeId]);

  return null;
}
