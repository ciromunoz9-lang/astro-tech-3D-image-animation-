import * as THREE from "three";

/* ==================================================================== *
 *  <astro-hero>  ·  drop-in 3D-photo hero
 *
 *  Turns a still + depth map into a depth-parallax "3D photo" that lives
 *  inside a container element (sized by the container, not the window),
 *  so it embeds anywhere as a block. Only dependency is three.js.
 *
 *  Usage (drop-in):
 *    <div id="astro-hero"
 *         data-photo="assets/photo.jpg"
 *         data-depth="assets/depth.png"
 *         data-fill="0.55"></div>
 *    <script type="importmap">
 *      { "imports": { "three": "vendor/three.module.js" } }
 *    </script>
 *    <script type="module" src="js/astro-hero.js"></script>
 *
 *  Any element with id="astro-hero" or a [data-astro-hero] attribute is
 *  mounted automatically. Or call mountAstroHero(el, opts) yourself.
 * ==================================================================== */

const PREFERS_REDUCED = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

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
    // immersive background: a blurred "cover" of the same image
    vec2 cov = vec2(1.0);
    if (uViewAspect > uImageAspect) cov.y = uImageAspect / uViewAspect;
    else                            cov.x = uViewAspect / uImageAspect;
    vec2 cuv = (vUv - 0.5) * cov + 0.5;
    vec3 bg = blurred(cuv);
    bg = mix(vec3(0.02, 0.025, 0.05), bg, 0.55) * 0.6;

    // foreground: sharp, depth-parallaxed photo scaled contain..cover
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
      gl_FragColor = vec4(bg, 1.0);
      return;
    }

    vec2 uv = (base - 0.5) / uZoom + 0.5;
    float d = texture2D(uDepth, uv).r;
    vec2 p = uOffset * (d - 0.45);
    vec3 col = texture2D(uImage, clamp(uv + p, 0.0, 1.0)).rgb;

    vec2 q = base - 0.5;
    float vig = 1.0 - uVignette * dot(q, q) * 2.2;
    float edge = smoothstep(0.0, 0.03, base.x) * smoothstep(1.0, 0.97, base.x)
               * smoothstep(0.0, 0.03, base.y) * smoothstep(1.0, 0.97, base.y);
    gl_FragColor = vec4(mix(bg, col * vig, edge), 1.0);
  }
`;

function num(v, fallback) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

export function mountAstroHero(el, opts = {}) {
  if (!el || el.__astroHeroMounted) return null;
  el.__astroHeroMounted = true;

  const cfg = {
    photo: opts.photo || el.dataset.photo || "assets/photo.jpg",
    depth: opts.depth || el.dataset.depth || "assets/depth.png",
    imageAspect: num(opts.imageAspect ?? el.dataset.imageAspect, 816 / 1104),
    fill: num(opts.fill ?? el.dataset.fill, 0.55),
    centerY: num(opts.centerY ?? el.dataset.centerY, 0.57),
    zoom: num(opts.zoom ?? el.dataset.zoom, 1.08),
    pointerAmp: num(opts.pointerAmp ?? el.dataset.pointerAmp, 0.026),
    ambientAmp: num(opts.ambientAmp ?? el.dataset.ambientAmp, 0.01)
  };

  // container styling: 16:9 block by default (override with CSS)
  const cs = getComputedStyle(el);
  if (cs.position === "static") el.style.position = "relative";
  if (!el.style.aspectRatio && !el.dataset.noAspect) el.style.aspectRatio = "16 / 9";
  el.style.overflow = "hidden";
  el.style.background = "#05060b";

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  el.appendChild(canvas);

  const uniforms = {
    uImage: { value: null },
    uDepth: { value: null },
    uImageAspect: { value: cfg.imageAspect },
    uViewAspect: { value: 16 / 9 },
    uOffset: { value: new THREE.Vector2(0, 0) },
    uZoom: { value: cfg.zoom },
    uVignette: { value: 0.35 },
    uFill: { value: cfg.fill },
    uCenterY: { value: cfg.centerY }
  };

  scene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
    )
  );

  function resize() {
    const w = el.clientWidth || 1;
    const h = el.clientHeight || Math.round((w * 9) / 16);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    uniforms.uViewAspect.value = w / h;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  /* ---- pointer parallax, relative to the container ---- */
  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };

  function setFromEvent(clientX, clientY) {
    const r = el.getBoundingClientRect();
    pointer.x = Math.max(-1, Math.min(1, ((clientX - r.left) / r.width) * 2 - 1));
    pointer.y = Math.max(-1, Math.min(1, ((clientY - r.top) / r.height) * 2 - 1));
  }
  el.addEventListener("pointermove", (e) => setFromEvent(e.clientX, e.clientY));
  el.addEventListener("pointerleave", () => {
    pointer.x = 0;
    pointer.y = 0;
  });
  el.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (t) setFromEvent(t.clientX, t.clientY);
    },
    { passive: true }
  );
  window.addEventListener("deviceorientation", (e) => {
    if (e.gamma == null || e.beta == null) return;
    pointer.x = Math.max(-1, Math.min(1, e.gamma / 30));
    pointer.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
  });

  /* ---- load textures ---- */
  const loader = new THREE.TextureLoader();
  const load = (url) =>
    new Promise((res, rej) => loader.load(url, res, undefined, rej));

  let ready = false;
  Promise.all([load(cfg.photo), load(cfg.depth)])
    .then(([image, depth]) => {
      image.colorSpace = THREE.SRGBColorSpace;
      image.minFilter = THREE.LinearFilter;
      depth.minFilter = THREE.LinearFilter;
      depth.magFilter = THREE.LinearFilter;
      uniforms.uImage.value = image;
      uniforms.uDepth.value = depth;
      ready = true;
      el.dispatchEvent(new CustomEvent("astro-hero:ready"));
    })
    .catch((err) => {
      console.error("[astro-hero] failed to load textures", err);
      el.dispatchEvent(new CustomEvent("astro-hero:error", { detail: err }));
    });

  /* ---- render loop ---- */
  const clock = new THREE.Clock();
  let raf = 0;
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!ready) return;
    const t = clock.getElapsedTime();

    // ambient sway (clock-driven, no GSAP) + gentle Ken-Burns zoom
    let ax = 0;
    let ay = 0;
    if (!PREFERS_REDUCED) {
      ax = Math.sin(t * 0.5);
      ay = Math.sin(t * 0.37 + 1.2);
      uniforms.uZoom.value = cfg.zoom + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.2));
    }

    eased.x += (pointer.x - eased.x) * 0.06;
    eased.y += (pointer.y - eased.y) * 0.06;

    uniforms.uOffset.value.set(
      ax * cfg.ambientAmp + eased.x * cfg.pointerAmp,
      -(ay * cfg.ambientAmp + eased.y * cfg.pointerAmp)
    );
    renderer.render(scene, camera);
  }
  tick();

  return {
    el,
    setFill(v) {
      uniforms.uFill.value = v;
    },
    setCenterY(v) {
      uniforms.uCenterY.value = v;
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      canvas.remove();
      el.__astroHeroMounted = false;
    }
  };
}

/* ---- auto-mount ---- */
function autoMount() {
  const els = new Set([
    ...document.querySelectorAll("[data-astro-hero]"),
    ...(document.getElementById("astro-hero")
      ? [document.getElementById("astro-hero")]
      : [])
  ]);
  els.forEach((el) => mountAstroHero(el));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoMount);
} else {
  autoMount();
}
