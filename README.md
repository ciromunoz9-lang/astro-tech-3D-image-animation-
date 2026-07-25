# Astro Tech · 3D Photo Hero

A drop-in **3D-photo hero** for any website. A still + a depth map become a
depth-parallax "3D photo": near pixels (the astronaut) shift more than far ones
(the sun, the stars) as the visitor moves the cursor — with a gentle ambient
sway when idle. Ships as a self-contained **16:9 block**. Only dependency is
**Three.js** (vendored, offline).

## Drop-in usage

Copy this into any page and host the `assets/`, `vendor/`, and `js/` folders
alongside it:

```html
<div
  id="astro-hero"
  data-photo="./assets/photo.jpg"
  data-depth="./assets/depth.png"
  data-fill="0.55"
  data-center-y="0.57"
  style="width:100%; max-width:1600px; aspect-ratio:16/9;"
></div>

<script type="importmap">
  { "imports": { "three": "./vendor/three.module.js" } }
</script>
<script type="module" src="./js/astro-hero.js"></script>
```

Any element with `id="astro-hero"` or a `data-astro-hero` attribute is mounted
automatically. The block is **16:9** by default; override with your own CSS
`aspect-ratio` (or set `data-no-aspect` and size it yourself). Multiple heroes
on one page are supported.

### Mount it yourself

```js
import { mountAstroHero } from "./js/astro-hero.js";
const hero = mountAstroHero(document.querySelector("#hero"), { fill: 0.4 });
hero.setFill(0.7);   // retune live
hero.destroy();      // tear down
```

## Options (data-\* attributes or opts)

| Option        | Default     | Meaning                                                    |
| ------------- | ----------- | ---------------------------------------------------------- |
| `photo`       | photo.jpg   | colour image                                               |
| `depth`       | depth.png   | depth map — **white = near, black = far**                  |
| `image-aspect`| 816/1104    | source image aspect ratio                                  |
| `fill`        | 0.55        | 0 = whole photo + blurred bars · 1 = full-bleed (crops)    |
| `center-y`    | 0.57        | vertical crop centre (raise to keep more of the feet)      |
| `zoom`        | 1.08        | parallax safety margin + Ken-Burns base                    |
| `pointer-amp` | 0.026       | strength of the cursor/tilt parallax                       |
| `ambient-amp` | 0.01        | strength of the idle sway                                  |

- Want the **entire astronaut** head-to-feet? Lower `fill` toward `0.2–0.3`.
- Want **edge-to-edge**? Raise `fill` toward `1.0`.

Events: the element emits `astro-hero:ready` and `astro-hero:error`.
`prefers-reduced-motion` disables the ambient motion.

## Regenerating the depth map

`tools/make_depth.py` builds the depth map from the photo (center bias +
luminance, sun masked to "far", blurred). Swap in your own photo and re-run:

```bash
python3 tools/make_depth.py path/to/photo.jpg assets/depth.png
```

For higher fidelity, replace `depth.png` with output from a monocular depth
model (MiDaS, Depth-Anything, …); white = near.

## Running the demo

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Files

```
index.html        demo page embedding the hero as a 16:9 block
styles/style.css  demo-page chrome + .astro-hero block styling
js/astro-hero.js  the reusable drop-in component (Three.js only)
assets/           photo.jpg + depth.png
tools/            make_depth.py (depth-map generator)
vendor/           three.module.js
```
