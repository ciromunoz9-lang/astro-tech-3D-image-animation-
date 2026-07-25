import * as THREE from "three";
import { createParticleTexture } from "./textures.js";

/* ------------------------------------------------------------------ *
 *  Astro Tech · 3D Image Animation  —  "Video in 3D space"
 *
 *  The original astronaut clip is left completely untouched: it plays
 *  on a plane inside a Three.js scene. The CAMERA is what moves in 3D —
 *  a GSAP dolly plus mouse/touch parallax and tilt — so the flat footage
 *  gains real dimensional camera motion. A field of dust particles floats
 *  BETWEEN the camera and the video plane, so every camera move produces
 *  genuine depth parallax against the footage.
 * ------------------------------------------------------------------ */

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const VIDEO_ASPECT = 1920 / 1080; // source clip is 16:9

/* ------------------------------ scene ---------------------------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const CAMERA_BASE = new THREE.Vector3(0, 0, 12);
camera.position.copy(CAMERA_BASE);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ------------------------ the video texture ---------------------- */
const video = document.getElementById("source");
const videoTexture = new THREE.VideoTexture(video);
videoTexture.colorSpace = THREE.SRGBColorSpace;
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;

// unit plane (1×1); scaled to "cover" the viewport in fitPlane()
const videoPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: videoTexture })
);
videoPlane.position.z = 0;
scene.add(videoPlane);

/* ------------------------- foreground dust ----------------------- *
 *  Particles live between the camera (z≈12) and the plane (z=0).
 *  Because they sit at different depths than the footage, camera
 *  movement parallaxes them across it — the core 3D depth cue.
 * ------------------------------------------------------------------ */
const DUST = 320;
const dustPositions = new Float32Array(DUST * 3);
for (let i = 0; i < DUST; i++) {
  dustPositions[i * 3 + 0] = (Math.random() - 0.5) * 26;
  dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 16;
  dustPositions[i * 3 + 2] = 2 + Math.random() * 8; // in front of the plane
}
const dustGeometry = new THREE.BufferGeometry();
dustGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(dustPositions, 3)
);
const particles = new THREE.Points(
  dustGeometry,
  new THREE.PointsMaterial({
    size: 0.09,
    map: createParticleTexture(),
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: 0xffe3b0
  })
);
scene.add(particles);

/* --------- size the plane so the 16:9 video always covers --------- *
 *  Computed at the farthest camera distance so it stays covered while
 *  the dolly pushes in and the parallax pans the camera.
 * ------------------------------------------------------------------ */
const OVERSCAN = 1.5;
function fitPlane() {
  const dist = CAMERA_BASE.z - videoPlane.position.z;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const visibleH = 2 * Math.tan(vFov / 2) * dist;
  const visibleW = visibleH * camera.aspect;

  let w, h;
  if (camera.aspect > VIDEO_ASPECT) {
    w = visibleW;
    h = w / VIDEO_ASPECT;
  } else {
    h = visibleH;
    w = h * VIDEO_ASPECT;
  }
  videoPlane.scale.set(w * OVERSCAN, h * OVERSCAN, 1);
}
fitPlane();

/* ===================================================================
 *  GSAP — ambient camera choreography
 *  A slow, looping dolly (yoyo). It drives a plain `dolly` object rather
 *  than camera.position directly, so the per-frame parallax offset can be
 *  composed on top in tick() without the two writers fighting.
 * =================================================================== */
const dolly = { x: 0, y: 0, z: CAMERA_BASE.z };

if (!prefersReducedMotion && window.gsap) {
  const tl = gsap.timeline({ repeat: -1, yoyo: true });
  tl.to(dolly, {
    x: 0.8,
    y: 0.35,
    z: 10,
    duration: 8,
    ease: "power2.inOut"
  });

  gsap.to(particles.rotation, {
    z: Math.PI * 2,
    duration: 60,
    ease: "none",
    repeat: -1
  });
}

/* ===================================================================
 *  Mouse / touch parallax
 *  Translate the camera toward the cursor and tilt it slightly. The
 *  translation parallaxes the dust against the footage; the tilt gives
 *  the flat plane a genuine perspective shift → the "3D" read.
 * =================================================================== */
const parallax = { x: 0, y: 0 };

function applyPointer(nx, ny) {
  // nx, ny in [-1, 1]
  gsap.to(parallax, {
    x: nx,
    y: ny,
    duration: 1.3,
    ease: "power3.out",
    overwrite: "auto"
  });
}

window.addEventListener("mousemove", (e) => {
  applyPointer(
    (e.clientX / window.innerWidth) * 2 - 1,
    (e.clientY / window.innerHeight) * 2 - 1
  );
});
window.addEventListener(
  "touchmove",
  (e) => {
    const t = e.touches[0];
    if (!t) return;
    applyPointer(
      (t.clientX / window.innerWidth) * 2 - 1,
      (t.clientY / window.innerHeight) * 2 - 1
    );
  },
  { passive: true }
);

/* ------------------------------ render --------------------------- */
const PAN = 0.9; // camera translation amount
const TILT = 0.04; // camera rotation amount (radians)

function tick() {
  // Compose: ambient dolly (GSAP) + pointer parallax offset.
  camera.position.x = dolly.x + parallax.x * PAN;
  camera.position.y = dolly.y - parallax.y * PAN;
  camera.position.z = dolly.z;

  // Pointer-driven tilt gives the flat plane a real perspective shift.
  camera.rotation.x = parallax.y * TILT;
  camera.rotation.y = -parallax.x * TILT;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

/* ------------------------------ resize --------------------------- */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  fitPlane();
});

/* ------------------- start playback + reveal --------------------- */
const loader = document.getElementById("loader");
const caption = document.getElementById("caption");
const playgate = document.getElementById("playgate");

function reveal() {
  loader?.classList.add("is-hidden");
  caption?.classList.add("is-visible");
}

function startPlayback() {
  const p = video.play();
  if (p && typeof p.then === "function") {
    p.then(reveal).catch(() => {
      // autoplay blocked → show the tap-to-start gate
      loader?.classList.add("is-hidden");
      if (playgate) {
        playgate.hidden = false;
        playgate.addEventListener(
          "click",
          () => {
            video.play();
            playgate.hidden = true;
            caption?.classList.add("is-visible");
          },
          { once: true }
        );
      }
    });
  } else {
    reveal();
  }
}

if (video.readyState >= 2) {
  startPlayback();
} else {
  video.addEventListener("loadeddata", startPlayback, { once: true });
}
