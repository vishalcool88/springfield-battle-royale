// ============================================================
//   SCREENSHOTS -- for showing the game off
//
//   P            = screenshot WITH the HUD (health, ammo, minimap)
//   Shift + P    = clean screenshot, no HUD at all -- the good one
//                  for posters, thumbnails and showing people
//
//   Shots land in your Downloads folder. Move the ones you like
//   into the game's screenshots/ folder to keep them together.
// ============================================================

/**
 * Grabs whatever is on screen right now and saves it as a PNG.
 *
 * The tricky bit: a browser normally WIPES the 3D canvas the instant
 * it's finished drawing, so if you ask for the picture even a moment
 * later you get a blank image. Two things stop that here --
 * `preserveDrawingBuffer: true` on the renderer (see main.js), and
 * re-drawing the frame immediately before we grab it.
 */
export function takeScreenshot({ renderer, scene, camera, ui, hideHud = false }) {
  const hud = document.querySelector(".hud");
  const hint = document.getElementById("hint");

  // For a clean shot, hide the HUD, redraw, grab, then put it back.
  const hudWasVisible = hud && hud.style.display !== "none";
  if (hideHud && hud) hud.style.display = "none";
  if (hideHud && hint) hint.style.visibility = "hidden";

  // Redraw this exact frame so the canvas definitely has pixels in it.
  renderer.render(scene, camera);

  let dataUrl;
  try {
    dataUrl = renderer.domElement.toDataURL("image/png");
  } catch (err) {
    console.error("Screenshot failed:", err);
    ui?.toast("Screenshot failed", 0xff6b6b);
    return null;
  } finally {
    // Always put the HUD back, even if something went wrong.
    if (hideHud && hud && hudWasVisible) hud.style.display = "";
    if (hideHud && hint) hint.style.visibility = "";
  }

  download(dataUrl, buildFilename(hideHud));
  ui?.toast(hideHud ? "Clean screenshot saved!" : "Screenshot saved!", 0x6bf06b);
  return dataUrl;
}

/** Names files like springfield-2026-08-15_19-42-08.png so they sort nicely. */
function buildFilename(isClean) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `springfield${isClean ? "-clean" : ""}-${stamp}.png`;
}

/** Makes the browser save a data URL to the Downloads folder. */
function download(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
