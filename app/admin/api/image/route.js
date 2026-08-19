// Serves eval images from data/evals/images. Box-only (ADMIN_UI gate) and
// path-validated so it can never read outside the images directory.
import fs from "fs";
import path from "path";
import { IMAGES_DIR } from "../../../../agentic/db.js";

export async function GET(request) {
  if (process.env.ADMIN_UI !== "true") {
    return new Response("Not found", { status: 404 });
  }
  const p = new URL(request.url).searchParams.get("p") || "";
  const resolved = path.resolve(IMAGES_DIR, p);
  if (!resolved.startsWith(path.resolve(IMAGES_DIR) + path.sep)) {
    return new Response("Bad path", { status: 400 });
  }
  if (!fs.existsSync(resolved)) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(fs.readFileSync(resolved), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
