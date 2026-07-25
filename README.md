# Astro Tech · 3D Image Animation

A layered space parallax scene built with **Three.js** and **GSAP**. Inspired by
a cinematic "astronaut in orbit" clip, it composes a glowing golden sun, a
cratered moon, a deep amber/white star field and a drifting debris field into a
scene with real, depth-ordered parallax.

Everything is generated procedurally on `<canvas>` — there are **no external
image assets**, so the project runs straight from a static server.

## Live structure

The scene is organised into four `THREE.Group` layers, ordered by depth:

| Layer        | Group        | Content                    | Depth (z) | Parallax |
| ------------ | ------------ | -------------------------- | --------- | -------- |
| Background   | `background` | star field + nebula        | `-22`     | slight   |
| Midground    | `midground`  | glowing sun (upper-right)  | `-9`      | moderate |
| Foreground   | `foreground` | cratered moon (lower-left) | `1.5`     | dramatic |
| Particles    | `particles`  | drifting amber debris      | —         | spins    |

## Animation systems

Two systems run at once, deliberately kept on **separate targets** so they
compose rather than overwrite one another:

1. **GSAP ambient timeline** — a looping, yoyo camera dolly (`camera.position`),
   gentle "breathing" on the sun/moon meshes, and an endless constant-speed spin
   of the particle field (`particles.rotation`).
2. **Mouse / touch parallax** — every layer follows the cursor in the **same
   direction**, with amplitude scaling by proximity to the camera:

   ```
   Mouse moves right →
     Background   moves slightly right
     Midground    moves moderately right
     Foreground   moves dramatically right
   → REALISTIC DEPTH
   ```

   The camera also tilts subtly toward the cursor (`camera.rotation`).

`prefers-reduced-motion` is respected: the ambient timeline is skipped for users
who ask for reduced motion.

## Running locally

The page loads Three.js (import map) and GSAP from a CDN, so serve it over HTTP
rather than opening the file directly:

```bash
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000
```

## Files

```
index.html        markup, import map, CDN scripts
styles/style.css  layout, overlay title, loader
js/main.js        scene, groups, GSAP timeline, parallax
js/textures.js    procedural canvas textures (starfield, sun, moon, particle)
```

## Swapping in real artwork

Any layer can use a real image instead of the procedural texture. In `main.js`,
replace the `create*Texture()` call with a loaded image, e.g. a cut-out
astronaut PNG for the foreground:

```js
const astronaut = new THREE.TextureLoader().load("assets/astronaut.png");
const fgMesh = addPlane(foreground, astronaut, { w: 5, h: 7, x: 0, y: -0.5 });
```
