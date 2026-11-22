// Z5 :: DotHero — the Hub poster artwork as an interactive dot field.
//
// Each soldier is ~17k shaded spheres, baked offline into
// public/hero-dots-<console>.bin (position, radius, brightness per dot,
// darkest first so bright dots land on top). Dots near the pointer are
// pushed away and spring back home; a tap sends a short ripple.
//
// Two variants: "dark" (lit white spheres on black) and "light" (ink
// spheres drawn straight onto the light page; brightness = ink density).
//
// The static JPEG of the same dots paints first and stays as the
// fallback (data failed to load, or reduced motion). The animation loop
// only runs while something is moving, so an idle Hub costs nothing.
//
// Binary format (little-endian): "Z5DT", u16 frameW, u16 frameH,
// u32 count, then count × { u16 x, u16 y, u8 size, u8 brightness, u8 flags }
// with x / y normalised to 0..65535 of the frame. flags 0 = sphere
// (size = radius × 40); flags 2 = censor-mosaic square (size = half-side
// × 10) — the press-photo style block over the eyes, drawn last.

import { useEffect, useRef, useState } from "react";
import { ART } from "./theme";
import { prefersReducedMotion } from "./motion";

const LEVELS = 24;          // brightness buckets → one pre-rendered sprite each
const SPRITE = 48;          // sprite resolution (px); drawn scaled down
const GAIN = 1.0;           // global brightness tweak
const SIZE = 1.0;           // global dot-size tweak

const cache = new Map();    // url → Promise<dot data>

function loadDots(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
      .then((buf) => {
        const dv = new DataView(buf);
        const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
        if (magic !== "Z5DT") throw new Error("bad dot file");
        const fw = dv.getUint16(4, true), fh = dv.getUint16(6, true), n = dv.getUint32(8, true);
        const x = new Float32Array(n), y = new Float32Array(n), r = new Float32Array(n);
        const lvl = new Uint8Array(n), sq = new Uint8Array(n);
        for (let i = 0, o = 12; i < n; i++, o += 7) {
          x[i] = (dv.getUint16(o, true) / 65535) * fw;
          y[i] = (dv.getUint16(o + 2, true) / 65535) * fh;
          sq[i] = dv.getUint8(o + 6) === 2 ? 1 : 0;
          r[i] = dv.getUint8(o + 4) / (sq[i] ? 10 : 40);
          const b = Math.min(1, (dv.getUint8(o + 5) / 255) * GAIN);
          lvl[i] = Math.min(LEVELS - 1, Math.floor(b * LEVELS));
        }
        return { fw, fh, n, x, y, r, lvl, sq };
      }));
    cache.get(url).catch(() => cache.delete(url)); // allow a retry on the next mount
  }
  return cache.get(url);
}

const lerp3 = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, k))));
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

const squareSets = {};
function squares(variant) {
  if (squareSets[variant]) return squareSets[variant];
  squareSets[variant] = Array.from({ length: LEVELS }, (_, l) => {
    const b = (l + 0.5) / LEVELS;
    const c = document.createElement("canvas");
    c.width = c.height = SPRITE;
    const ctx = c.getContext("2d");
    ctx.fillStyle = variant === "light"
      ? rgb(lerp3(ART.paper, ART.ink, b))
      : rgb(ART.dot.map((v) => Math.round(v * b)));
    ctx.fillRect(1, 1, SPRITE - 2, SPRITE - 2);     // 1px gutter = the mosaic grid
    return c;
  });
  return squareSets[variant];
}

// Light variant: an ink sphere on paper — pale cap where the light hits,
// ink body, darker rim. `b` is ink density.
function inkSprites() {
  return Array.from({ length: LEVELS }, (_, l) => {
    const b = (l + 0.5) / LEVELS;
    const base = lerp3(ART.paper, ART.ink, 0.18 + 0.72 * Math.pow(b, 1.1));
    const c = document.createElement("canvas");
    c.width = c.height = SPRITE;
    const ctx = c.getContext("2d");
    const h = SPRITE / 2;
    const g = ctx.createRadialGradient(h * 0.72, h * 0.62, h * 0.06, h, h, h);
    g.addColorStop(0, rgb(lerp3(base, ART.paper, 0.32)));
    g.addColorStop(0.5, rgb(base));
    g.addColorStop(1, rgb(lerp3(base, ART.ink, 0.3)));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(h, h, h - 0.5, 0, Math.PI * 2); ctx.fill();
    return c;
  });
}

const spriteSets = {};
function sprites(variant) {
  if (spriteSets[variant]) return spriteSets[variant];
  if (variant === "light") return (spriteSets.light = inkSprites());
  const [r0, g0, b0] = ART.dot;
  const [rs, gs, bs] = ART.dotShadow;
  spriteSets.dark = Array.from({ length: LEVELS }, (_, l) => {
    const b = (l + 0.5) / LEVELS;
    const c = document.createElement("canvas");
    c.width = c.height = SPRITE;
    const ctx = c.getContext("2d");
    const h = SPRITE / 2;
    const mix = (k) => `rgb(${Math.round(rs + (r0 - rs) * k)},${Math.round(gs + (g0 - gs) * k)},${Math.round(bs + (b0 - bs) * k)})`;
    // Lit from the top-left: bright cap, mid body, dark rim.
    const g = ctx.createRadialGradient(h * 0.72, h * 0.62, h * 0.06, h, h, h);
    g.addColorStop(0, mix(Math.min(1, b * 1.18)));
    g.addColorStop(0.45, mix(b * 0.86));
    g.addColorStop(1, mix(b * 0.2));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(h, h, h - 0.5, 0, Math.PI * 2); ctx.fill();
    // Specular glint.
    const s = ctx.createRadialGradient(h * 0.66, h * 0.56, 0, h * 0.66, h * 0.56, h * 0.42);
    s.addColorStop(0, `rgba(255,255,255,${0.15 + 0.55 * b})`);
    s.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = s;
    ctx.beginPath(); ctx.arc(h, h, h - 0.5, 0, Math.PI * 2); ctx.fill();
    return c;
  });
  return spriteSets.dark;
}

export default function DotHero({ dotsSrc, fallbackSrc, variant = "dark", interactive = true, onError, style }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!dotsSrc) return undefined;
    const reduced = prefersReducedMotion();
    if (reduced) return undefined;           // the static image is the artwork
    let alive = true;
    let data = null;
    let raf = 0;
    const wrap = wrapRef.current, canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    // layout (CSS px): home positions and radii in the card's frame
    let w = 0, h = 0, dpr = 1, hx, hy, hr, ox, oy, vx, vy, mass, spring;
    let prev = null;          // last frame's dirty rect [x0, y0, x1, y1]
    const pointer = { x: 0, y: 0, on: false, until: 0 };

    function layout() {
      if (!data) return;
      // Unscaled box: the poster zooms on hover via a CSS transform.
      w = wrap.offsetWidth; h = wrap.offsetHeight;
      if (!w || !h) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      // object-fit: cover, centred — the same crop as the fallback <img>
      const scale = Math.max(w / data.fw, h / data.fh);
      const offX = (w - data.fw * scale) / 2, offY = (h - data.fh * scale) / 2;
      const n = data.n;
      hx = new Float32Array(n); hy = new Float32Array(n); hr = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        hx[i] = offX + data.x[i] * scale;
        hy[i] = offY + data.y[i] * scale;
        hr[i] = data.sq[i] ? data.r[i] * scale : Math.max(0.6, data.r[i] * scale * SIZE);
      }
      if (!ox || ox.length !== n) {
        ox = new Float32Array(n); oy = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n);
        // Each dot gets its own weight and spring so a push spreads into a
        // soft band (not a hard ring) and the field flows back unevenly.
        mass = new Float32Array(n); spring = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12543.123;
          mass[i] = 0.45 + (a - Math.floor(a)) * 1.1;
          spring[i] = 0.035 + (b - Math.floor(b)) * 0.04;
        }
      }
      prev = null;
      draw();
    }

    // Full redraw, or only the dots overlapping `rect` (clipped) while the
    // field is moving — usually a small patch around the pointer.
    function draw(rect) {
      const sp = sprites(variant), sqs = squares(variant);
      const { lvl, sq } = data;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let x0 = -Infinity, y0 = -Infinity, x1 = Infinity, y1 = Infinity;
      if (rect) {
        [x0, y0, x1, y1] = rect;
        ctx.save();
        ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
        ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
      for (let i = 0, n = data.n; i < n; i++) {
        const r = hr[i], cx = hx[i] + ox[i], cy = hy[i] + oy[i];
        if (cx + r < x0 || cx - r > x1 || cy + r < y0 || cy - r > y1) continue;
        ctx.drawImage((sq[i] ? sqs : sp)[lvl[i]], cx - r, cy - r, r * 2, r * 2);
      }
      if (rect) ctx.restore();
    }

    function step(now) {
      raf = 0;
      if (pointer.until && now > pointer.until) { pointer.on = false; pointer.until = 0; }
      const R = Math.max(48, w * 0.17), R2 = R * R;
      const PUSH = Math.max(1.4, w * 0.0065), DAMP = 0.84;
      let moving = false;
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      const { x: px, y: py, on } = pointer;
      for (let i = 0, n = data.n; i < n; i++) {
        let dvx = vx[i], dvy = vy[i], oxi = ox[i], oyi = oy[i];
        if (on) {
          const dx = hx[i] + oxi - px, dy = hy[i] + oyi - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 0.01) {
            const d = Math.sqrt(d2), f = 1 - d / R, s = f * f * PUSH * mass[i];
            dvx += (dx / d) * s; dvy += (dy / d) * s;
          }
        }
        if (dvx === 0 && dvy === 0 && oxi === 0 && oyi === 0) continue;   // at rest
        dvx = (dvx - oxi * spring[i]) * DAMP; dvy = (dvy - oyi * spring[i]) * DAMP;
        oxi += dvx; oyi += dvy;
        if (dvx * dvx + dvy * dvy < 0.0002 && oxi * oxi + oyi * oyi < 0.004) { dvx = dvy = oxi = oyi = 0; }
        else moving = true;
        ox[i] = oxi; oy[i] = oyi; vx[i] = dvx; vy[i] = dvy;
        // dirty area: the dot's current spot and its home (snap-back clears it)
        const r = hr[i] + 1, cx = hx[i] + oxi, cy = hy[i] + oyi;
        bx0 = Math.min(bx0, cx - r, hx[i] - r); by0 = Math.min(by0, cy - r, hy[i] - r);
        bx1 = Math.max(bx1, cx + r, hx[i] + r); by1 = Math.max(by1, cy + r, hy[i] + r);
      }
      const cur = bx0 <= bx1 ? [bx0, by0, bx1, by1] : null;
      const rect = cur && prev
        ? [Math.min(cur[0], prev[0]), Math.min(cur[1], prev[1]), Math.max(cur[2], prev[2]), Math.max(cur[3], prev[3])]
        : (cur || prev);
      if (rect) draw([Math.floor(rect[0]), Math.floor(rect[1]), Math.ceil(rect[2]), Math.ceil(rect[3])]);
      prev = cur;
      if (moving || pointer.on || cur) raf = requestAnimationFrame(step);
    }
    const kick = () => { if (!raf && data) raf = requestAnimationFrame(step); };

    // The poster <button> is the hit area (the canvas ignores pointers).
    const host = wrap.parentElement;
    const at = (e) => {
      // Map the pointer back through the hover zoom into the unscaled box.
      const r = wrap.getBoundingClientRect();
      pointer.x = (e.clientX - r.left) * (w / (r.width || 1));
      pointer.y = (e.clientY - r.top) * (h / (r.height || 1));
    };
    const onMove = (e) => { if (e.pointerType === "touch") return; at(e); pointer.on = true; pointer.until = 0; kick(); };
    const onLeave = () => { pointer.on = false; kick(); };
    const onDown = (e) => {
      if (e.pointerType !== "touch") return;
      at(e); pointer.on = true; pointer.until = performance.now() + 260; kick();   // tap ripple
    };
    if (interactive) {
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
      host.addEventListener("pointerdown", onDown);
    }
    const ro = new ResizeObserver(() => layout());
    ro.observe(wrap);

    loadDots(dotsSrc).then((d) => {
      if (!alive) return;
      data = d;
      layout();
      setReady(true);
    }).catch(() => { /* keep the static image */ });

    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
    };
  }, [dotsSrc, variant, interactive]);

  const layer = { position: "absolute", inset: 0, width: "100%", height: "100%" };
  return (
    <div ref={wrapRef} aria-hidden style={{ ...layer, pointerEvents: "none", ...style }}>
      <img
        src={fallbackSrc}
        alt=""
        onError={onError}
        style={{ ...layer, objectFit: "cover", objectPosition: "center", opacity: ready ? 0 : 1, transition: "opacity 260ms ease-out" }}
      />
      <canvas ref={canvasRef} style={{ ...layer, opacity: ready ? 1 : 0, transition: "opacity 260ms ease-out" }} />
    </div>
  );
}
