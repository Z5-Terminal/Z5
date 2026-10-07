// Z5 :: motion — springs, gesture physics and motion preferences.
//
// The rule for this app: motion starts from the current on-screen value,
// inherits the user's velocity, and can be grabbed or reversed at any
// instant. Springs make that natural, so every non-trivial movement here
// is a spring described by two numbers:
//   damping  — 1.0 = critically damped (no overshoot, the default);
//              ~0.8 = a little bounce, only when a gesture carried momentum.
//   response — seconds to (roughly) reach the target. Not a duration.
//
// Two ways to use them:
//   1. CSS:  `transition: transform ${MOTION.move}` — the spring is sampled
//      into a linear() easing and installed as a CSS variable. CSS
//      transitions always start from the current computed value, so they
//      stay interruptible. Use for state changes (tab indicator, toggles).
//   2. JS:   animateSpring({ from, to, velocity, onUpdate }) — for anything
//      driven by a gesture, where release velocity must be handed off.
//
// Only ever animate transform and opacity.

// ── Spring solver (analytic damped harmonic oscillator) ─────────────
// Returns displacement-from-target at time t for a unit-mass spring.
function springDisplacement(d0, v0, damping, response, t) {
  const w0 = (2 * Math.PI) / response;
  if (damping >= 1) {
    // Critically damped.
    return (d0 + (v0 + w0 * d0) * t) * Math.exp(-w0 * t);
  }
  const wd = w0 * Math.sqrt(1 - damping * damping);
  const a = d0;
  const b = (v0 + damping * w0 * d0) / wd;
  return Math.exp(-damping * w0 * t) * (a * Math.cos(wd * t) + b * Math.sin(wd * t));
}

// Time for the spring to settle within `eps` of the target.
function settleTime(damping, response, eps = 0.001) {
  const w0 = (2 * Math.PI) / response;
  if (damping >= 1) {
    // Solve (1 + w0 t) e^{-w0 t} = eps numerically.
    let t = response;
    for (let i = 0; i < 60; i++) {
      if ((1 + w0 * t) * Math.exp(-w0 * t) <= eps) break;
      t += response / 10;
    }
    return t;
  }
  return Math.log(1 / eps) / (damping * w0);
}

// Sample a spring (0 → 1, zero initial velocity) into a CSS linear() easing.
export function springEasing(damping = 1, response = 0.4, samples = 32) {
  const duration = settleTime(damping, response);
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * duration;
    const x = 1 - springDisplacement(1, 0, damping, response, t);
    pts.push(i === samples ? "1" : x.toFixed(4).replace(/\.?0+$/, "") || "0");
  }
  return { easing: `linear(${pts.join(", ")})`, duration: Math.round(duration * 1000) };
}

// The app's spring presets.
const SPRINGS = {
  // Default UI spring: move / reposition / resize. No overshoot.
  move:   springEasing(1.0, 0.36),
  // Quicker settle for small things (thumbs, chevrons, highlights).
  snap:   springEasing(1.0, 0.26),
  // Slight bounce — only after a gesture with momentum (flick, drop).
  bounce: springEasing(0.8, 0.34),
};

// CSS shorthand fragments: `transition: transform ${MOTION.move}`.
// The easing is a CSS variable so index.html can provide a cubic-bezier
// fallback where linear() is unsupported and so reduced-motion can
// neutralise it globally.
export const MOTION = {
  move:   `${SPRINGS.move.duration}ms var(--z5-spring)`,
  snap:   `${SPRINGS.snap.duration}ms var(--z5-spring-snap)`,
  bounce: `${SPRINGS.bounce.duration}ms var(--z5-spring-bounce)`,
  // Plain short fades for color/opacity feedback.
  fade:   "180ms ease-out",
  quick:  "120ms ease-out",
};

export const DURATION = {
  move: SPRINGS.move.duration,
  snap: SPRINGS.snap.duration,
  bounce: SPRINGS.bounce.duration,
};

// Install the sampled springs as CSS variables. Called once at startup.
// They go in as a stylesheet rule scoped to "no reduced-motion preference"
// (not as inline style on <html>, which would outrank the reduced-motion
// overrides in index.html and keep the overshoot for people who asked
// for less motion).
export function installMotionVars() {
  if (typeof document === "undefined") return;
  if (document.getElementById("z5-motion-vars")) return;
  let supportsLinear = false;
  try {
    supportsLinear = !!(window.CSS && CSS.supports
      && CSS.supports("transition-timing-function", "linear(0, 1)"));
  } catch { /* ignore */ }
  if (!supportsLinear) return; // index.html ships cubic-bezier fallbacks
  const style = document.createElement("style");
  style.id = "z5-motion-vars";
  style.textContent =
    "@media (prefers-reduced-motion: no-preference) { :root {"
    + `--z5-spring: ${SPRINGS.move.easing};`
    + `--z5-spring-snap: ${SPRINGS.snap.easing};`
    + `--z5-spring-bounce: ${SPRINGS.bounce.easing};`
    + "} }";
  document.head.appendChild(style);
}

// ── JS spring for gesture-driven motion ─────────────────────────────
// Animates a single number. Re-targetable and stoppable at any frame;
// `velocity` (units/second) is the hand-off from the gesture.
export function animateSpring({
  from, to, velocity = 0, damping = 1, response = 0.36,
  onUpdate, onRest, restDelta = 0.5,
}) {
  let raf = 0;
  let stopped = false;
  let start = now();
  let d0 = from - to;
  let v0 = velocity;
  let target = to;
  let current = from;
  let currentVelocity = velocity;

  function frame() {
    if (stopped) return;
    const t = (now() - start) / 1000;
    const d = springDisplacement(d0, v0, damping, response, t);
    const dNext = springDisplacement(d0, v0, damping, response, t + 0.001);
    current = target + d;
    currentVelocity = (dNext - d) / 0.001;
    onUpdate && onUpdate(current, currentVelocity);
    if (Math.abs(d) < restDelta && Math.abs(currentVelocity) < restDelta * 20) {
      stopped = true;
      current = target;
      onUpdate && onUpdate(target, 0);
      onRest && onRest();
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    // Redirect mid-flight, keeping position and velocity (interruption).
    retarget(nextTo, opts = {}) {
      d0 = current - nextTo;
      v0 = opts.velocity != null ? opts.velocity : currentVelocity;
      target = nextTo;
      start = now();
      if (stopped) { stopped = false; raf = requestAnimationFrame(frame); }
    },
    stop() { stopped = true; cancelAnimationFrame(raf); },
    get value() { return current; },
    get velocity() { return currentVelocity; },
    get done() { return stopped; },
  };
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

// ── Gesture physics ─────────────────────────────────────────────────
// Where a flick would come to rest: decide the destination from this,
// not from the release point. v in px/s.
export function project(velocity, deceleration = 0.998) {
  return (velocity / 1000) * deceleration / (1 - deceleration);
}

// Progressive resistance past a boundary.
export function rubberband(overshoot, dimension, c = 0.55) {
  return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
}

// Keeps a short history of pointer samples and reports release velocity
// (px/s) from the last ~100ms — the instantaneous last delta is too noisy.
export function createVelocityTracker() {
  let samples = [];
  return {
    reset() { samples = []; },
    add(value, time = now()) {
      samples.push({ value, time });
      while (samples.length > 2 && time - samples[0].time > 120) samples.shift();
    },
    get() {
      if (samples.length < 2) return 0;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = (last.time - first.time) / 1000;
      if (dt <= 0) return 0;
      return (last.value - first.value) / dt;
    },
  };
}

// ── Preferences ─────────────────────────────────────────────────────
export function prefersReducedMotion() {
  try {
    return typeof window !== "undefined"
      && !!window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch { return false; }
}
