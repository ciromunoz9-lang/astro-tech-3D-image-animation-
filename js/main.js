import * as THREE from "three";

/* ------------------------------------------------------------------ *
 *  Astro Tech · 3D Photo Animation
 *
 *  A single still (a hero frame from the astronaut clip) is turned into
 *  a living 3D photo. A depth map drives a fragment shader that offsets
 *  each pixel by its depth: near pixels (the astronaut) shift more than
 *  far pixels (the sun, the stars), so moving the cursor — or just
 *  watching the ambient sway — reveals genuine parallax depth.
 *
 *    photo.jpg  → colour
 *    depth.png  → per-pixel depth (white = near, black = far)
 * ------------------------------------------------------------------ */

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const IMAGE_ASPECT = 816 / 1104; // hero frame is portrait

/* ------------------------------ renderer/scene ------------------- */
const scene = new THREE.Scene();
// full-screen quad viewed through an orthographic camera
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* ------------------------------ shader --------------------------- */
const uniforms = {
  uImage: { value: null },
  uDepth: { value: null },
  uImageAspect: { value: IMAGE_ASPECT },
  uViewAspect: { value: window.innerWidth / window.innerHeight },
  uOffset: { value: new THREE.Vector2(0, 0) }, // parallax, in uv units
  uZoom: { value: 1.08 }, // slight zoom → margin for the parallax shift
  uVignette: { value: 0.35 },
  // 0 = whole photo letterboxed (contain) · 1 = full-bleed (cover, crops)
  // ~0.55 enlarges the frame to a website-hero size while keeping the subject
  uFill: { value: 0.55 },
  uCenterY: { value: 0.57 } // crop centre, biased down to keep head + feet
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uImage;
  uniform sampler2D uDepth;
  uniform float uImageAspect;
  uniform float uViewAspect;
  uniform vec2  uOffset;
  uniform float uZoom;
  uniform float uVignette;
  uniform float uFill;
  uniform float uCenterY;

  // cheap radial blur used to fill the letterbox area
  vec3 blurred(vec2 uv) {
    vec3 sum = vec3(0.0);
    const int N = 12;
    float r = 0.018;
    for (int i = 0; i < N; i++) {
      float a = 6.2831853 * float(i) / float(N);
      sum += texture2D(uImage, uv + vec2(cos(a), sin(a)) * r).rgb;
      sum += texture2D(uImage, uv + vec2(cos(a), sin(a)) * r * 0.5).rgb;
    }
    return sum / float(N * 2);
  }

  void main() {
    // ---- immersive background: a blurred "cover" of the same image ----
    vec2 cov = vec2(1.0);
    if (uViewAspect > uImageAspect) cov.y = uImageAspect / uViewAspect;
    else                            cov.x = uViewAspect / uImageAspect;
    vec2 cuv = (vUv - 0.5) * cov + 0.5;
    vec3 bg = blurred(cuv);
    bg = mix(vec3(0.02, 0.025, 0.05), bg, 0.55) * 0.6;

    // ---- foreground: the sharp, depth-parallaxed photo ----
    // scale between "contain" (whole photo) and "cover" (full-bleed) by uFill
    vec2 sContain, sCover;
    if (uViewAspect > uImageAspect) {
      sContain = vec2(uImageAspect / uViewAspect, 1.0);
      sCover   = vec2(1.0, uViewAspect / uImageAspect);
    } else {
      sContain = vec2(1.0, uViewAspect / uImageAspect);
      sCover   = vec2(uImageAspect / uViewAspect, 1.0);
    }
    vec2 s = mix(sContain, sCover, uFill);
    vec2 base = vec2((vUv.x - 0.5) / s.x + 0.5,
                     (vUv.y - 0.5) / s.y + uCenterY);

    if (base.x < 0.0 || base.x > 1.0 || base.y < 0.0 || base.y > 1.0) {
      gl_FragColor = vec4(bg, 1.0); // any remaining bars → blurred fill
      return;
    }

    // zoom in slightly so the parallax offset never samples past the edge
    vec2 uv = (base - 0.5) / uZoom + 0.5;

    // depth: white = near. Shift near pixels more than far ones.
    float d = texture2D(uDepth, uv).r;
    vec2 p = uOffset * (d - 0.45);
    vec3 col = texture2D(uImage, clamp(uv + p, 0.0, 1.0)).rgb;

    // soft vignette + a thin dark edge so the photo reads as a floating card
    vec2 q = base - 0.5;
    float vig = 1.0 - uVignette * dot(q, q) * 2.2;
    float edge = smoothstep(0.0, 0.03, base.x) * smoothstep(1.0, 0.97, base.x)
               * smoothstep(0.0, 0.03, base.y) * smoothstep(1.0, 0.97, base.y);
    gl_FragColor = vec4(mix(bg, col * vig, edge), 1.0);
  }
`;

const quad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
);
scene.add(quad);

/* ------------------------------ load ----------------------------- */
const loader = new THREE.TextureLoader();
const loadTex = (url) =>
  new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));

Promise.all([loadTex("./assets/photo.jpg"), loadTex("./assets/depth.png")])
  .then(([image, depth]) => {
    image.colorSpace = THREE.SRGBColorSpace;
    image.minFilter = THREE.LinearFilter;
    depth.minFilter = THREE.LinearFilter;
    depth.magFilter = THREE.LinearFilter;
    uniforms.uImage.value = image;
    uniforms.uDepth.value = depth;

    document.getElementById("loader")?.classList.add("is-hidden");
    document.getElementById("caption")?.classList.add("is-visible");
    startAmbient();
  })
  .catch((err) => {
    const l = document.getElementById("loader");
    if (l) l.querySelector("p").textContent = "Failed to load images";
    console.error(err);
  });

/* ===================================================================
 *  Motion
 *    ambient : a slow GSAP figure-eight so the photo breathes on its own
 *    pointer : mouse / touch / device tilt add a stronger parallax
 *  Both are composed in tick() into uOffset — never overwriting.
 * =================================================================== */
const AMBIENT_AMP = 0.010; // uv units
const POINTER_AMP = 0.026; // uv units
const ambient = { x: 0, y: 0 };
const pointer = { x: 0, y: 0 }; // target, in [-1, 1]
const pointerEased = { x: 0, y: 0 };

function startAmbient() {
  if (prefersReducedMotion || !window.gsap) return;
  const tl = gsap.timeline({ repeat: -1, yoyo: true });
  tl.to(ambient, { x: 1, duration: 6, ease: "sine.inOut" })
    .to(ambient, { x: -1, duration: 6, ease: "sine.inOut" });
  gsap.to(ambient, {
    y: 1,
    duration: 4.5,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true
  });
  // gentle Ken-Burns zoom
  gsap.to(uniforms.uZoom, {
    value: 1.14,
    duration: 12,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true
  });
}

function setPointer(nx, ny) {
  pointer.x = Math.max(-1, Math.min(1, nx));
  pointer.y = Math.max(-1, Math.min(1, ny));
}

window.addEventListener("mousemove", (e) => {
  setPointer(
    (e.clientX / window.innerWidth) * 2 - 1,
    (e.clientY / window.innerHeight) * 2 - 1
  );
});
window.addEventListener(
  "touchmove",
  (e) => {
    const t = e.touches[0];
    if (!t) return;
    setPointer(
      (t.clientX / window.innerWidth) * 2 - 1,
      (t.clientY / window.innerHeight) * 2 - 1
    );
  },
  { passive: true }
);

// device orientation (mobile tilt) → parallax
window.addEventListener("deviceorientation", (e) => {
  if (e.gamma == null || e.beta == null) return;
  setPointer(
    Math.max(-1, Math.min(1, e.gamma / 30)),
    Math.max(-1, Math.min(1, (e.beta - 45) / 30))
  );
});

/* ------------------------------ render --------------------------- */
function tick() {
  // ease the pointer for smoothness
  pointerEased.x += (pointer.x - pointerEased.x) * 0.06;
  pointerEased.y += (pointer.y - pointerEased.y) * 0.06;

  uniforms.uOffset.value.set(
    ambient.x * AMBIENT_AMP + pointerEased.x * POINTER_AMP,
    -(ambient.y * AMBIENT_AMP + pointerEased.y * POINTER_AMP)
  );

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

/* ------------------------------ resize --------------------------- */
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  uniforms.uViewAspect.value = window.innerWidth / window.innerHeight;
});
