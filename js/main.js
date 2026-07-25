import * as THREE from "three";
import {
  createStarfieldTexture,
  createSunTexture,
  createMoonTexture,
  createParticleTexture
} from "./textures.js";

/* ------------------------------------------------------------------ *
 *  Astro Tech · 3D Image Animation
 *
 *  A layered space parallax inspired by the reference clip: a glowing
 *  golden sun, a cratered moon, a deep amber/white star field and a
 *  drifting debris field.
 *
 *  Structure (as specced):
 *    scene · camera(45°, far 1000, z 7) · renderer(alpha) → body
 *    background / midground / foreground / particles  = THREE.Group
 *
 *  Two animation systems, deliberately kept on separate targets so
 *  they compose instead of overwriting each other:
 *    1. GSAP timeline  → camera dolly + mesh "breathing" + particle spin
 *    2. Mouse parallax → GROUP positions, depth-ordered
 * ------------------------------------------------------------------ */

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

/* ------------------------------ scene ---------------------------- */
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 7;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ---------------------------- lighting --------------------------- */
scene.add(new THREE.AmbientLight(0x8fb7ff, 0.7));
const sunLight = new THREE.DirectionalLight(0xffe6b0, 1.2);
sunLight.position.set(6, 4, 5); // from the sun's corner
scene.add(sunLight);

/* ------------------------------ groups --------------------------- */
const background = new THREE.Group();
const midground = new THREE.Group();
const foreground = new THREE.Group();
const particles = new THREE.Group();

scene.add(background, midground, foreground, particles);

// depth: z grows toward the camera → larger parallax up front
background.position.z = -22;
midground.position.z = -9;
foreground.position.z = 1.5;

/* ------------- helper: image plane added to a layer group -------- */
function addPlane(group, texture, { w, h, x = 0, y = 0, transparent = true }) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent,
      depthWrite: !transparent
    })
  );
  mesh.position.set(x, y, 0);
  mesh.userData.base = mesh.position.clone(); // resting anchor for drift
  group.add(mesh);
  return mesh;
}

// BACKGROUND — full-bleed star field
const bgMesh = addPlane(background, createStarfieldTexture(), {
  w: 80,
  h: 48,
  transparent: false
});

// MIDGROUND — the sun, pushed to the upper-right like the reference
const sunMesh = addPlane(midground, createSunTexture(), {
  w: 16,
  h: 16,
  x: 9,
  y: 4
});
sunMesh.material.blending = THREE.AdditiveBlending;

// FOREGROUND — the cratered moon, lower-left focal element
const moonMesh = addPlane(foreground, createMoonTexture(), {
  w: 4.5,
  h: 4.5,
  x: -3.2,
  y: -1.6
});

/* ---------------------------- particles -------------------------- */
const particleCount = 1100;
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  positions[i * 3 + 0] = (Math.random() - 0.5) * 44;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 28;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 22 - 4;
}
const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(positions, 3)
);
particles.add(
  new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      size: 0.13,
      map: createParticleTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffd9a8
    })
  )
);

/* ===================================================================
 *  GSAP — ambient timeline
 *  camera dolly (yoyo) + gentle mesh breathing + endless particle spin.
 *  These targets are never touched by the mouse handler below.
 * =================================================================== */
if (!prefersReducedMotion && window.gsap) {
  const tl = gsap.timeline({ repeat: -1, yoyo: true });

  tl.to(camera.position, {
    x: 1.2,
    y: 0.4,
    z: 6,
    duration: 8,
    ease: "power2.inOut"
  })
    .to(
      moonMesh.position,
      { x: moonMesh.userData.base.x - 0.4, y: moonMesh.userData.base.y + 0.2, duration: 6, ease: "sine.inOut" },
      "<"
    )
    .to(
      sunMesh.position,
      { x: sunMesh.userData.base.x + 0.25, y: sunMesh.userData.base.y - 0.15, duration: 7, ease: "sine.inOut" },
      "<"
    );

  // endless, constant-speed rotation of the whole debris field
  gsap.to(particles.rotation, {
    z: Math.PI * 2,
    duration: 40,
    ease: "none",
    repeat: -1
  });
}

/* ===================================================================
 *  Mouse parallax — depth-ordered
 *
 *    Mouse moves right →
 *      Background  moves slightly right
 *      Midground   moves moderately right
 *      Foreground  moves dramatically right
 *    → REALISTIC DEPTH
 * =================================================================== */
const PARALLAX = [
  { group: background, amp: 0.5 }, // farthest  → slight
  { group: midground, amp: 1.4 }, // middle    → moderate
  { group: foreground, amp: 3.0 } // nearest   → dramatic
];

window.addEventListener("mousemove", (event) => {
  const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  const mouseY = (event.clientY / window.innerHeight) * 2 - 1;

  gsap.to(camera.rotation, {
    x: mouseY * 0.05,
    y: mouseX * 0.09,
    duration: 1.5,
    ease: "power3.out",
    overwrite: "auto"
  });

  for (const { group, amp } of PARALLAX) {
    gsap.to(group.position, {
      x: mouseX * amp,
      y: -mouseY * amp * 0.6,
      duration: 1.2,
      ease: "power3.out",
      overwrite: "auto"
    });
  }
});

/* ---- touch support: drive the same parallax from the first touch -- */
window.addEventListener(
  "touchmove",
  (event) => {
    const t = event.touches[0];
    if (!t) return;
    const mouseX = (t.clientX / window.innerWidth) * 2 - 1;
    const mouseY = (t.clientY / window.innerHeight) * 2 - 1;
    for (const { group, amp } of PARALLAX) {
      gsap.to(group.position, {
        x: mouseX * amp,
        y: -mouseY * amp * 0.6,
        duration: 1.2,
        ease: "power3.out",
        overwrite: "auto"
      });
    }
  },
  { passive: true }
);

/* ------------------------------ render --------------------------- */
const clock = new THREE.Clock();

function tick() {
  const t = clock.getElapsedTime();
  // subtle idle float so the scene breathes even without input
  moonMesh.position.z = Math.sin(t * 0.7) * 0.06;
  sunMesh.rotation.z = t * 0.02; // slow solar churn
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
});

/* ------------------------- reveal the scene ---------------------- */
window.addEventListener("load", () => {
  document.getElementById("loader")?.classList.add("is-hidden");
  document.getElementById("overlay")?.classList.add("is-visible");
});
