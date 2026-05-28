import { fetchSquarePngBlob } from "./download-square";
import { absoluteUrl } from "./share-links";

/**
 * Share the meme as an image file (WhatsApp, iMessage, etc.).
 * Falls back to opening a link or copying when the device cannot attach files.
 */
export async function shareMemeAsFile({
  imageUrl,
  title = "Teacher meme",
  text = "",
  pageUrl = "",
}) {
  if (!imageUrl || typeof navigator === "undefined") {
    return { ok: false, method: "unsupported" };
  }

  const src = absoluteUrl(imageUrl);
  const blob = await fetchSquarePngBlob(src);
  const file = new File([blob], "classroom-meme.png", { type: "image/png" });
  const caption = [text, pageUrl].filter(Boolean).join("\n");

  if (navigator.share) {
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: caption || undefined,
        });
        return { ok: true, method: "file" };
      }
      if (pageUrl && navigator.canShare?.({ url: pageUrl })) {
        await navigator.share({ title, text: caption || text, url: pageUrl });
        return { ok: true, method: "url" };
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        return { ok: false, method: "cancelled" };
      }
      throw err;
    }
  }

  return { ok: false, method: "unsupported" };
}
