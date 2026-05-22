"use client";

import { useCallback, useState } from "react";
import SharePanel from "../../components/SharePanel";
import MemeQuickActions from "../../components/MemeQuickActions";
import LolSignupStrip from "../../components/LolSignupStrip";

export default function ShareGalleryActions({ item }) {
  const [toast, setToast] = useState("");
  const [showSocial, setShowSocial] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  return (
    <>
      <MemeQuickActions
        item={item}
        onToast={showToast}
        onShareMore={() => setShowSocial(true)}
      />
      {showSocial ? (
        <SharePanel item={item} onToast={showToast} />
      ) : null}
      <LolSignupStrip />
      <div className={`toast ${toast ? "visible" : ""}`}>{toast}</div>
    </>
  );
}
