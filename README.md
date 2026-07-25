# Astro Tech · 3D Image Animation

The original astronaut clip, turned into a **3D experience** with
**Three.js** + **GSAP**. The footage itself is left completely untouched — it
plays on a plane inside a 3D scene, and the **camera** moves around it (dolly +
mouse/touch parallax + tilt), so the flat video gains real dimensional camera
motion. A field of dust particles floats between the camera and the plane, so
every camera move parallaxes them across the footage for a genuine depth cue.

## How it works

| Piece            | Role                                                             |
| ---------------- | --------------------------------------------------------------- |
| `THREE.VideoTexture` | the clip drawn onto a plane, sized to always cover the viewport |
| GSAP timeline    | slow looping camera **dolly** (yoyo) + endless dust drift        |
| Pointer parallax | camera **translates** toward the cursor and **tilts** slightly   |
| Dust particles   | float in front of the plane → parallax = depth against the video |

The camera's ambient dolly (GSAP) drives a `dolly` object; the per-frame pointer
parallax is composed **on top** of it in the render loop, so the two systems
never overwrite each other. `prefers-reduced-motion` disables the ambient dolly.

The plane is scaled to "cover" the 16:9 video at the farthest camera distance,
with overscan, so panning/tilting the camera never reveals the plane edges.

## Video sources & compatibility

The clip is provided in two formats so it plays everywhere:

```
assets/astronaut.mp4    H.264  — best quality (Chrome, Edge, Safari, Firefox)
assets/astronaut.webm   VP9    — fallback for browsers without H.264
```

Both are declared as `<source>` elements; the browser picks the first it can
play. The video is `muted`, `loop`, `playsinline` so it autoplays; if a browser
still blocks autoplay, a "tap to enter" gate starts it on the first click.

## Running locally

Serve over HTTP (the video and modules won't load from a `file://` page):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Everything runs offline — Three.js and GSAP are vendored in `/vendor`.

## Files

```
index.html        markup, <video> sources, import map, vendored scripts
styles/style.css  layout, loader, tap-to-start gate, caption
js/main.js        scene, video plane, dust, GSAP camera dolly + parallax
js/textures.js    procedural dust-particle sprite
assets/           astronaut.mp4 + astronaut.webm
vendor/           three.module.js + gsap.min.js
```

## Tuning

In `js/main.js`:

- `PAN` / `TILT` — how far the camera translates / rotates toward the cursor.
- `OVERSCAN` — plane cover margin; raise it if you increase `PAN`/`TILT`.
- The GSAP `tl.to(dolly, …)` block — the ambient camera move (distance & speed).
- `DUST` — particle count for the depth field.
