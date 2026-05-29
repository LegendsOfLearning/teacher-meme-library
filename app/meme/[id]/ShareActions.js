"use client";

import { useCallback, useState } from "react";
import SharePageActions from "../../components/SharePageActions";

export default function ShareActions({ meme }) {
  const [toast, setToast] = useState("");

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  const captionText =
    Object.values(meme.captions || {})
      .filter((v) => typeof v === "string" && v.trim())
      .join(" / ") || meme.formatName;

  return (
    <>
      <SharePageActions
        meme={meme}
        share={{
          path: meme.sharePath,
          title: `${meme.formatName} · Teacher meme`,
          text: `Found my new favorite teacher meme: "${captionText}"`,
          imageUrl: meme.pngUrl,
        }}
        onToast={showToast}
      />
      <div className={`toast ${toast ? "visible" : ""}`}>{toast}</div>
    </>
  );
}
