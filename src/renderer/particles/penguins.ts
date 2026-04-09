/**
 * Interactive penguin easter-egg system for the ice flow simulator.
 *
 * Penguins spawn on the ice surface, advect with the ice flow, and respond
 * to user interaction (click, double-click, drag). When ice calves at the
 * shelf front, penguins panic and tumble into the ocean.
 *
 * All rendering is procedural Canvas 2D — no image assets required.
 * Module-level state (same pattern as calving.ts) — zero React overhead.
 */

import { toCanvasX, toCanvasY, type DrawContext } from '../draw-bedrock';

// ── Types ─────────────────────────────────────────────────────

type PenguinState =
  | 'idle'
  | 'walk'
  | 'slide'
  | 'wave'
  | 'jump'
  | 'spin'
  | 'fall'
  | 'splash'
  | 'swim'
  | 'panic'
  | 'love'
  | 'sleep';

type Emotion = 'happy' | 'neutral' | 'surprised' | 'sad' | 'dizzy' | 'sleepy' | 'love';

interface Penguin {
  id: number;
  x: number;            // Domain x (meters)
  z: number;            // Domain z (meters)
  vx: number;           // Domain velocity for physics
  vz: number;           // Vertical velocity (falling/jumping)
  direction: 1 | -1;
  state: PenguinState;
  stateTimer: number;
  stateDuration: number;
  size: number;          // 0.7–1.3
  emotion: Emotion;
  wobble: number;
  bobPhase: number;
  life: number;
  isDragging: boolean;
  dragOffsetX: number;   // Canvas px offset from center
  dragOffsetY: number;
  swimLife: number;      // Frames spent swimming (for fade-out)
  jumpHeight: number;    // Peak height for jump animation
}

interface FloatingParticle {
  x: number; // canvas px
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  kind: 'heart' | 'zzz' | 'star' | 'splash' | 'note';
  size: number;
  rotation: number;
}

// ── State ──────────────────────────────────────────────────────

let penguins: Penguin[] = [];
let particles: FloatingParticle[] = [];
let nextId = 0;
let respawnCooldown = 0;
const MAX_PENGUINS = 8;
const TARGET_PENGUINS = 5;
const PENGUIN_HEIGHT_PX = 24; // Base height in canvas pixels
const HIT_RADIUS = 18;        // Click detection radius (px)

// Cached DrawContext for mouse handlers (updated each frame)
let cachedDC: DrawContext | null = null;
let cachedH: Float64Array | null = null;
let cachedS: Float64Array | null = null;
let cachedXPositions: Float64Array | null = null;
// cachedGlPosM reserved for future calving-zone detection

// Cursor state (read by IceSheetCanvas for cursor style)
export let penguinCursorState: 'default' | 'grab' | 'grabbing' = 'default';

// ── Helpers ────────────────────────────────────────────────────

function fromCanvasX(cx: number, dc: DrawContext): number {
  return dc.xMin + (cx / dc.width) * (dc.xMax - dc.xMin);
}

function fromCanvasY(cy: number, dc: DrawContext): number {
  return dc.zMin + ((dc.height - cy) / dc.height) * (dc.zMax - dc.zMin);
}

/** Linearly interpolate surface elevation at domain x. */
function interpSurface(
  domainX: number,
  s: Float64Array,
  xPositions: Float64Array,
): number {
  if (domainX <= xPositions[0]) return s[0];
  if (domainX >= xPositions[xPositions.length - 1]) return s[s.length - 1];
  for (let i = 0; i < xPositions.length - 1; i++) {
    if (xPositions[i] <= domainX && xPositions[i + 1] > domainX) {
      const frac = (domainX - xPositions[i]) / (xPositions[i + 1] - xPositions[i]);
      return s[i] * (1 - frac) + s[i + 1] * frac;
    }
  }
  return s[s.length - 1];
}

/** Interpolate ice thickness at domain x. */
function interpThickness(
  domainX: number,
  H: Float64Array,
  xPositions: Float64Array,
): number {
  if (domainX <= xPositions[0]) return H[0];
  if (domainX >= xPositions[xPositions.length - 1]) return H[H.length - 1];
  for (let i = 0; i < xPositions.length - 1; i++) {
    if (xPositions[i] <= domainX && xPositions[i + 1] > domainX) {
      const frac = (domainX - xPositions[i]) / (xPositions[i + 1] - xPositions[i]);
      return H[i] * (1 - frac) + H[i + 1] * frac;
    }
  }
  return H[H.length - 1];
}

/** Interpolate surface velocity at domain x. */
function interpVelocity(
  domainX: number,
  u: Float64Array,
  xPositions: Float64Array,
): number {
  if (domainX <= xPositions[0]) return u[0];
  if (domainX >= xPositions[xPositions.length - 1]) return u[u.length - 1];
  for (let i = 0; i < xPositions.length - 1; i++) {
    if (xPositions[i] <= domainX && xPositions[i + 1] > domainX) {
      const frac = (domainX - xPositions[i]) / (xPositions[i + 1] - xPositions[i]);
      return u[i] * (1 - frac) + u[i + 1] * frac;
    }
  }
  return u[u.length - 1];
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createPenguin(x: number, z: number): Penguin {
  return {
    id: nextId++,
    x,
    z,
    vx: 0,
    vz: 0,
    direction: Math.random() > 0.5 ? 1 : -1,
    state: 'idle',
    stateTimer: 0,
    stateDuration: 90 + Math.floor(Math.random() * 120),
    size: randRange(0.75, 1.2),
    emotion: 'happy',
    wobble: Math.random() * Math.PI * 2,
    bobPhase: Math.random() * Math.PI * 2,
    life: 0,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    swimLife: 0,
    jumpHeight: 0,
  };
}

// ── Spawn ──────────────────────────────────────────────────────

export function spawnInitialPenguins(
  s: Float64Array,
  xPositions: Float64Array,
  gl_pos_m: number,
): void {
  penguins = [];
  particles = [];
  nextId = 0;
  respawnCooldown = 0;

  const count = 3 + Math.floor(Math.random() * 3); // 3-5
  const groundedEnd = Math.min(gl_pos_m, xPositions[xPositions.length - 1]);

  for (let i = 0; i < count; i++) {
    // Bias toward middle of grounded ice
    const frac = 0.15 + Math.random() * 0.65;
    const px = frac * groundedEnd;
    const pz = interpSurface(px, s, xPositions);
    penguins.push(createPenguin(px, pz));
  }
}

function spawnOnePenguin(
  s: Float64Array,
  xPositions: Float64Array,
  gl_pos_m: number,
): void {
  if (penguins.length >= MAX_PENGUINS) return;
  const groundedEnd = Math.min(gl_pos_m, xPositions[xPositions.length - 1]);
  if (groundedEnd < 5000) return; // Not enough ice

  // Spawn near the inland (left) side
  const frac = 0.05 + Math.random() * 0.35;
  const px = frac * groundedEnd;
  const pz = interpSurface(px, s, xPositions);
  penguins.push(createPenguin(px, pz));
}

// ── State transitions ──────────────────────────────────────────

function transitionTo(p: Penguin, newState: PenguinState): void {
  p.state = newState;
  p.stateTimer = 0;

  switch (newState) {
    case 'idle':
      p.stateDuration = 150 + Math.floor(Math.random() * 250);
      p.emotion = 'happy';
      p.vx = 0;
      break;
    case 'walk':
      p.stateDuration = 50 + Math.floor(Math.random() * 80);
      p.emotion = 'happy';
      p.direction = Math.random() > 0.5 ? 1 : -1;
      break;
    case 'slide':
      p.stateDuration = 40 + Math.floor(Math.random() * 40);
      p.emotion = 'happy';
      break;
    case 'wave':
      p.stateDuration = 50;
      p.emotion = 'happy';
      break;
    case 'jump':
      p.stateDuration = 36;
      p.emotion = 'surprised';
      p.jumpHeight = 0;
      break;
    case 'spin':
      p.stateDuration = 45;
      p.emotion = 'dizzy';
      break;
    case 'fall':
      p.emotion = 'surprised';
      p.stateDuration = 999;
      if (p.vz === 0) p.vz = 20;
      break;
    case 'splash':
      p.stateDuration = 25;
      p.emotion = 'surprised';
      p.vz = 0;
      break;
    case 'swim':
      p.stateDuration = 400 + Math.floor(Math.random() * 200);
      p.emotion = 'sad';
      p.swimLife = 0;
      break;
    case 'panic':
      p.stateDuration = 30 + Math.floor(Math.random() * 20);
      p.emotion = 'surprised';
      break;
    case 'love':
      p.stateDuration = 60;
      p.emotion = 'love';
      break;
    case 'sleep':
      p.stateDuration = 150 + Math.floor(Math.random() * 200);
      p.emotion = 'sleepy';
      break;
  }
}

function pickNextIdleState(): PenguinState {
  const r = Math.random();
  if (r < 0.12) return 'walk';    // occasional short walk
  if (r < 0.16) return 'slide';   // rare belly slide
  if (r < 0.26) return 'sleep';   // nap fairly often
  if (r < 0.29) return 'jump';    // rare spontaneous hop
  return 'idle';                   // mostly just stand around quietly
}

// ── Particle helpers ───────────────────────────────────────────

function spawnHeart(cx: number, cy: number): void {
  for (let i = 0; i < 3; i++) {
    particles.push({
      x: cx + randRange(-8, 8),
      y: cy - 10,
      vx: randRange(-0.5, 0.5),
      vy: randRange(-1.5, -0.8),
      life: 0,
      maxLife: 40 + Math.floor(Math.random() * 20),
      kind: 'heart',
      size: randRange(4, 7),
      rotation: 0,
    });
  }
}

function spawnZzz(cx: number, cy: number): void {
  particles.push({
    x: cx + randRange(-3, 6),
    y: cy - 15,
    vx: randRange(0.2, 0.6),
    vy: randRange(-0.8, -0.4),
    life: 0,
    maxLife: 50,
    kind: 'zzz',
    size: randRange(6, 9),
    rotation: randRange(-0.2, 0.2),
  });
}

function spawnStars(cx: number, cy: number): void {
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    particles.push({
      x: cx,
      y: cy - 12,
      vx: Math.cos(angle) * 0.8,
      vy: Math.sin(angle) * 0.8 - 0.3,
      life: 0,
      maxLife: 35,
      kind: 'star',
      size: randRange(3, 5),
      rotation: 0,
    });
  }
}

function spawnSplashParticles(cx: number, cy: number): void {
  for (let i = 0; i < 5; i++) {
    particles.push({
      x: cx + randRange(-6, 6),
      y: cy,
      vx: randRange(-2, 2),
      vy: randRange(-3, -1),
      life: 0,
      maxLife: 22,
      kind: 'splash',
      size: randRange(2, 4),
      rotation: 0,
    });
  }
}

function spawnNote(cx: number, cy: number): void {
  particles.push({
    x: cx + randRange(-5, 5),
    y: cy - 14,
    vx: randRange(-0.3, 0.3),
    vy: randRange(-1.0, -0.5),
    life: 0,
    maxLife: 45,
    kind: 'note',
    size: randRange(5, 8),
    rotation: randRange(-0.3, 0.3),
  });
}

// ── Sprite Drawing (styled after gemini-svg.svg reference) ─────

// Colors from the SVG reference
const COL_BODY = '#35373c';       // body/head dark gray
const COL_STROKE = '#2b2d31';     // outlines
const COL_BELLY = '#f4efe9';      // cream-white belly
const COL_BEAK = '#df7a40';       // orange beak
const COL_BEAK_STROKE = '#b04e20';
const COL_FEET = '#dd7b40';       // orange feet
const COL_BLUSH = '#df9f9f';      // pink blush
const COL_EYE = '#2b2d31';        // eye fill (solid dark)
const COL_HIGHLIGHT = '#ffffff';   // eye highlight

/** Soft easing for smooth transitions. */
function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Draw a curved wing matching SVG wing bezier style. */
function drawWing(
  ctx: CanvasRenderingContext2D,
  sc: number,
  len: number,
  mirror: boolean,
): void {
  const dir = mirror ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(
    dir * 6 * sc, len * 0.25,
    dir * 8 * sc, len * 0.65,
    dir * 5 * sc, len,
  );
  ctx.bezierCurveTo(
    dir * 2 * sc, len * 0.85,
    dir * 0.5 * sc, len * 0.5,
    0, len * 0.15,
  );
  ctx.closePath();
  ctx.fillStyle = COL_BODY;
  ctx.strokeStyle = COL_STROKE;
  ctx.lineWidth = 0.8 * sc;
  ctx.fill();
  ctx.stroke();
}

/** Draw webbed foot matching SVG zigzag style. */
function drawWebbedFoot(
  ctx: CanvasRenderingContext2D,
  sc: number,
  mirror: boolean,
): void {
  const dir = mirror ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(-2 * sc * dir, 0);
  ctx.lineTo(-5 * sc * dir, 3 * sc);
  ctx.lineTo(-3 * sc * dir, 2.5 * sc);
  ctx.lineTo(-2 * sc * dir, 4.5 * sc);
  ctx.lineTo(0, 2.5 * sc);
  ctx.lineTo(2 * sc * dir, 3.5 * sc);
  ctx.lineTo(1.5 * sc * dir, 0);
  ctx.closePath();
  ctx.fillStyle = COL_FEET;
  ctx.strokeStyle = COL_STROKE;
  ctx.lineWidth = 0.7 * sc;
  ctx.fill();
  ctx.stroke();
}

function drawPenguinSprite(
  ctx: CanvasRenderingContext2D,
  p: Penguin,
  cx: number,
  cy: number,
): void {
  const sc = p.size;
  const now = Date.now();
  const t01 = Math.min(1, p.stateTimer / Math.max(1, p.stateDuration));

  // ── Breathing pulse ──
  const breathe = 1 + Math.sin(now * 0.003 + p.wobble) * 0.018;

  // ── Walk cycle ──
  const walkT = p.stateTimer * 0.3;
  const walkSin = Math.sin(walkT);
  const walkCos = Math.cos(walkT);

  // ── State-dependent transforms ──
  let bodyTilt = 0;
  let yOffset = 0;
  let headTilt = 0;
  let scaleX = breathe;
  let scaleY = breathe;
  let isSliding = false;

  switch (p.state) {
    case 'idle': {
      bodyTilt = Math.sin(now * 0.001 + p.wobble) * 0.03;
      const lookPhase = (now * 0.0005 + p.id * 2.5) % (Math.PI * 2);
      headTilt = Math.sin(lookPhase) * 0.08;
      yOffset = Math.sin(now * 0.002 + p.wobble) * 0.4;
      break;
    }
    case 'walk': {
      bodyTilt = walkSin * 0.22 * p.direction;
      yOffset = -Math.abs(walkCos) * 3;
      headTilt = -bodyTilt * 0.4;
      const squish = Math.abs(walkCos);
      scaleX = breathe * (1 + squish * 0.06);
      scaleY = breathe * (1 - squish * 0.04);
      break;
    }
    case 'slide':
      isSliding = true;
      break;
    case 'jump': {
      const arc = Math.sin(t01 * Math.PI);
      yOffset = -arc * PENGUIN_HEIGHT_PX * sc * 0.7;
      scaleY = breathe * (1 + arc * 0.25);
      scaleX = breathe * (1 - arc * 0.1);
      if (t01 < 0.15) {
        const sq = ease(t01 / 0.15);
        scaleY = breathe * (1 - sq * 0.15);
        scaleX = breathe * (1 + sq * 0.08);
        yOffset = sq * 2;
      }
      break;
    }
    case 'spin': {
      bodyTilt = ease(t01) * Math.PI * 4;
      yOffset = -Math.sin(t01 * Math.PI) * 4;
      break;
    }
    case 'fall':
      bodyTilt = Math.sin(p.stateTimer * 0.5) * 0.4;
      headTilt = -bodyTilt * 0.6;
      break;
    case 'panic':
      bodyTilt = Math.sin(p.stateTimer * 1.0) * 0.25;
      yOffset = -Math.abs(Math.sin(p.stateTimer * 0.8)) * 2;
      headTilt = Math.sin(p.stateTimer * 1.2) * 0.2;
      break;
    case 'swim': {
      yOffset = Math.sin(now * 0.004 + p.bobPhase) * 3;
      bodyTilt = Math.sin(now * 0.003) * 0.06;
      headTilt = Math.sin(now * 0.005 + 1) * 0.1;
      break;
    }
    case 'sleep':
      bodyTilt = 0.1;
      headTilt = 0.12;
      scaleX = 1 + Math.sin(now * 0.002 + p.wobble) * 0.03;
      scaleY = 1 + Math.sin(now * 0.002 + p.wobble + Math.PI) * 0.03;
      break;
    case 'wave':
      bodyTilt = Math.sin(now * 0.004) * 0.05;
      headTilt = -0.1;
      break;
    case 'love':
      bodyTilt = Math.sin(now * 0.005) * 0.08;
      headTilt = Math.sin(now * 0.007) * 0.1;
      yOffset = -Math.abs(Math.sin(now * 0.006)) * 1.5;
      break;
  }

  ctx.save();
  ctx.translate(cx, cy);

  // ── Drop shadow (matching SVG ellipse shadow) ──
  if (!isSliding && p.state !== 'fall') {
    ctx.fillStyle = 'rgba(100, 120, 135, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 2.5 * sc, 10 * sc, 2 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (isSliding) {
    ctx.rotate((p.direction > 0 ? -1 : 1) * Math.PI * 0.42);
  }

  ctx.translate(0, yOffset);

  if (p.state === 'spin') {
    ctx.rotate(bodyTilt);
    bodyTilt = 0;
  }

  ctx.scale(scaleX, scaleY);
  ctx.rotate(bodyTilt);

  // ── Dimensions ──
  const bodyW = 10 * sc;
  const bodyH = 14 * sc;
  const headR = 8 * sc;

  // ── Webbed feet (behind body, matching SVG zigzag feet) ──
  if (!isSliding && p.state !== 'swim') {
    const footY = bodyH - 2 * sc;
    let leftOff = 0;
    let rightOff = 0;
    if (p.state === 'walk') {
      leftOff = walkSin * 3 * sc;
      rightOff = -walkSin * 3 * sc;
    }
    ctx.save();
    ctx.translate(-4 * sc + leftOff, footY);
    drawWebbedFoot(ctx, sc, false);
    ctx.restore();
    ctx.save();
    ctx.translate(4 * sc + rightOff, footY);
    drawWebbedFoot(ctx, sc, true);
    ctx.restore();
  }

  // ── Wings (behind body, matching SVG curved wings) ──
  const wingAttachY = -bodyH * 0.2;
  const wingLen = 12 * sc;

  let leftAngle = 0.35;
  let rightAngle = -0.35;

  if (p.state === 'idle') {
    const sway = Math.sin(now * 0.002 + p.wobble + 1) * 0.08;
    leftAngle += sway;
    rightAngle -= sway;
  } else if (p.state === 'walk') {
    leftAngle = 0.35 + walkSin * 0.2;
    rightAngle = -0.35 + walkSin * 0.2;
  } else if (p.state === 'wave') {
    rightAngle = -1.2 - Math.sin(p.stateTimer * 0.35) * 0.5;
    leftAngle = 0.3 + Math.sin(p.stateTimer * 0.15) * 0.1;
  } else if (p.state === 'panic' || p.state === 'fall') {
    const flap = Math.sin(p.stateTimer * 0.8) * 0.7;
    leftAngle = 1.0 + flap;
    rightAngle = -1.0 - flap;
  } else if (p.state === 'jump') {
    leftAngle = 0.6 + Math.sin(t01 * Math.PI) * 0.4;
    rightAngle = -0.6 - Math.sin(t01 * Math.PI) * 0.4;
  } else if (isSliding) {
    leftAngle = 0.05;
    rightAngle = -0.05;
  } else if (p.state === 'swim') {
    const paddle = Math.sin(now * 0.007 + p.bobPhase) * 0.35;
    leftAngle = 0.5 + paddle;
    rightAngle = -0.5 - paddle;
  } else if (p.state === 'love') {
    leftAngle = 0.6 + Math.sin(now * 0.008) * 0.15;
    rightAngle = -0.6 - Math.sin(now * 0.008) * 0.15;
  }

  ctx.save();
  ctx.translate(-bodyW * 0.85, wingAttachY);
  ctx.rotate(leftAngle);
  drawWing(ctx, sc, wingLen, false);
  ctx.restore();

  ctx.save();
  ctx.translate(bodyW * 0.85, wingAttachY);
  ctx.rotate(rightAngle);
  drawWing(ctx, sc, wingLen, true);
  ctx.restore();

  // ── Body (gourd/pear shape matching SVG bezier body path) ──
  ctx.beginPath();
  ctx.moveTo(0, -bodyH);
  ctx.bezierCurveTo(
    bodyW * 1.15, -bodyH,
    bodyW * 1.25, bodyH * 0.2,
    bodyW * 1.1, bodyH * 0.5,
  );
  ctx.bezierCurveTo(
    bodyW * 0.9, bodyH * 0.9,
    bodyW * 0.4, bodyH,
    0, bodyH,
  );
  ctx.bezierCurveTo(
    -bodyW * 0.4, bodyH,
    -bodyW * 0.9, bodyH * 0.9,
    -bodyW * 1.1, bodyH * 0.5,
  );
  ctx.bezierCurveTo(
    -bodyW * 1.25, bodyH * 0.2,
    -bodyW * 1.15, -bodyH,
    0, -bodyH,
  );
  ctx.fillStyle = COL_BODY;
  ctx.strokeStyle = COL_STROKE;
  ctx.lineWidth = 0.8 * sc;
  ctx.fill();
  ctx.stroke();

  // ── Cream belly with heart-shaped neckline (matching SVG belly path) ──
  ctx.beginPath();
  // Heart-shaped top: two bumps rising from center
  ctx.moveTo(0, bodyH * 0.92);
  ctx.bezierCurveTo(
    -bodyW * 0.9, bodyH * 0.92,
    -bodyW * 1.0, bodyH * 0.05,
    -bodyW * 0.55, -bodyH * 0.55,
  );
  // Left bump of heart neckline
  ctx.bezierCurveTo(
    -bodyW * 0.35, -bodyH * 0.75,
    -bodyW * 0.1, -bodyH * 0.55,
    0, -bodyH * 0.4,
  );
  // Right bump of heart neckline
  ctx.bezierCurveTo(
    bodyW * 0.1, -bodyH * 0.55,
    bodyW * 0.35, -bodyH * 0.75,
    bodyW * 0.55, -bodyH * 0.55,
  );
  ctx.bezierCurveTo(
    bodyW * 1.0, bodyH * 0.05,
    bodyW * 0.9, bodyH * 0.92,
    0, bodyH * 0.92,
  );
  ctx.fillStyle = COL_BELLY;
  ctx.fill();

  // ── Head ──
  const headY = -bodyH - headR * 0.45;
  ctx.save();
  ctx.translate(0, headY);
  ctx.rotate(headTilt);

  // Head circle with outline
  ctx.beginPath();
  ctx.arc(0, 0, headR, 0, Math.PI * 2);
  ctx.fillStyle = COL_BODY;
  ctx.strokeStyle = COL_STROKE;
  ctx.lineWidth = 0.8 * sc;
  ctx.fill();
  ctx.stroke();

  // ── Head tufts (3 spiky feathers from SVG) ──
  ctx.fillStyle = COL_STROKE;
  // Center tuft
  ctx.beginPath();
  ctx.moveTo(-0.5 * sc, -headR + 1 * sc);
  ctx.quadraticCurveTo(-0.5 * sc, -headR - 5 * sc, 0.5 * sc, -headR - 7 * sc);
  ctx.quadraticCurveTo(0.8 * sc, -headR - 4 * sc, 1 * sc, -headR + 1 * sc);
  ctx.fill();
  // Left tuft
  ctx.beginPath();
  ctx.moveTo(-2 * sc, -headR + 2 * sc);
  ctx.quadraticCurveTo(-3.5 * sc, -headR - 3 * sc, -2 * sc, -headR - 5 * sc);
  ctx.quadraticCurveTo(-1 * sc, -headR - 2 * sc, -0.5 * sc, -headR + 2 * sc);
  ctx.fill();
  // Right tuft
  ctx.beginPath();
  ctx.moveTo(2 * sc, -headR + 2 * sc);
  ctx.quadraticCurveTo(3.5 * sc, -headR - 3 * sc, 2 * sc, -headR - 5 * sc);
  ctx.quadraticCurveTo(1 * sc, -headR - 2 * sc, 0.5 * sc, -headR + 2 * sc);
  ctx.fill();

  // ── White face patch (connecting to belly) ──
  ctx.beginPath();
  ctx.ellipse(0, 2 * sc, headR * 0.75, headR * 0.7, 0, 0, Math.PI * 2);
  ctx.fillStyle = COL_BELLY;
  ctx.fill();

  // ── Eyes (large solid ovals with single highlight, matching SVG) ──
  const eyeSpacing = 4 * sc;
  const eyeY = 0;
  const eyeRx = 2.5 * sc;  // horizontal radius
  const eyeRy = 3.3 * sc;  // vertical radius (tall oval like SVG)

  const blinkCycle = (now + p.id * 1337) % (3000 + p.id * 500);
  const isBlinking = blinkCycle < 120;
  const blinkClose = isBlinking ? Math.sin((blinkCycle / 120) * Math.PI) : 0;
  const isSleeping = p.state === 'sleep';
  const isDizzy = p.emotion === 'dizzy';

  for (const side of [-1, 1] as const) {
    const ex = side * eyeSpacing;

    if (isSleeping) {
      // Happy closed eyes
      ctx.beginPath();
      ctx.arc(ex, eyeY, eyeRx * 0.7, Math.PI, 0, false);
      ctx.strokeStyle = COL_STROKE;
      ctx.lineWidth = 1.3 * sc;
      ctx.stroke();
    } else if (isDizzy) {
      // X eyes
      ctx.strokeStyle = COL_STROKE;
      ctx.lineWidth = 1.3 * sc;
      const xr = eyeRx * 0.7;
      ctx.beginPath();
      ctx.moveTo(ex - xr, eyeY - xr); ctx.lineTo(ex + xr, eyeY + xr);
      ctx.moveTo(ex + xr, eyeY - xr); ctx.lineTo(ex - xr, eyeY + xr);
      ctx.stroke();
    } else {
      // Blink scale
      const eyeSY = 1 - blinkClose * 0.85;

      // Solid dark oval eye (SVG style — no white sclera)
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeRx, eyeRy * eyeSY, 0, 0, Math.PI * 2);
      ctx.fillStyle = COL_EYE;
      ctx.fill();

      if (eyeSY > 0.3) {
        // Single white highlight circle (matching SVG: circle r=5.5 at upper-right)
        const hlX = ex + side * 0.8 * sc;
        const hlY = eyeY - 1.5 * sc;
        ctx.beginPath();
        ctx.arc(hlX, hlY, 1.0 * sc, 0, Math.PI * 2);
        ctx.fillStyle = COL_HIGHLIGHT;
        ctx.fill();
      }

      // Sad: droopy eyebrow
      if (p.emotion === 'sad') {
        ctx.beginPath();
        ctx.moveTo(ex - eyeRx * 1.1, eyeY - eyeRy - 0.5 * sc);
        ctx.quadraticCurveTo(ex, eyeY - eyeRy - (side === -1 ? 2 : 0.5) * sc, ex + eyeRx * 1.1, eyeY - eyeRy + (side === -1 ? 1 : -0.5) * sc);
        ctx.strokeStyle = COL_BODY;
        ctx.lineWidth = 1.2 * sc;
        ctx.stroke();
      }
    }
  }

  // Love eyes overlay
  if (p.emotion === 'love') {
    for (const side of [-1, 1]) {
      drawMiniHeart(ctx, side * eyeSpacing, eyeY, 3.5 * sc, '#ff6b8a');
    }
  }

  // ── Blush (matching SVG pink ellipses below eyes) ──
  {
    const blushA = p.emotion === 'love' ? 0.6 : (p.emotion === 'happy' ? 0.35 : 0);
    if (blushA > 0) {
      ctx.fillStyle = COL_BLUSH;
      ctx.globalAlpha = blushA;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(side * (eyeSpacing + 2.5 * sc), eyeY + 3 * sc, 2 * sc, 1.2 * sc, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── Beak (diamond/lens shape matching SVG, with smile line) ──
  const beakY = 4 * sc;
  // Upper beak
  ctx.beginPath();
  ctx.moveTo(-3.5 * sc, beakY);
  ctx.bezierCurveTo(-2 * sc, beakY - 2 * sc, 2 * sc, beakY - 2 * sc, 3.5 * sc, beakY);
  ctx.bezierCurveTo(2 * sc, beakY + 2.5 * sc, -2 * sc, beakY + 2.5 * sc, -3.5 * sc, beakY);
  ctx.fillStyle = COL_BEAK;
  ctx.strokeStyle = COL_BEAK_STROKE;
  ctx.lineWidth = 0.6 * sc;
  ctx.fill();
  ctx.stroke();

  // Smile line
  ctx.beginPath();
  ctx.moveTo(-2.5 * sc, beakY + 0.5 * sc);
  ctx.quadraticCurveTo(0, beakY + 2 * sc, 2.5 * sc, beakY + 0.5 * sc);
  ctx.strokeStyle = COL_BEAK_STROKE;
  ctx.lineWidth = 0.6 * sc;
  ctx.stroke();

  // Open mouth for surprised
  if (p.emotion === 'surprised') {
    ctx.beginPath();
    ctx.ellipse(0, beakY + 2 * sc, 1.5 * sc, 1 * sc, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#c0392b';
    ctx.fill();
  }

  ctx.restore(); // head transform

  // ── Slide speed lines ──
  if (isSliding) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#d0e8ff';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const ly = -4 * sc + i * 3.5 * sc;
      const lx = -bodyW * 1.6 - ((p.stateTimer * 0.8 + i * 7) % 25);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx - 10 * sc, ly);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawMiniHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  const s = size * 0.5;
  ctx.moveTo(0, s * 0.4);
  ctx.bezierCurveTo(-s, -s * 0.6, -s * 2, s * 0.2, 0, s * 1.5);
  ctx.bezierCurveTo(s * 2, s * 0.2, s, -s * 0.6, 0, s * 0.4);
  ctx.fill();
  ctx.restore();
}

// ── Floating particles drawing ─────────────────────────────────

function drawFloatingParticles(ctx: CanvasRenderingContext2D): void {
  const alive: FloatingParticle[] = [];

  for (const fp of particles) {
    fp.x += fp.vx;
    fp.y += fp.vy;
    fp.life++;

    if (fp.life > fp.maxLife) continue;
    alive.push(fp);

    const alpha = 1 - fp.life / fp.maxLife;

    ctx.save();
    ctx.translate(fp.x, fp.y);
    ctx.rotate(fp.rotation);
    ctx.globalAlpha = alpha;

    switch (fp.kind) {
      case 'heart':
        drawMiniHeart(ctx, 0, 0, fp.size, '#ff6b8a');
        break;

      case 'zzz': {
        ctx.font = `bold ${fp.size}px monospace`;
        ctx.fillStyle = '#aad4ff';
        ctx.textAlign = 'center';
        ctx.fillText('Z', 0, 0);
        break;
      }

      case 'star': {
        ctx.fillStyle = '#ffe066';
        drawStar(ctx, 0, 0, fp.size * 0.4, fp.size, 5);
        break;
      }

      case 'splash': {
        ctx.beginPath();
        ctx.arc(0, 0, fp.size * (1 + fp.life * 0.1), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180, 220, 255, ${alpha * 0.8})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }

      case 'note': {
        ctx.font = `${fp.size}px serif`;
        ctx.fillStyle = '#aad4ff';
        ctx.textAlign = 'center';
        ctx.fillText('\u266A', 0, 0);
        break;
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  particles = alive;
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  innerR: number,
  outerR: number,
  points: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const sx = x + Math.cos(angle) * r;
    const sy = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.fill();
}

// ── Update ─────────────────────────────────────────────────────

const DT = 0.016;
const VISUAL_VELOCITY_SCALE = 0.0003; // Scale domain m/yr velocity for visible advection

function updatePenguin(
  p: Penguin,
  H: Float64Array,
  s: Float64Array,
  u_surface: Float64Array,
  xPositions: Float64Array,
  gl_pos_m: number,
  dc: DrawContext,
): boolean {
  p.life++;
  p.stateTimer++;

  // Dragging overrides all
  if (p.isDragging) return true;

  const iceH = interpThickness(p.x, H, xPositions);
  const surfZ = interpSurface(p.x, s, xPositions);

  // ── On-ice states ──
  if (p.state === 'idle' || p.state === 'walk' || p.state === 'slide' ||
      p.state === 'wave' || p.state === 'jump' || p.state === 'spin' ||
      p.state === 'love' || p.state === 'sleep') {

    // Check if ice disappeared under penguin
    if (iceH < 10) {
      transitionTo(p, 'panic');
      return true;
    }

    // Track ice surface
    p.z = surfZ;

    // Advect with ice flow
    const vel = interpVelocity(p.x, u_surface, xPositions);
    p.x += vel * VISUAL_VELOCITY_SCALE;

    // Walking movement
    if (p.state === 'walk') {
      p.x += p.direction * 150 * DT;
      // Clamp to ice
      if (p.x < xPositions[0] + 2000) {
        p.direction = 1;
      }
      if (p.x > gl_pos_m - 3000) {
        p.direction = -1;
      }
    }

    // Sliding movement
    if (p.state === 'slide') {
      p.x += p.direction * 350 * DT;
    }

    // Jump arc (visual only, z stays on surface)
    if (p.state === 'jump') {
      p.jumpHeight = Math.sin((p.stateTimer / p.stateDuration) * Math.PI) * 100;
    }

    // Spawn particles
    if (p.state === 'sleep' && p.stateTimer % 40 === 0) {
      const pcx = toCanvasX(p.x, dc);
      const pcy = toCanvasY(p.z, dc);
      spawnZzz(pcx, pcy);
    }
    if (p.state === 'love' && p.stateTimer % 12 === 0) {
      const pcx = toCanvasX(p.x, dc);
      const pcy = toCanvasY(p.z, dc);
      spawnHeart(pcx, pcy);
    }
    if (p.state === 'spin' && p.stateTimer === p.stateDuration - 5) {
      const pcx = toCanvasX(p.x, dc);
      const pcy = toCanvasY(p.z, dc);
      spawnStars(pcx, pcy);
    }

    // State timer expiry
    if (p.stateTimer >= p.stateDuration) {
      if (p.state === 'idle') {
        transitionTo(p, pickNextIdleState());
      } else {
        transitionTo(p, 'idle');
      }
    }

    return true;
  }

  // ── Panic → fall ──
  if (p.state === 'panic') {
    p.z = surfZ;
    if (p.stateTimer >= p.stateDuration) {
      transitionTo(p, 'fall');
      p.vz = 30 + Math.random() * 40;
      p.vx = 50 + Math.random() * 80;
    }
    return true;
  }

  // ── Falling ──
  if (p.state === 'fall') {
    p.vz -= 600 * DT; // Gravity
    p.x += p.vx * DT;
    p.z += p.vz * DT;

    // Hit sea level
    if (p.z <= 0) {
      p.z = 0;
      transitionTo(p, 'splash');
      const pcx = toCanvasX(p.x, dc);
      const pcy = toCanvasY(0, dc);
      spawnSplashParticles(pcx, pcy);
    }
    return true;
  }

  // ── Splash animation ──
  if (p.state === 'splash') {
    if (p.stateTimer >= p.stateDuration) {
      transitionTo(p, 'swim');
    }
    return true;
  }

  // ── Swimming ──
  if (p.state === 'swim') {
    p.swimLife++;
    p.x += 30 * DT; // Drift rightward slowly
    p.z = Math.sin(Date.now() * 0.003 + p.bobPhase) * 15;

    // Occasional sad note
    if (p.stateTimer % 80 === 0 && Math.random() > 0.5) {
      const pcx = toCanvasX(p.x, dc);
      const pcy = toCanvasY(p.z, dc);
      spawnNote(pcx, pcy);
    }

    // Fade and cull
    if (p.stateTimer >= p.stateDuration) return false;
    const cx = toCanvasX(p.x, dc);
    if (cx > dc.width + 50) return false;

    return true;
  }

  return true;
}

// ── Main draw (called each frame) ──────────────────────────────

export function drawPenguins(
  dc: DrawContext,
  H: Float64Array,
  s: Float64Array,
  u_surface: Float64Array,
  xPositions: Float64Array,
  gl_pos_m: number,
): void {
  // Cache for mouse handlers
  cachedDC = dc;
  cachedH = H;
  cachedS = s;
  cachedXPositions = xPositions;

  const { ctx } = dc;

  // Update & cull
  const alive: Penguin[] = [];
  for (const p of penguins) {
    if (updatePenguin(p, H, s, u_surface, xPositions, gl_pos_m, dc)) {
      alive.push(p);
    }
  }
  penguins = alive;

  // Respawn if we lost penguins
  const onIceCount = penguins.filter(p =>
    p.state !== 'swim' && p.state !== 'fall' && p.state !== 'splash',
  ).length;
  if (onIceCount < TARGET_PENGUINS) {
    respawnCooldown++;
    if (respawnCooldown > 120) {
      spawnOnePenguin(s, xPositions, gl_pos_m);
      respawnCooldown = 0;
    }
  } else {
    respawnCooldown = 0;
  }

  // Draw each penguin
  for (const p of penguins) {
    const cx = toCanvasX(p.x, dc);
    let cy = toCanvasY(p.z, dc);

    // Jump offset
    if (p.state === 'jump') {
      cy = toCanvasY(p.z + p.jumpHeight, dc);
    }

    // Splash: partially submerged
    if (p.state === 'splash') {
      const submerge = p.stateTimer / p.stateDuration;
      cy += submerge * PENGUIN_HEIGHT_PX * p.size * 0.4;
    }

    // Swim: half submerged
    if (p.state === 'swim') {
      cy += PENGUIN_HEIGHT_PX * p.size * 0.35;
      // Fade out near end
      const fadeStart = p.stateDuration * 0.7;
      if (p.stateTimer > fadeStart) {
        ctx.globalAlpha = 1 - (p.stateTimer - fadeStart) / (p.stateDuration - fadeStart);
      }
    }

    // Dragging penguin — draw at slightly larger scale with shadow
    if (p.isDragging) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      drawPenguinSprite(ctx, p, cx, cy);
      ctx.restore();
    } else {
      drawPenguinSprite(ctx, p, cx, cy);
    }

    ctx.globalAlpha = 1;
  }

  // Draw floating particles (hearts, zzz, etc.)
  drawFloatingParticles(ctx);
}

// ── Mouse interaction ──────────────────────────────────────────

function findPenguinAt(
  canvasX: number,
  canvasY: number,
  dc: DrawContext,
): Penguin | null {
  let closest: Penguin | null = null;
  let closestDist = HIT_RADIUS;

  for (const p of penguins) {
    if (p.state === 'swim' || p.state === 'fall' || p.state === 'splash') continue;

    const px = toCanvasX(p.x, dc);
    let py = toCanvasY(p.z, dc);
    if (p.state === 'jump') {
      py = toCanvasY(p.z + p.jumpHeight, dc);
    }

    const dist = Math.hypot(canvasX - px, canvasY - py);
    if (dist < closestDist) {
      closestDist = dist;
      closest = p;
    }
  }
  return closest;
}

export function handlePenguinMouseDown(
  canvasX: number,
  canvasY: number,
): boolean {
  if (!cachedDC) return false;
  const p = findPenguinAt(canvasX, canvasY, cachedDC);
  if (!p) return false;

  const px = toCanvasX(p.x, cachedDC);
  const py = toCanvasY(p.z, cachedDC);

  p.isDragging = true;
  p.dragOffsetX = px - canvasX;
  p.dragOffsetY = py - canvasY;
  p.emotion = 'surprised';
  penguinCursorState = 'grabbing';
  return true;
}

export function handlePenguinMouseMove(
  canvasX: number,
  canvasY: number,
): void {
  if (!cachedDC) return;

  // Update dragged penguin position
  let anyDragging = false;
  for (const p of penguins) {
    if (p.isDragging) {
      anyDragging = true;
      const targetCx = canvasX + p.dragOffsetX;
      const targetCy = canvasY + p.dragOffsetY;
      p.x = fromCanvasX(targetCx, cachedDC);
      p.z = fromCanvasY(targetCy, cachedDC);
    }
  }

  if (anyDragging) {
    penguinCursorState = 'grabbing';
    return;
  }

  // Hover detection
  const hover = findPenguinAt(canvasX, canvasY, cachedDC);
  penguinCursorState = hover ? 'grab' : 'default';
}

export function handlePenguinMouseUp(): void {
  if (!cachedDC || !cachedH || !cachedS || !cachedXPositions) return;

  for (const p of penguins) {
    if (!p.isDragging) continue;
    p.isDragging = false;

    // Check if dropped over ice or ocean
    const iceH = interpThickness(p.x, cachedH, cachedXPositions);
    const surfZ = interpSurface(p.x, cachedS, cachedXPositions);

    if (iceH > 10 && p.z >= surfZ - 50) {
      // Dropped on ice — land safely
      p.z = surfZ;
      transitionTo(p, 'idle');
      p.emotion = 'surprised';
      p.stateDuration = 30; // Quick surprised idle before normal
    } else {
      // Dropped in ocean!
      transitionTo(p, 'fall');
      p.vz = -20;
      p.vx = 20;
      p.emotion = 'sad';
    }
  }

  penguinCursorState = 'default';
}

export function handlePenguinClick(
  canvasX: number,
  canvasY: number,
): boolean {
  if (!cachedDC) return false;
  const p = findPenguinAt(canvasX, canvasY, cachedDC);
  if (!p) return false;

  // Don't interrupt special states
  if (p.state === 'fall' || p.state === 'splash' || p.state === 'swim' || p.state === 'panic') {
    return true;
  }

  // Pick a random reaction
  const reactions: PenguinState[] = ['wave', 'jump', 'spin'];
  const chosen = reactions[Math.floor(Math.random() * reactions.length)];
  transitionTo(p, chosen);
  return true;
}

export function handlePenguinDoubleClick(
  canvasX: number,
  canvasY: number,
): boolean {
  if (!cachedDC) return false;
  const p = findPenguinAt(canvasX, canvasY, cachedDC);
  if (!p) return false;

  if (p.state === 'fall' || p.state === 'splash' || p.state === 'swim') return true;

  transitionTo(p, 'love');
  return true;
}

// ── Reset ──────────────────────────────────────────────────────

export function resetPenguins(): void {
  penguins = [];
  particles = [];
  nextId = 0;
  respawnCooldown = 0;
  cachedDC = null;
  cachedH = null;
  cachedS = null;
  cachedXPositions = null;
  penguinCursorState = 'default';
}
