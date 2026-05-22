// Pad a raster image to a square canvas (black letterbox) for social feeds.
// Works in the browser; server rendering uses padPngToSquare in render.js.

export async function blobToSquarePng(blob, background = "#000000") {
  if (typeof document === "undefined") {
    throw new Error("blobToSquarePng is browser-only");
  }
  const bitmap = await createImageBitmap(blob);
  const side = Math.max(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, side, side);
  const dx = Math.floor((side - bitmap.width) / 2);
  const dy = Math.floor((side - bitmap.height) / 2);
  ctx.drawImage(bitmap, dx, dy);
  bitmap.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (out) => {
        if (!out) reject(new Error("Could not encode square PNG"));
        else resolve(out);
      },
      "image/png",
      0.92
    );
  });
}

export async function fetchSquarePngBlob(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("Could not fetch image");
  return blobToSquarePng(await res.blob());
}

export async function fetchAndDownloadSquare(imageUrl, filename) {
  const square = await fetchSquarePngBlob(imageUrl);
  const url = URL.createObjectURL(square);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.[^.]+$/, "") + "-square.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Copy a square PNG to the clipboard (paste into Slack, email, etc.). */
export async function copyImageToClipboard(imageUrl) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Clipboard not supported");
  }
  const square = await fetchSquarePngBlob(imageUrl);
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": square }),
  ]);
}
