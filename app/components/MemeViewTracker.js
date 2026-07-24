"use client";

import { useEffect, useRef } from "react";
import { trackEngagement } from "../lib/engagement-client";

/**
 * Fire-and-forget view bump.
 * - community: /api/meme/[id]/view (persisted on meme record)
 * - gallery (+ also community engagement score): /api/engagement view
 */
export default function MemeViewTracker({ memeId, community = false }) {
  const sent = useRef(false);

  useEffect(() => {
    if (!memeId || sent.current) return;
    sent.current = true;
    if (community) {
      fetch(`/api/meme/${encodeURIComponent(memeId)}/view`, {
        method: "POST",
      }).catch(() => {});
    }
    trackEngagement(memeId, "view");
  }, [memeId, community]);

  return null;
}
