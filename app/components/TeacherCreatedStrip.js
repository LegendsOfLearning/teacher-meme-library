"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import ShareModal from "./ShareModal";
import MemeCardActions from "./MemeCardActions";
import {
  LOL_TEACHER_CREATED_HEADING,
  LOL_TEACHER_CREATED_LEAD,
} from "../lib/lol-copy";

function itemHref(item) {
  if (item.pagePath) return item.pagePath;
  return `/meme/${item.id}`;
}

/** Community saves ranked by views — only renders when we have real teacher memes. */
export default function TeacherCreatedStrip({ items }) {
  const [toast, setToast] = useState("");
  const [shareItem, setShareItem] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }, []);

  if (!items?.length) return null;

  return (
    <section className="teacher-created" aria-label={LOL_TEACHER_CREATED_HEADING}>
      <header className="teacher-created-header">
        <h2 className="teacher-created-title">{LOL_TEACHER_CREATED_HEADING}</h2>
        <p className="teacher-created-lead">{LOL_TEACHER_CREATED_LEAD}</p>
      </header>
      <div className="teacher-created-grid">
        {items.map((item) => (
          <article key={item.id} className="teacher-created-card">
            <Link href={itemHref(item)} className="teacher-created-thumb">
              <img src={item.file} alt={item.captionPreview} loading="lazy" />
            </Link>
            <p className="teacher-created-format">{item.formatName}</p>
            <MemeCardActions
              item={item}
              onShare={setShareItem}
              onToast={showToast}
              compact
            />
          </article>
        ))}
      </div>

      <ShareModal
        open={Boolean(shareItem)}
        onClose={() => setShareItem(null)}
        item={shareItem}
        onToast={showToast}
      />
      <div className={`toast ${toast ? "visible" : ""}`}>{toast}</div>
    </section>
  );
}
