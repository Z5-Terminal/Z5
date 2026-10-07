// Z5 :: overlay primitives — Modal (dialog / bottom sheet), Menu, Lightbox.
//
// Layering model: a modal task dims the page behind it (scrim) and takes
// focus; a menu is a light, non-blocking popover anchored to its trigger.
// Every overlay enters and exits along the same path, materialises from
// its origin, and can be interrupted at any moment.
//
// Re-exported from ui.jsx — import from there.
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { C, FONT, MATERIAL, R, T, Z } from "./theme";
import { useIsMobile } from "./useIsMobile";
import { useTheme } from "./ThemeContext";
import {
  animateSpring, createVelocityTracker, project, rubberband,
  prefersReducedMotion, DURATION,
} from "./motion";
import { Icon } from "./icons";

// ── helpers ─────────────────────────────────────────────────────────

function Portal({ children }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

// Keep the page behind a modal from scrolling. Counted, so stacked
// overlays (a confirm on top of a sheet) restore correctly.
let scrollLocks = 0;
let savedOverflow = "";
function lockScroll() {
  if (typeof document === "undefined") return () => {};
  if (scrollLocks === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLocks -= 1;
    if (scrollLocks === 0) document.body.style.overflow = savedOverflow;
  };
}

// Track the visual viewport so a bottom sheet rides above the on-screen
// keyboard instead of hiding behind it (iOS keeps position:fixed
// elements pinned to the layout viewport).
function useVisualViewportBox(active) {
  const [box, setBox] = useState(null);
  useEffect(() => {
    if (!active || typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => setBox({ height: vv.height, top: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);
  return box;
}

function useEscape(active, onEscape) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onEscape && onEscape(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onEscape]);
}

// Move focus into an overlay on open and hand it back on close.
function useFocusHandoff(ref, active) {
  useEffect(() => {
    if (!active) return;
    const prev = typeof document !== "undefined" ? document.activeElement : null;
    const el = ref.current;
    if (el && !el.contains(document.activeElement)) {
      try { el.focus({ preventScroll: true }); } catch { /* ignore */ }
    }
    return () => {
      if (prev && prev.focus) { try { prev.focus({ preventScroll: true }); } catch { /* ignore */ } }
    };
  }, [active, ref]);
}

// ── Modal ───────────────────────────────────────────────────────────
// Desktop: centered dialog that materialises (blur + scale + fade).
// Mobile:  bottom sheet on a spring — follows the finger 1:1 from its
//          grabber, rubber-bands upward, and on release decides between
//          dismiss and snap-back from the *projected* landing point, with
//          the finger's velocity handed to the spring.
// Escape and tapping the scrim close it. The exit animation plays even
// though the parent has already set open=false (content is snapshotted).
// `dir` forces a direction for screens that don't follow the app language
// (the modal is portaled to <body>, outside the caller's subtree).
export function Modal({ open, onClose, title, children, maxWidth = 460, footer, variant, dir }) {
  const isMobile = useIsMobile();
  useTheme(); // re-render on theme change
  const [mounted, setMounted] = useState(!!open);
  const [closing, setClosing] = useState(false);

  // Snapshot what to show while animating out.
  const snap = useRef({ title, children, footer });
  if (open) snap.current = { title, children, footer };

  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); }
    else if (mounted) setClosing(true);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onExited = useCallback(() => { setMounted(false); setClosing(false); }, []);

  useEffect(() => {
    if (!mounted) return;
    return lockScroll();
  }, [mounted]);

  useEscape(mounted && !closing, onClose);

  if (!mounted) return null;

  const asSheet = variant ? variant === "sheet" : isMobile;
  const content = snap.current;

  return (
    <Portal>
      {asSheet ? (
        <SheetSurface closing={closing} onClose={onClose} onExited={onExited} title={content.title} footer={content.footer} dir={dir}>
          {content.children}
        </SheetSurface>
      ) : (
        <DialogSurface closing={closing} onClose={onClose} onExited={onExited} title={content.title} footer={content.footer} maxWidth={maxWidth} dir={dir}>
          {content.children}
        </DialogSurface>
      )}
    </Portal>
  );
}

function DialogSurface({ closing, onClose, onExited, title, children, footer, maxWidth, dir }) {
  const ref = useRef(null);
  useFocusHandoff(ref, true);

  // Fallback in case animationend never fires (tab hidden, etc.).
  useEffect(() => {
    if (!closing) return;
    const id = setTimeout(onExited, 260);
    return () => clearTimeout(id);
  }, [closing, onExited]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z.modal,
        background: C.scrim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: FONT,
        animation: closing ? "z5-fade-out 200ms ease-in both" : "z5-fade-in 240ms ease-out both",
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        dir={dir}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(e) => { if (closing && e.target === e.currentTarget) onExited(); }}
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "min(86vh, 760px)",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          background: C.panel,
          color: C.text,
          border: `1px solid ${C.materialBorder}`,
          borderRadius: R.xl,
          boxShadow: C.shadowLg,
          outline: "none",
          overflow: "hidden",
          animation: closing
            ? "z5-dematerialize 180ms ease-in both"
            : `z5-materialize ${DURATION.move}ms var(--z5-spring) both`,
        }}
      >
        <div style={{ overflowY: "auto", padding: "22px 24px 20px", overscrollBehavior: "contain" }}>
          {title && (
            <div style={{ ...T.title3, color: C.bright, marginBottom: 10 }}>{title}</div>
          )}
          {children}
        </div>
        {footer && (
          <div style={{ padding: "12px 24px 20px", borderTop: `1px solid ${C.separator}` }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

function SheetSurface({ closing, onClose, onExited, title, children, footer, dir }) {
  const sheetRef = useRef(null);
  const scrimRef = useRef(null);
  const ctrl = useRef(null);       // running spring
  const y = useRef(0);             // current offset (0 = fully presented)
  const height = useRef(1);
  const closingRef = useRef(false);
  const releaseVelocity = useRef(0);
  const drag = useRef(null);
  const tracker = useRef(createVelocityTracker());
  const settleTimer = useRef(0);
  useEffect(() => () => clearTimeout(settleTimer.current), []);
  const reduced = prefersReducedMotion();
  const vv = useVisualViewportBox(true);

  useFocusHandoff(sheetRef, true);

  const apply = useCallback((value) => {
    y.current = value;
    const el = sheetRef.current;
    if (el) el.style.transform = `translate3d(0, ${value}px, 0)`;
    const sc = scrimRef.current;
    if (sc) sc.style.opacity = String(Math.max(0, Math.min(1, 1 - value / height.current)));
  }, []);

  // Always animate from the live on-screen value, carrying velocity.
  const springTo = useCallback((target, { velocity, bounce, onRest } = {}) => {
    const v = velocity != null ? velocity : (ctrl.current && !ctrl.current.done ? ctrl.current.velocity : 0);
    if (ctrl.current) ctrl.current.stop();
    ctrl.current = animateSpring({
      from: y.current, to: target, velocity: v,
      damping: bounce ? 0.82 : 1, response: 0.34,
      onUpdate: apply, onRest,
    });
  }, [apply]);

  // Present.
  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    height.current = el.offsetHeight || 1;
    if (reduced) { apply(0); return; }
    apply(height.current);
    springTo(0);
    return () => { if (ctrl.current) ctrl.current.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dismiss — same path it came in on. If the owner reopens while the
  // exit is still in flight, turn around from wherever the sheet is:
  // retargeting drops the pending onExited, so it can't unmount an
  // open sheet.
  const wasClosing = useRef(false);
  useEffect(() => {
    closingRef.current = closing;
    if (!closing) {
      if (wasClosing.current) {
        wasClosing.current = false;
        releaseVelocity.current = 0;
        if (reduced) apply(0); else springTo(0);
      }
      return;
    }
    wasClosing.current = true;
    if (reduced) {
      const id = setTimeout(onExited, 170);
      return () => clearTimeout(id);
    }
    springTo(height.current + 24, { velocity: releaseVelocity.current || undefined, onRest: onExited });
    const id = setTimeout(onExited, 700); // safety net
    return () => clearTimeout(id);
  }, [closing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── drag from the grabber / header ──
  function onPointerDown(e) {
    if (closingRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { startY: e.clientY, startOffset: y.current, active: false, id: e.pointerId };
    tracker.current.reset();
    tracker.current.add(y.current);
    // Grab mid-flight: stop whatever animation is running and take over.
    if (ctrl.current) ctrl.current.stop();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  function onPointerMove(e) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    if (!d.active) {
      if (Math.abs(dy) < 6) return; // hysteresis before committing to a drag
      d.active = true;
    }
    const raw = d.startOffset + dy;
    // 1:1 downward; progressive resistance when pulled above its rest point.
    const next = raw >= 0 ? raw : -rubberband(-raw, height.current, 0.4);
    apply(next);
    tracker.current.add(next);
  }
  function onPointerEnd(e) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!d.active) { if (y.current !== 0) springTo(0); return; }
    const v = tracker.current.get();
    // Decide from where the flick would land, not where the finger let go.
    const landing = y.current + project(v);
    if (landing > height.current * 0.5) {
      releaseVelocity.current = v;
      onClose && onClose();
      // If the owner declines to close (e.g. busy), settle back open.
      clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        if (!closingRef.current) { releaseVelocity.current = 0; springTo(0, { velocity: v }); }
      }, 60);
    } else {
      springTo(0, { velocity: v, bounce: Math.abs(v) > 400 });
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        insetInline: 0,
        top: vv ? vv.top : 0,
        height: vv ? vv.height : "100%",
        zIndex: Z.modal,
        fontFamily: FONT,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        animation: reduced ? (closing ? "z5-fade-out 160ms ease-in both" : "z5-fade-in 160ms ease-out both") : undefined,
      }}
    >
      <div
        ref={scrimRef}
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: C.scrim, opacity: reduced ? 1 : 0 }}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        dir={dir}
        data-material=""
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 560,
          marginInline: "auto",
          maxHeight: "92%",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          background: C.materialThick,
          ...MATERIAL.thick,
          color: C.text,
          borderTopLeftRadius: R.sheet,
          borderTopRightRadius: R.sheet,
          borderTop: `1px solid ${C.materialBorder}`,
          boxShadow: C.shadowLg,
          outline: "none",
          willChange: "transform",
          // Extends below the fold so a bouncy landing never shows a gap.
          paddingBottom: 60,
          marginBottom: -60,
        }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          style={{ touchAction: "none", cursor: "grab", padding: "8px 20px 4px", flexShrink: 0 }}
        >
          <div aria-hidden style={{
            width: 36, height: 5, borderRadius: 3, background: C.fillStrong, margin: "0 auto 10px",
          }} />
          {title && (
            <div style={{ ...T.title3, color: C.bright, textAlign: "center", paddingBottom: 6 }}>{title}</div>
          )}
        </div>
        <div style={{
          overflowY: "auto",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          padding: `6px 20px calc(20px + var(--safe-bottom))`,
        }}>
          {children}
          {footer && <div style={{ marginTop: 16 }}>{footer}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Menu ────────────────────────────────────────────────────────────
// A light popover of actions anchored to its trigger. It materialises
// from the corner nearest the trigger (transform-origin) and leaves the
// same way; it does not dim the page.
//
//   <Menu
//     trigger={(props) => <Btn small {...props}>New</Btn>}
//     items={[{ key, label, icon, iconFlip, onSelect, danger, disabled, checked }, "divider", ...]}
//   />
//
// `trigger` receives { onClick, "aria-haspopup", "aria-expanded" } to spread
// on the trigger element. Items commit on click/tap; Escape, outside
// click and scrolling the page close it.
export function Menu({ trigger, items = [], align = "end", minWidth = 208 }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState(null);
  const anchorRef = useRef(null);
  const menuRef = useRef(null);
  useTheme();

  const close = useCallback(() => {
    setClosing(true);
  }, []);
  const finishClose = useCallback(() => { setOpen(false); setClosing(false); setPos(null); }, []);

  useEffect(() => {
    if (!closing) return;
    const id = setTimeout(finishClose, 150);
    return () => clearTimeout(id);
  }, [closing, finishClose]);

  // Anchor to the trigger in viewport coordinates (the menu is portaled,
  // so no ancestor overflow or transform can clip it).
  const place = useCallback(() => {
    const a = anchorRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rtl = (document.documentElement.getAttribute("dir") || "ltr") === "rtl";
    // "end" aligns the menu's trailing edge with the trigger's trailing edge.
    const alignRight = (align === "end") !== rtl;
    const estHeight = Math.min(items.length * 44 + 12, vh * 0.6);
    const below = vh - r.bottom;
    const up = below < estHeight + 16 && r.top > below;
    setPos({
      top: up ? undefined : Math.round(r.bottom + 6),
      bottom: up ? Math.round(vh - r.top + 6) : undefined,
      left: alignRight ? undefined : Math.max(8, Math.round(r.left)),
      right: alignRight ? Math.max(8, Math.round(vw - r.right)) : undefined,
      origin: `${alignRight ? "right" : "left"} ${up ? "bottom" : "top"}`,
    });
  }, [align, items.length]);

  useEffect(() => {
    if (!open) return;
    place();
    const onScroll = (e) => {
      // Scrolling inside the menu itself must not dismiss it.
      if (e && e.target && menuRef.current && menuRef.current.contains(e.target)) return;
      close();
    };
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open, place, close]);

  useEscape(open && !closing, close);

  const triggerProps = {
    onClick: (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      if (open) close(); else setOpen(true);
    },
    "aria-haspopup": "menu",
    "aria-expanded": open,
  };

  return (
    <span ref={anchorRef} style={{ display: "inline-flex", position: "relative" }}>
      {trigger(triggerProps)}
      {open && pos && (
        <Portal>
          <div
            onClick={(e) => { e.stopPropagation(); close(); }}
            style={{ position: "fixed", inset: 0, zIndex: Z.menu }}
          />
          <div
            ref={menuRef}
            role="menu"
            data-material=""
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              right: pos.right,
              zIndex: Z.menu + 1,
              minWidth,
              maxWidth: "min(320px, calc(100vw - 16px))",
              maxHeight: "60vh",
              overflowY: "auto",
              padding: 5,
              boxSizing: "border-box",
              background: C.materialThick,
              ...MATERIAL.thick,
              border: `1px solid ${C.materialBorder}`,
              borderRadius: 14,
              boxShadow: C.shadowLg,
              fontFamily: FONT,
              transformOrigin: pos.origin,
              // Inert while it animates out, so a double-tap can't fire an
              // item twice.
              pointerEvents: closing ? "none" : undefined,
              animation: closing
                ? "z5-dematerialize 140ms ease-in both"
                : `z5-materialize ${DURATION.snap}ms var(--z5-spring-snap) both`,
            }}
          >
            {items.map((it, i) => {
              if (!it) return null;
              if (it === "divider") {
                return <div key={`d${i}`} style={{ height: 1, background: C.separator, margin: "5px 8px" }} />;
              }
              return (
                <button
                  key={it.key || i}
                  type="button"
                  role="menuitem"
                  data-press="row"
                  disabled={it.disabled}
                  onClick={() => { if (closing) return; close(); it.onSelect && it.onSelect(); }}
                  style={{
                    all: "unset",
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    minHeight: 40,
                    padding: "8px 11px",
                    borderRadius: 9,
                    cursor: it.disabled ? "default" : "pointer",
                    color: it.danger ? C.error : C.bright,
                    fontFamily: FONT,
                    ...T.callout,
                    fontWeight: 500,
                  }}
                >
                  {it.icon && <Icon name={it.icon} size={17} flip={it.iconFlip} style={{ opacity: it.danger ? 1 : 0.72 }} />}
                  <span style={{ flex: 1, minWidth: 0 }}>{it.label}</span>
                  {it.checked && <Icon name="check" size={16} />}
                </button>
              );
            })}
          </div>
        </Portal>
      )}
    </span>
  );
}

// ── Lightbox ────────────────────────────────────────────────────────
// Full-screen image viewer. The image materialises; tap anywhere or
// press Escape to dismiss.
export function Lightbox({ src, alt = "", onClose, closeLabel = "Close" }) {
  const [closing, setClosing] = useState(false);
  const ref = useRef(null);
  const requestClose = useCallback(() => setClosing(true), []);

  useEffect(() => {
    if (!src) { setClosing(false); return; }
    setClosing(false);
    return lockScroll();
  }, [src]);

  useEffect(() => {
    if (!closing) return;
    const id = setTimeout(() => { onClose && onClose(); }, 170);
    return () => clearTimeout(id);
  }, [closing, onClose]);

  useEscape(!!src && !closing, requestClose);
  useFocusHandoff(ref, !!src);

  if (!src) return null;
  return (
    <Portal>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={alt || closeLabel}
        tabIndex={-1}
        onClick={requestClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: Z.lightbox,
          background: C.scrimStrong,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "calc(20px + var(--safe-top)) 16px calc(20px + var(--safe-bottom))",
          boxSizing: "border-box",
          outline: "none",
          cursor: "zoom-out",
          animation: closing ? "z5-fade-out 160ms ease-in both" : "z5-fade-in 220ms ease-out both",
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            borderRadius: R.lg,
            boxShadow: C.shadowLg,
            animation: closing
              ? "z5-dematerialize 160ms ease-in both"
              : `z5-materialize ${DURATION.move}ms var(--z5-spring) both`,
          }}
        />
        <button
          type="button"
          aria-label={closeLabel}
          data-press="scale"
          onClick={(e) => { e.stopPropagation(); requestClose(); }}
          style={{
            all: "unset",
            boxSizing: "border-box",
            position: "absolute",
            top: "calc(14px + var(--safe-top))",
            insetInlineEnd: 14,
            width: 36,
            height: 36,
            borderRadius: R.pill,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: C.imageOverlayText,
            background: `${C.imageTint}0.16)`,
            ...MATERIAL.bar,
          }}
        >
          <Icon name="xmark" size={17} strokeWidth={2.2} />
        </button>
      </div>
    </Portal>
  );
}
