/* ==================================================================== *
 *  Demo-page interactions (UX/UI Pro Max)
 *  Not part of the drop-in component — this wires the showcase page:
 *   · live control dock → hero setters
 *   · copy-to-clipboard on the code block
 *   · reveal-on-scroll for sections
 *  All of it degrades gracefully if the hero fails to mount.
 * ==================================================================== */

import { mountAstroHero } from "./astro-hero.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---- mount the hero explicitly so we hold the handle ----
   (uses .astro-hero without id="astro-hero" so the component's
   auto-mount doesn't claim it first and steal the handle) */
const heroEl = $(".astro-hero");
const hero = heroEl ? mountAstroHero(heroEl) : null;

/* ---- live control dock ---- */
const DEFAULTS = { fill: 0.55, centerY: 0.57, pointerAmp: 0.026, zoom: 1.08 };

const CONTROLS = [
  { id: "fill", label: "Fill", min: 0.2, max: 1, step: 0.01, apply: (h, v) => h.setFill(v) },
  { id: "centerY", label: "Framing", min: 0.4, max: 0.75, step: 0.01, apply: (h, v) => h.setCenterY(v) },
  { id: "pointerAmp", label: "Parallax", min: 0, max: 0.06, step: 0.002, apply: (h, v) => h.setPointerAmp(v) },
  { id: "zoom", label: "Depth", min: 1, max: 1.25, step: 0.01, apply: (h, v) => h.setZoom(v) }
];

function bindDock() {
  if (!hero) return;
  CONTROLS.forEach((c) => {
    const input = $(`#ctl-${c.id}`);
    const out = $(`#val-${c.id}`);
    if (!input) return;
    const render = (v) => {
      c.apply(hero, v);
      if (out) out.textContent = v.toFixed(c.step < 0.01 ? 3 : 2);
    };
    input.addEventListener("input", () => render(parseFloat(input.value)));
    render(parseFloat(input.value));
  });

  const reset = $("#dock-reset");
  if (reset) {
    reset.addEventListener("click", () => {
      CONTROLS.forEach((c) => {
        const input = $(`#ctl-${c.id}`);
        if (!input) return;
        input.value = DEFAULTS[c.id];
        input.dispatchEvent(new Event("input"));
      });
    });
  }
}

/* only reveal the dock once the hero is actually rendering */
if (heroEl) {
  heroEl.addEventListener("astro-hero:ready", bindDock, { once: true });
  heroEl.addEventListener(
    "astro-hero:error",
    () => {
      const dock = $(".dock");
      if (dock) dock.style.display = "none";
    },
    { once: true }
  );
}

/* ---- copy-to-clipboard ---- */
$$(".copy").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const target = $(btn.dataset.copyTarget);
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.innerText.trim());
      const original = btn.textContent;
      btn.textContent = "Copied ✓";
      btn.classList.add("is-done");
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove("is-done");
      }, 1600);
    } catch {
      btn.textContent = "Copy failed";
    }
  });
});

/* ---- reveal-on-scroll ---- */
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const reveals = $$(".reveal");
if (reduced || !("IntersectionObserver" in window)) {
  reveals.forEach((r) => r.classList.add("is-in"));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  reveals.forEach((r) => io.observe(r));
}
