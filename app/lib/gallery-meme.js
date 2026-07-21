// Gallery meme definitions: clean base + zones + captions → rendered PNG.
//
// Gallery cards are cached renders for browsing. Edits re-render from the
// same curated art (clean template or gallery PNG with captions erased).

import { getFormatById } from "./meme-formats.js";
import {
  renderMeme,
  resolveGalleryEditFormat,
  resolveGalleryEditTemplate,
} from "./render.js";

/**
 * Resolve the caption-free base image and zone layout for a gallery item.
 *
 * @param {object} galleryItem
 * @param {object|null} format
 * @param {{ forEdit?: boolean }} options
 *   forEdit=true keeps the gallery photo when no dedicated clean template exists.
 */
export function resolveGalleryMemeSpec(galleryItem, format = null, { forEdit = false } = {}) {
  const fmt = format || getFormatById(galleryItem.remixFormatId);
  if (!fmt) throw new Error(`Unknown format: ${galleryItem.remixFormatId}`);

  const galleryFile = galleryItem.file;
  const cleanBase =
    galleryItem.cleanBase ||
    resolveGalleryEditTemplate(fmt, galleryFile, { forEdit });

  const resolvedFormat = forEdit
    ? resolveGalleryEditFormat(fmt, galleryFile)
    : resolveGalleryMemeBuildFormat(fmt, cleanBase);

  return {
    format: resolvedFormat,
    cleanBase,
  };
}

function resolveGalleryMemeBuildFormat(fmt, cleanBase) {
  const useGalleryZones =
    fmt.galleryZones?.length && cleanBase === fmt.galleryTemplate;
  const zones = useGalleryZones ? fmt.galleryZones : fmt.zones;
  return { ...fmt, zones };
}

/**
 * Render a gallery meme from its definition (clean base + captions).
 */
export async function renderGalleryMeme(galleryItem, captions, options = {}) {
  const { format, cleanBase } = resolveGalleryMemeSpec(galleryItem, null, options);
  return renderMeme(format, captions, { cleanBase });
}
