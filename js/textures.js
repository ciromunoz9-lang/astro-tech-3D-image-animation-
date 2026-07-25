import * as THREE from "three";

/**
 * Every visual is generated procedurally on <canvas> so the project runs
 * with zero external image files. To use real artwork instead (e.g. a cut-out
 * astronaut PNG), swap any factory for:
 *     new THREE.TextureLoader().load('assets/astronaut.png')
 * and drop it into the matching layer in main.js.
 *
 * The palette mirrors the reference clip: deep space, an amber/white star
 * field, a glowing golden sun and a cool cratered moon.
 */

function makeCanvas(size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  return { canvas, ctx: canvas.getContext("2d") };
}

function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ------------------------------------------------------------------ *
 *  BACKGROUND — deep-space nebula + layered amber/white star field
 * ------------------------------------------------------------------ */
export function createStarfieldTexture() {
  const { canvas, ctx } = makeCanvas(2048);

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#02030a");
  bg.addColorStop(0.5, "#060a18");
  bg.addColorStop(1, "#03040d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // faint nebula clouds
  const clouds = [
    { x: 0.25, y: 0.4, r: 0.5, color: "rgba(80,150,220,0.12)" },
    { x: 0.75, y: 0.55, r: 0.55, color: "rgba(150,110,220,0.10)" },
    { x: 0.5, y: 0.25, r: 0.35, color: "rgba(230,140,80,0.08)" }
  ];
  for (const c of clouds) {
    const g = ctx.createRadialGradient(
      c.x * canvas.width, c.y * canvas.height, 0,
      c.x * canvas.width, c.y * canvas.height, c.r * canvas.width
    );
    g.addColorStop(0, c.color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // stars — a mix of cool white and warm amber, like the reference
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = Math.random() * 1.6 + 0.2;
    const warm = Math.random() < 0.4;
    ctx.fillStyle = warm ? "#ffcf99" : "#eaf6ff";
    ctx.globalAlpha = 0.25 + Math.random() * 0.75;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  return toTexture(canvas);
}

/* ------------------------------------------------------------------ *
 *  MIDGROUND — glowing golden sun with corona and surface mottling
 * ------------------------------------------------------------------ */
export function createSunTexture() {
  const { canvas, ctx } = makeCanvas(1024);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const R = canvas.width * 0.3;

  // outer corona
  const corona = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.65);
  corona.addColorStop(0, "rgba(255,190,90,0.55)");
  corona.addColorStop(0.5, "rgba(255,140,50,0.20)");
  corona.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = corona;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // body
  const body = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  body.addColorStop(0, "#fff6d8");
  body.addColorStop(0.55, "#ffd257");
  body.addColorStop(0.85, "#ff9a2e");
  body.addColorStop(1, "#e56a1c");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // surface granulation / sunspots
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 220; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * R;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const rr = 4 + Math.random() * 16;
    const dark = Math.random() < 0.25;
    ctx.fillStyle = dark
      ? `rgba(150,50,10,${0.15 + Math.random() * 0.25})`
      : `rgba(255,240,190,${0.08 + Math.random() * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  return toTexture(canvas);
}

/* ------------------------------------------------------------------ *
 *  FOREGROUND — cratered moon, rim-lit from the sun side
 * ------------------------------------------------------------------ */
export function createMoonTexture() {
  const { canvas, ctx } = makeCanvas(1024);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const R = canvas.width * 0.42;

  // body, shaded so the light comes from the upper-right (toward the sun)
  const body = ctx.createRadialGradient(
    cx + R * 0.4, cy - R * 0.4, R * 0.1,
    cx, cy, R
  );
  body.addColorStop(0, "#d9dde4");
  body.addColorStop(0.5, "#9aa2ad");
  body.addColorStop(0.85, "#4a5058");
  body.addColorStop(1, "#20242b");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // craters
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * R * 0.95;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const rr = 6 + Math.random() * 34;
    // shadow
    ctx.fillStyle = "rgba(20,22,28,0.35)";
    ctx.beginPath();
    ctx.arc(x + rr * 0.15, y + rr * 0.15, rr, 0, Math.PI * 2);
    ctx.fill();
    // rim highlight
    ctx.strokeStyle = "rgba(235,240,248,0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, rr, -Math.PI * 0.75, Math.PI * 0.15);
    ctx.stroke();
  }
  ctx.restore();

  // terminator shadow on the lower-left
  const term = ctx.createRadialGradient(
    cx - R * 0.5, cy + R * 0.5, R * 0.2,
    cx - R * 0.3, cy + R * 0.3, R * 1.3
  );
  term.addColorStop(0, "rgba(0,0,0,0.55)");
  term.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = term;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  return toTexture(canvas);
}

/* ------------------------------------------------------------------ *
 *  PARTICLES — soft round sprite for the drifting debris field
 * ------------------------------------------------------------------ */
export function createParticleTexture() {
  const { canvas, ctx } = makeCanvas(64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,220,170,0.9)");
  g.addColorStop(1, "rgba(255,220,170,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}
