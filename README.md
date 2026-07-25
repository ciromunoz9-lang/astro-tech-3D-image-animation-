# Astro Tech · 3D Photo Animation

A single still — a hero frame from the astronaut clip — turned into a living
**3D photo** with **Three.js** + **GSAP**. A depth map drives a fragment shader
that offsets each pixel by its depth: near pixels (the astronaut) shift more than
far ones (the sun, the stars), so moving the cursor — or just watching the
ambient sway — reveals genuine parallax depth. Sized as a full-bleed website
hero, with the letterbox area filled by a blurred cover of the same image.

## How it works

| Piece            | Role                                                           |
| ---------------- | -------------------------------------------------------------- |
| `assets/photo.jpg` | the colour image (hero frame)                                |
| `assets/depth.png` | per-pixel depth — **white = near, black = far**              |
| Fragment shader  | offsets UVs by `depth × pointer` → parallax; blurred fill bg   |
| GSAP             | a slow figure-eight ambient sway + gentle Ken-Burns zoom       |
| Pointer          | mouse / touch / device-tilt add a stronger, eased parallax     |

Ambient motion (GSAP) and pointer parallax are composed together in the render
loop, never overwriting each other. `prefers-reduced-motion` disables the
ambient animation.

## Framing / "website size"

The source frame is portrait (816×1104). The shader scales it between **contain**
(whole photo, letterboxed) and **cover** (full-bleed, cropped) so it fits a
widescreen hero. Tune it in `js/main.js`:

```js
uFill:    { value: 0.55 }  // 0 = whole photo + bars · 1 = full-bleed (more crop)
uCenterY: { value: 0.57 }  // vertical crop centre (raise to keep more of the feet)
uZoom:    { value: 1.08 }  // parallax safety margin + Ken-Burns base
```

- Want the **entire astronaut** (head to feet) visible? Lower `uFill` toward
  `0.2–0.3` (the sides get blurred-fill bars).
- Want an **edge-to-edge** banner? Raise `uFill` toward `1.0` (crops top/bottom).

## Regenerating the depth map

The depth map is generated from the frame by `tools/make_depth.py` (heuristic:
center bias + luminance, with the sun masked to "far", then blurred). To use a
different frame or your own photo, drop it in and re-run:

```bash
python3 tools/make_depth.py path/to/photo.jpg
```

For a higher-fidelity result you can replace `depth.png` with the output of any
monocular depth estimator (MiDaS, Depth-Anything, etc.) — white = near.

## Running locally

Serve over HTTP (modules + textures won't load from a `file://` page):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Runs fully offline — Three.js and GSAP are vendored in `/vendor`.

## Files

```
index.html        markup, import map, vendored scripts
styles/style.css  layout, loader, caption
js/main.js        shader, depth parallax, GSAP ambient, fill/framing controls
assets/           photo.jpg + depth.png
tools/            make_depth.py (depth-map generator)
vendor/           three.module.js + gsap.min.js
```
