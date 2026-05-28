"use client";

import { useCallback, useState } from "react";
import SharePageActions from "../../components/SharePageActions";

export default function ShareGalleryActions({ item }) {
  const [toast, setToast] = useState("");

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  return (
    <>
      <SharePageActions item={item} onToast={showToast} />
      <div className={`toast ${toast ? "visible" : ""}`}>{toast}</div>
    </>
  );
}
