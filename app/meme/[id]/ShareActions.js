"use client";

import { useCallback, useState } from "react";
import SharePanel from "../../components/SharePanel";
import MemeQuickActions from "../../components/MemeQuickActions";
import LolSignupStrip from "../../components/LolSignupStrip";

export default function ShareActions({ meme }) {
  const [toast, setToast] = useState("");
  const [showSocial, setShowSocial] = useState(false);

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
      <MemeQuickActions
        meme={meme}
        share={{
          path: meme.sharePath,
          title: `${meme.formatName} · Teacher meme`,
          text: `Found my new favorite teacher meme — "${captionText}"`,
          imageUrl: meme.pngUrl,
        }}
        onToast={showToast}
        onShareMore={() => setShowSocial(true)}
      />
      {showSocial ? (
        <SharePanel
          share={{
            path: meme.sharePath,
            title: `${meme.formatName} · Teacher meme`,
            text: `Found my new favorite teacher meme — "${captionText}"`,
            imageUrl: meme.pngUrl,
          }}
          onToast={showToast}
        />
      ) : null}
      <LolSignupStrip />
      <div className={`toast ${toast ? "visible" : ""}`}>{toast}</div>
    </>
  );
}
