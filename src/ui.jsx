// Z5 :: shared UI primitives
//
// One place for every reusable surface, control and layout piece. Screens
// compose these and should rarely need bespoke inline chrome. The rules
// the primitives encode (see also theme.js / motion.js):
//   • Response   — every tappable element carries `data-press` so it
//                  reacts on pointer-down ("scale" for buttons/cards,
//                  "row" for list rows). Styles for that live in index.html.
//   • Depth      — Panel is the only bordered card. Inside it use flat
//                  Rows with hairline separators and borderless Tiles.
//   • Materials  — floating chrome (bars, sheets, menus) is translucent
//                  and marked `data-material`.
//   • Direction  — logical properties only; directional icons use `flip`.
//   • Motion     — springs via MOTION.* (CSS) or animateSpring (gestures);
//                  transform/opacity only.
import {
  Children, createContext, useCallback, useContext, useEffect, useLayoutEffect,
  useMemo, useRef, useState,
} from "react";
import { C, S, FONT, FONT_MONO, MATERIAL, NUM, R, T, Z } from "./theme";
import { useIsMobile } from "./useIsMobile";
import { useTheme } from "./ThemeContext";
import { useI18n } from "./i18n";
import { MOTION, DURATION } from "./motion";
import { Icon } from "./icons";
import { Modal } from "./overlays";

export { Modal, Menu, Lightbox } from "./overlays";
export { Icon } from "./icons";

// ── Layout constants ────────────────────────────────────────────────
export const SIDEBAR_WIDTH = 248;
export const CONTENT_MAX_WIDTH = 1080;
// Mobile floating tab bar geometry.
const TABBAR_HEIGHT = 62;
const TABBAR_BOTTOM = "max(10px, calc(var(--safe-bottom) - 6px))";
// `bottom` for anything that must float just above the mobile tab bar
// (bulk-action bars, toasts).
export const ABOVE_TABBAR = `calc(${TABBAR_HEIGHT + 20}px + var(--safe-bottom))`;

// Single-line truncation, spread into a style.
export const ELLIPSIS = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

// One line of user-entered text (a name, a title) that truncates at its
// *own* end whatever language it is written in. Without this, an English
// title in the Hebrew UI (or the reverse) loses its beginning instead of
// its end. The outer flex keeps it aligned to the UI's start edge.
export function Truncate({ children, style }) {
  return (
    <span style={{ display: "flex", minWidth: 0 }}>
      <span dir="auto" style={{ minWidth: 0, ...ELLIPSIS, ...style }}>{children}</span>
    </span>
  );
}

// ── Page scaffolding ────────────────────────────────────────────────

// Full-viewport page wrapper.
export function Page({ children }) {
  useTheme(); // subscribe to theme changes
  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      color: C.text,
      fontFamily: FONT,
      ...T.body,
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
    }}>
      {children}
    </div>
  );
}

// Centered narrow column (auth screen, fallback states).
export function CenteredColumn({ children, maxWidth = 460 }) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: isMobile ? "flex-start" : "center",
      justifyContent: "center",
      boxSizing: "border-box",
      padding: isMobile
        ? "calc(28px + var(--safe-top)) 16px calc(24px + var(--safe-bottom))"
        : "40px 24px",
    }}>
      <div style={{ width: "100%", maxWidth }}>{children}</div>
    </div>
  );
}

// Navigation chrome shared between the shell and PageHeader: the mobile
// top bar shows the console brand until the page's large title scrolls
// underneath it, then cross-fades to that title (and gains a hairline).
const NavChromeCtx = createContext(null);
export function useNavChrome() {
  return useContext(NavChromeCtx);
}

/**
 * App shell.
 *  - Desktop: sidebar + scrollable main column (content capped and centered).
 *  - Mobile:  translucent top bar + main + floating translucent tab bar
 *             whose selection indicator slides between tabs on a spring.
 *
 * tabs: [{ key, label, icon }] — rendered in the mobile tab bar.
 */
export function AppShell({ sidebar, mobileTopBar, tabs, activeTab, onSelectTab, mobileTabBar, children }) {
  const isMobile = useIsMobile();
  const { isRTL } = useI18n();
  useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [navTitle, setNavTitle] = useState(null);
  const [titleHidden, setTitleHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const chrome = useMemo(
    () => ({ scrolled, navTitle, setNavTitle, titleHidden, setTitleHidden }),
    [scrolled, navTitle, titleHidden],
  );

  const count = tabs ? tabs.length : 0;
  const activeIndex = tabs ? Math.max(0, tabs.findIndex((tab) => tab.key === activeTab)) : 0;

  // One tree for both layouts: <main> keeps the same position and key on
  // phone and desktop, so crossing the breakpoint (rotating a tablet,
  // resizing a window) re-styles the chrome without remounting the active
  // screen and losing its state.
  return (
    <NavChromeCtx.Provider value={chrome}>
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        minHeight: "100vh",
        background: C.bg,
      }}>
        {isMobile ? (
          mobileTopBar ? (
            <header
              key="chrome"
              data-material=""
              style={{
                position: "sticky",
                top: 0,
                zIndex: Z.header,
                background: C.mobileHeaderBg,
                ...MATERIAL.bar,
                // Scroll edge: the hairline appears only once content is
                // actually underneath the bar.
                borderBottom: `1px solid ${scrolled ? C.separator : "transparent"}`,
                transition: `border-color ${MOTION.fade}`,
                paddingTop: "var(--safe-top)",
              }}
            >
              <div style={{
                height: 50,
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
                boxSizing: "border-box",
              }}>
                {mobileTopBar}
              </div>
            </header>
          ) : null
        ) : (
          <aside key="chrome" style={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            borderInlineEnd: `1px solid ${C.separator}`,
            padding: "22px 12px 16px",
            background: C.sidebarBg,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
            boxSizing: "border-box",
          }}>
            {sidebar}
          </aside>
        )}

        <main key="main" style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          // Screen transitions slide content a few pixels sideways; clip
          // so that never makes the page scroll horizontally.
          overflowX: "clip",
          ...(isMobile ? { width: "100%" } : null),
        }}>
          <div key="content" style={isMobile ? {
            flex: 1,
            padding: `8px 16px calc(${TABBAR_HEIGHT + 34}px + var(--safe-bottom))`,
            width: "100%",
            boxSizing: "border-box",
            minWidth: 0,
          } : {
            flex: 1,
            padding: "36px 40px 56px",
            maxWidth: CONTENT_MAX_WIDTH,
            width: "100%",
            marginInline: "auto",
            boxSizing: "border-box",
          }}>
            {children}
          </div>
        </main>

        {isMobile && (tabs || mobileTabBar) && (
          <nav
            key="tabbar"
            data-material=""
            style={{
              position: "fixed",
              insetInline: 12,
              bottom: TABBAR_BOTTOM,
              height: TABBAR_HEIGHT,
              padding: 4,
              boxSizing: "border-box",
              borderRadius: TABBAR_HEIGHT / 2,
              background: C.mobileTabBg,
              ...MATERIAL.thick,
              border: `1px solid ${C.materialBorder}`,
              boxShadow: C.shadowMd,
              display: "flex",
              zIndex: Z.tabbar,
            }}
          >
            {tabs && count > 0 && (
              <div aria-hidden style={{
                position: "absolute",
                top: 4,
                bottom: 4,
                insetInlineStart: 4,
                width: `calc((100% - 8px) / ${count})`,
                borderRadius: (TABBAR_HEIGHT - 8) / 2,
                background: C.fill,
                transform: `translateX(${activeIndex * 100 * (isRTL ? -1 : 1)}%)`,
                transition: `transform ${MOTION.move}`,
                willChange: "transform",
              }} />
            )}
            {tabs
              ? tabs.map((tab) => (
                  <TabItem
                    key={tab.key}
                    active={tab.key === activeTab}
                    onClick={() => onSelectTab && onSelectTab(tab.key)}
                    icon={tab.icon}
                    label={tab.label}
                  />
                ))
              : mobileTabBar}
          </nav>
        )}
      </div>
    </NavChromeCtx.Provider>
  );
}

// Mobile top bar content: leading slot, a center that cross-fades from
// the brand to the current page title once the large title has scrolled
// under the bar, and a trailing slot.
export function MobileNavBar({ leading, brand, trailing }) {
  const chrome = useNavChrome();
  const showTitle = !!(chrome && chrome.titleHidden && chrome.navTitle);
  const layer = (visible) => ({
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : "translateY(4px)",
    transition: `opacity ${MOTION.fade}, transform ${MOTION.snap}`,
    pointerEvents: visible ? "auto" : "none",
    minWidth: 0,
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minWidth: 0 }}>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{leading}</div>
      <div style={{ position: "relative", flex: 1, minWidth: 0, height: 40 }}>
        <div style={layer(!showTitle)} aria-hidden={showTitle}>{brand}</div>
        <div style={layer(showTitle)} aria-hidden={!showTitle}>
          <span style={{ ...T.headline, color: C.bright, ...ELLIPSIS, maxWidth: "100%" }}>
            {chrome ? chrome.navTitle : null}
          </span>
        </div>
      </div>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{trailing}</div>
    </div>
  );
}

// Sidebar nav link (desktop): icon + label. The active row gets a fill;
// hover/press feedback comes from data-press="row".
export function NavItem({ active, onClick, icon, children }) {
  return (
    <button
      type="button"
      data-press="row"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      style={{
        all: "unset",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        minHeight: 36,
        padding: "7px 12px",
        borderRadius: R.sm,
        cursor: "pointer",
        fontFamily: FONT,
        ...T.callout,
        fontWeight: active ? 600 : 500,
        color: active ? C.bright : C.text,
        ...(active ? { background: C.navActiveBg } : null),
      }}
    >
      {icon && (
        <span style={{ display: "flex", opacity: active ? 1 : 0.7 }}>{icon}</span>
      )}
      <span style={{ flex: 1, minWidth: 0, ...ELLIPSIS }}>{children}</span>
    </button>
  );
}

// Bottom tab bar item (mobile). The selection pill is drawn once by
// AppShell and slides between items; the item itself only tints.
export function TabItem({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      data-press="scale"
      data-press-depth="deep"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      style={{
        all: "unset",
        boxSizing: "border-box",
        position: "relative",
        flex: 1,
        minWidth: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        padding: "0 2px",
        cursor: "pointer",
        fontFamily: FONT,
        fontSize: 10,
        lineHeight: 1.2,
        fontWeight: active ? 600 : 500,
        letterSpacing: "0.01em",
        color: active ? C.bright : C.dim,
        transition: `color ${MOTION.fade}, transform ${MOTION.move}`,
      }}
    >
      <span aria-hidden style={{ display: "flex" }}>{icon}</span>
      <span style={{ ...ELLIPSIS, maxWidth: "100%" }}>{label}</span>
    </button>
  );
}

// Sidebar section label — quiet sentence-case caption.
export function NavLabel({ children }) {
  return (
    <div style={{
      padding: "18px 12px 6px",
      color: C.dimmer,
      ...T.caption,
      fontWeight: 600,
    }}>
      {children}
    </div>
  );
}

// ── Page header ─────────────────────────────────────────────────────
// Large title set directly on the page background (no card). On mobile
// the top bar takes over the title once this scrolls out of view.
//   back:   { onClick, label? } — renders a back control above the title.
//   action: trailing control(s).
export function PageHeader({ title, subtitle, action, back }) {
  const isMobile = useIsMobile();
  const chrome = useNavChrome();
  const titleRef = useRef(null);
  // Hand the title to the nav bar and report when it scrolls under it.
  const setNavTitle = chrome ? chrome.setNavTitle : null;
  const setTitleHidden = chrome ? chrome.setTitleHidden : null;
  const titleText = typeof title === "string" ? title : null;
  useEffect(() => {
    if (!setNavTitle) return;
    setNavTitle(titleText);
    // Clear only our own title: another header may have taken over.
    return () => { setNavTitle((cur) => (cur === titleText ? null : cur)); };
  }, [titleText, setNavTitle]);
  useEffect(() => {
    if (!setTitleHidden) return;
    const el = titleRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setTitleHidden(!entry.isIntersecting),
      { rootMargin: "-56px 0px 0px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => { io.disconnect(); setTitleHidden(false); };
  }, [setTitleHidden]);

  return (
    <div style={{ marginBottom: isMobile ? 4 : 8 }}>
      {back && (
        <div style={{ marginBottom: isMobile ? 6 : 10 }}>
          <BackButton onClick={back.onClick} label={back.label} />
        </div>
      )}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: isMobile ? 10 : 16,
        padding: isMobile ? "4px 2px 6px" : "0 2px 8px",
      }}>
        {/* The title never breaks mid-word; when it and the action
            can't share a line the action wraps underneath instead. */}
        <div style={{ flex: "1 1 0%", minWidth: "min-content" }}>
          <h1 ref={titleRef} style={{
            margin: 0,
            ...(isMobile ? T.title1 : T.largeTitle),
            color: C.bright,
            overflowWrap: "break-word",
          }}>{title}</h1>
          {subtitle && (
            <div style={{
              color: C.dim,
              ...(isMobile ? T.callout : T.body),
              marginTop: 3,
            }}>
              {subtitle}
            </div>
          )}
        </div>
        {action && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>{action}</div>}
      </div>
    </div>
  );
}

// Heading that sits between cards (outside any Panel).
export function SectionHeader({ title, subtitle, action }) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 12,
      margin: isMobile ? "26px 4px 10px" : "34px 4px 12px",
    }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ margin: 0, ...(isMobile ? T.title3 : T.title2), color: C.bright }}>{title}</h2>
        {subtitle && <div style={{ ...T.footnote, color: C.dim, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action && <div style={{ flexShrink: 0, display: "flex", gap: 8 }}>{action}</div>}
    </div>
  );
}

// ── Surfaces ────────────────────────────────────────────────────────

// Panel — the app's card. The only bordered surface level: content
// inside is flat Rows (hairline separators) or borderless Tiles.
//   title/action — headline row inside the card.
//   flush        — no inner padding (for full-bleed media or tables).
// `connectTop` is accepted as a no-op for backward-compat.
export function Panel({ title, children, action, flush, style }) {
  const isMobile = useIsMobile();
  const base = {
    ...S.panel,
    padding: flush ? 0 : (isMobile ? "16px 16px" : S.panel.padding),
    marginTop: isMobile ? 12 : 16,
    marginBottom: isMobile ? 12 : 16,
    borderRadius: isMobile ? R.lg : R.xl,
    // clip, not hidden: hidden would turn the card into a scroll container
    // and break scrollIntoView / sticky inside it.
    ...(flush ? { overflow: "clip" } : null),
    ...style,
  };
  return (
    <section style={base}>
      {(title || action) && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: isMobile ? 10 : 12,
          ...(flush ? { padding: isMobile ? "16px 16px 0" : "20px 22px 0" } : null),
        }}>
          <h2 style={{ ...S.panelTitle, margin: 0, minWidth: 0, fontSize: isMobile ? 16 : 17 }}>{title}</h2>
          {action && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// Borderless inner tile (a fill, never a second border level).
export function Tile({ children, style, padding, onClick, ...rest }) {
  const interactive = !!onClick;
  const Tag = interactive ? "button" : "div";
  return (
    <Tag
      {...(interactive ? { type: "button", "data-press": "scale", "data-press-depth": "soft", onClick } : null)}
      {...rest}
      style={{
        ...(interactive ? { all: "unset", cursor: "pointer", display: "block" } : null),
        boxSizing: "border-box",
        background: C.cardBg,
        borderRadius: R.md,
        padding: padding != null ? padding : "12px 14px",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

// Rounded square holding an icon — the leading mark of a list row.
export function IconTile({ icon, size = 38, dim, style }) {
  return (
    <div aria-hidden style={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: R.sm,
      background: C.fill,
      color: dim ? C.dim : C.bright,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...style,
    }}>
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </div>
  );
}

export function Divider({ inset = 0, style }) {
  return (
    <div aria-hidden style={{
      height: 1,
      background: C.separator,
      marginInlineStart: inset,
      flexShrink: 0,
      ...style,
    }} />
  );
}

// ── Lists ───────────────────────────────────────────────────────────

// Vertical list that draws a hairline *between* its children (never
// after the last one). Children are usually <Row>s.
export function List({ children, inset = 0, style }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <div style={style}>
      {items.map((child, i) => (
        <div key={child.key != null ? child.key : i}>
          {i > 0 && <Divider inset={inset} />}
          {child}
        </div>
      ))}
    </div>
  );
}

// List row. With onClick it is tappable: highlights on pointer-down and
// can show a trailing chevron for navigation.
//   leading / trailing — nodes at either end.
//   title / subtitle   — standard two-line content; or pass children.
//   as="div"           — use when the row contains its own buttons
//                        (a <button> can't nest interactive content).
export function Row({
  onClick, leading, title, subtitle, trailing, chevron, selected, disabled,
  children, as, align = "center", wrap = false, style, ...rest
}) {
  const isMobile = useIsMobile();
  const interactive = !!onClick && !disabled;
  const Tag = as || (onClick ? "button" : "div");
  const asDivButton = Tag === "div" && interactive;
  const onKeyDown = asDivButton
    ? (e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); }
      }
    : undefined;
  return (
    <Tag
      {...(Tag === "button" ? { type: "button", disabled } : null)}
      {...(asDivButton ? { role: "button", tabIndex: 0, onKeyDown } : null)}
      {...(Tag === "div" && onClick && disabled ? { role: "button", "aria-disabled": true } : null)}
      {...(interactive ? { "data-press": "row" } : null)}
      onClick={disabled ? undefined : onClick}
      {...rest}
      style={{
        ...(Tag === "button" ? { all: "unset" } : null),
        boxSizing: "border-box",
        display: "flex",
        alignItems: align,
        gap: 12,
        width: "calc(100% + 20px)",
        marginInline: -10,
        padding: "10px 10px",
        minHeight: isMobile ? 50 : 46,
        borderRadius: R.sm,
        cursor: interactive ? "pointer" : "default",
        fontFamily: FONT,
        color: C.text,
        textAlign: "start",
        ...(selected ? { background: C.selectedBg } : null),
        ...style,
      }}
    >
      {leading != null && <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{leading}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title != null && (
          <div style={{ ...T.body, fontWeight: 600, color: C.bright, ...(wrap ? { overflowWrap: "anywhere" } : null) }}>
            {wrap ? title : <Truncate>{title}</Truncate>}
          </div>
        )}
        {subtitle != null && (
          <div style={{ ...T.footnote, color: C.dim, marginTop: 1, ...(wrap ? { overflowWrap: "anywhere" } : null) }}>
            {wrap ? subtitle : <Truncate>{subtitle}</Truncate>}
          </div>
        )}
        {children}
      </div>
      {trailing != null && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>{trailing}</div>}
      {chevron && (
        <Icon name="chevronForward" size={15} strokeWidth={2.2} flip style={{ color: C.dimmer }} />
      )}
    </Tag>
  );
}

// Collapsible group: a tappable header row with a chevron that turns to
// point at the content it reveals. Content rises in when opened.
// Controlled (open + onToggle) or uncontrolled (defaultOpen).
export function Disclosure({
  title, subtitle, icon, trailing, count, countTone, open: openProp, defaultOpen = false,
  onToggle, children, tile = false, style,
}) {
  const { isRTL } = useI18n();
  const [inner, setInner] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : inner;
  const toggle = () => {
    if (!controlled) setInner((v) => !v);
    onToggle && onToggle(!open);
  };
  // Closed: points along the reading direction. Open: points down.
  const closedAngle = isRTL ? 180 : 0;
  return (
    <div style={{
      ...(tile ? { background: C.cardBg, borderRadius: R.md, padding: "2px 12px" } : null),
      ...style,
    }}>
      <button
        type="button"
        data-press="row"
        aria-expanded={open}
        onClick={toggle}
        style={{
          all: "unset",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "calc(100% + 20px)",
          marginInline: -10,
          padding: "10px 10px",
          minHeight: 46,
          borderRadius: R.sm,
          cursor: "pointer",
          fontFamily: FONT,
        }}
      >
        <Icon
          name="chevronForward"
          size={14}
          strokeWidth={2.4}
          style={{
            color: C.dimmer,
            transform: `rotate(${open ? 90 : closedAngle}deg)`,
            transition: `transform ${MOTION.snap}`,
          }}
        />
        {icon && <span style={{ display: "flex", color: C.dim }}>{icon}</span>}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", ...T.body, fontWeight: 600, color: C.bright, ...ELLIPSIS }}>{title}</span>
          {subtitle && <span style={{ display: "block", ...T.footnote, color: C.dim, ...ELLIPSIS }}>{subtitle}</span>}
        </span>
        {count != null && <Badge tone={countTone}>{count}</Badge>}
        {trailing}
      </button>
      {open && (
        <div style={{
          paddingBottom: tile ? 10 : 4,
          animation: `z5-rise ${DURATION.move}ms var(--z5-spring) backwards`,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────

export function Field({ label, children, inline, hint }) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      display: inline && !isMobile ? "inline-block" : "block",
      marginInlineEnd: inline && !isMobile ? 16 : 0,
      marginBottom: 14,
      minWidth: inline && !isMobile ? 240 : "auto",
      width: isMobile ? "100%" : "auto",
      verticalAlign: "top",
    }}>
      {label && <div style={S.label}>{label}</div>}
      {children}
      {hint && <div style={{ ...T.caption, color: C.dim, marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

// Button.
//   (default) gray fill · primary = filled ink · danger = tinted red ·
//   plain = text only · active = selected state (chips / toggles) ·
//   small = compact capsule · icon / iconEnd = icon names · busy = spinner.
export function Btn({
  active, primary, small, compact, fullWidth, danger, plain, icon, iconEnd,
  iconFlip, busy, style, children, ...rest
}) {
  const isMobile = useIsMobile();
  let s = {
    ...S.btn,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: small ? 5 : 7,
    textAlign: "center",
    userSelect: "none",
    WebkitUserSelect: "none",
  };
  if (plain) s = { ...s, ...S.btnPlain };
  if (danger) s = { ...s, ...S.btnDanger };
  if (primary) s = { ...s, ...S.btnPrimary };
  if (active) s = { ...s, ...S.btnActive };
  if (small) s = { ...s, ...S.btnSmall };
  if (isMobile && !small && !compact) {
    s = { ...s, minHeight: 46, padding: primary ? "12px 20px" : "11px 16px", fontSize: 16 };
  }
  if (isMobile && small) {
    s = { ...s, minHeight: 34, padding: "6px 14px", fontSize: 14 };
  }
  if (fullWidth) s = { ...s, width: "100%" };
  if (rest.disabled) s = { ...s, cursor: "default" };
  if (style) s = { ...s, ...style };
  const iconSize = small ? 14 : 16;
  return (
    <button data-press="scale" {...rest} style={s}>
      {busy
        ? <Spinner size={iconSize} />
        : (icon && <Icon name={icon} size={iconSize} strokeWidth={2} flip={iconFlip} />)}
      {children}
      {iconEnd && <Icon name={iconEnd} size={iconSize} strokeWidth={2} flip={iconFlip} />}
    </button>
  );
}

// Round icon-only button. Always give it a label (used as aria-label).
// On phones the tappable area is at least 44px even when the visible
// circle is smaller (the extra area is transparent and overlaps the
// surrounding gap, so layout doesn't change).
export function IconButton({ icon, label, size = 32, active, danger, quiet, flip, style, ...rest }) {
  const isMobile = useIsMobile();
  const hit = isMobile ? Math.max(size, 44) : size;
  const pad = (hit - size) / 2;
  // Paint overrides (background / color) belong to the visible circle;
  // everything else in `style` positions the button itself.
  const { background, color, ...outerStyle } = style || {};
  return (
    <button
      type="button"
      data-press="scale"
      data-press-depth="deep"
      aria-label={label}
      title={label}
      {...rest}
      style={{
        all: "unset",
        boxSizing: "border-box",
        width: hit,
        height: hit,
        margin: -pad,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: rest.disabled ? "default" : "pointer",
        borderRadius: R.pill,
        ...outerStyle,
      }}
    >
      <span aria-hidden style={{
        width: size,
        height: size,
        borderRadius: R.pill,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: background !== undefined
          ? background
          : (active ? C.tint : (danger ? C.errBg : (quiet ? "transparent" : C.fill))),
        color: color !== undefined
          ? color
          : (active ? C.onTint : (danger ? C.error : (quiet ? C.dim : C.bright))),
      }}>
        <Icon name={icon} size={Math.round(size * 0.5)} strokeWidth={2} flip={flip} />
      </span>
    </button>
  );
}

export function Input({ mono, ...props }) {
  const isMobile = useIsMobile();
  const base = { ...S.input, ...(mono ? S.inputMono : {}) };
  if (isMobile) {
    base.fontSize = 16;
    base.padding = "11px 14px";
    base.minHeight = 46;
  }
  // datetime-local inputs on iOS render with a native widget that has
  // an intrinsic min-width and ignores the input's CSS width, so they
  // overflow narrow containers. Pin width and reset the native
  // appearance so the widget conforms to its parent. The picker UI
  // still opens on focus — only the layout is constrained.
  if (props.type === "datetime-local" || props.type === "date" || props.type === "time") {
    base.maxWidth = "100%";
    base.minWidth = 0;
    base.WebkitAppearance = "none";
    base.MozAppearance = "none";
    base.appearance = "none";
  }
  return <input data-field="" {...props} style={{ ...base, ...(props.style || {}) }} />;
}

export function Textarea(props) {
  const isMobile = useIsMobile();
  const base = { ...S.input, height: 120, resize: "vertical", lineHeight: 1.5 };
  if (isMobile) {
    base.fontSize = 16;
    base.padding = "11px 14px";
  }
  return <textarea data-field="" {...props} style={{ ...base, ...(props.style || {}) }} />;
}

// Native <select> in the field style with a consistent chevron. The
// platform picker is kept on purpose — it is the most familiar control,
// especially on phones.
//   small — compact inline variant for tables / toolbars.
export function Select({ small, children, style, wrapStyle, ...props }) {
  const isMobile = useIsMobile();
  const base = {
    ...S.input,
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    paddingInlineEnd: 34,
    cursor: props.disabled ? "default" : "pointer",
    textOverflow: "ellipsis",
  };
  if (small) {
    base.minHeight = isMobile ? 38 : 32;
    base.padding = isMobile ? "6px 12px" : "4px 10px";
    base.paddingInlineEnd = 30;
    base.fontSize = 13;
    base.borderRadius = R.sm;
  } else if (isMobile) {
    base.fontSize = 16;
    base.padding = "11px 14px";
    base.paddingInlineEnd = 36;
    base.minHeight = 46;
  }
  return (
    <span style={{ position: "relative", display: "inline-flex", width: small ? "auto" : "100%", maxWidth: "100%", ...wrapStyle }}>
      <select data-field="" {...props} style={{ ...base, ...style }}>{children}</select>
      <Icon
        name="chevronUpDown"
        size={small ? 14 : 16}
        strokeWidth={2}
        style={{
          position: "absolute",
          insetInlineEnd: small ? 9 : 11,
          top: "50%",
          marginTop: small ? -7 : -8,
          color: C.dim,
          pointerEvents: "none",
        }}
      />
    </span>
  );
}

// Segmented control — pick one of a few peers. The thumb slides to the
// selection on a spring (and from wherever it currently is if retargeted
// mid-flight).
//   options: [{ value, label, icon?, disabled? }]
export function Segmented({ options, value, onChange, size = "md", fullWidth, ariaLabel }) {
  const wrapRef = useRef(null);
  const btnRefs = useRef({});
  const [thumb, setThumb] = useState(null);
  const settled = useRef(false);
  useTheme();

  const measure = useCallback(() => {
    const el = btnRefs.current[value];
    if (!el) { setThumb(null); return; }
    setThumb((prev) => {
      const next = { x: el.offsetLeft, w: el.offsetWidth };
      return prev && prev.x === next.x && prev.w === next.w ? prev : next;
    });
  }, [value]);

  const labelsKey = options.map((o) => `${o.value}:${typeof o.label === "string" ? o.label : ""}`).join("|");
  useLayoutEffect(() => { measure(); }, [measure, labelsKey]);
  useEffect(() => {
    // Let the first position land without sliding in from the corner.
    const id = requestAnimationFrame(() => { settled.current = true; });
    const el = wrapRef.current;
    let ro;
    if (el && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }
    return () => { cancelAnimationFrame(id); if (ro) ro.disconnect(); };
  }, [measure]);

  const h = size === "sm" ? 30 : 36;
  return (
    <div
      ref={wrapRef}
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        position: "relative",
        display: fullWidth ? "flex" : "inline-flex",
        width: fullWidth ? "100%" : "auto",
        maxWidth: "100%",
        boxSizing: "border-box",
        padding: 3,
        gap: 0,
        borderRadius: R.sm + 1,
        background: C.fill,
      }}
    >
      {thumb && (
        <div aria-hidden style={{
          position: "absolute",
          top: 3,
          bottom: 3,
          left: 0, // physical on purpose: positioned from measured offsetLeft
          width: thumb.w,
          borderRadius: R.sm - 2,
          background: C.thumb,
          boxShadow: C.shadowSm,
          transform: `translateX(${thumb.x}px)`,
          transition: settled.current ? `transform ${MOTION.move}, width ${MOTION.move}` : "none",
          willChange: "transform",
        }} />
      )}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => { btnRefs.current[o.value] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            data-press="scale"
            data-press-depth="soft"
            disabled={o.disabled}
            onClick={() => { if (!on) onChange && onChange(o.value); }}
            style={{
              all: "unset",
              boxSizing: "border-box",
              position: "relative",
              flex: fullWidth ? 1 : "0 1 auto",
              minWidth: 0,
              height: h,
              padding: size === "sm" ? "0 12px" : "0 16px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              cursor: o.disabled ? "default" : "pointer",
              fontFamily: FONT,
              fontSize: size === "sm" ? 13 : 14,
              fontWeight: on ? 600 : 500,
              letterSpacing: "-0.003em",
              color: on ? C.bright : C.dim,
              whiteSpace: "nowrap",
              transition: `color ${MOTION.fade}`,
            }}
          >
            {o.icon && <Icon name={o.icon} size={size === "sm" ? 14 : 15} strokeWidth={2} />}
            <span style={{ ...ELLIPSIS }}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Filter chip — a capsule toggle, optionally with a count.
export function Chip({ active, onClick, count, icon, children, disabled, style }) {
  const isMobile = useIsMobile();
  return (
    <button
      type="button"
      data-press="scale"
      aria-pressed={!!active}
      disabled={disabled}
      onClick={onClick}
      style={{
        all: "unset",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
        minHeight: isMobile ? 34 : 30,
        padding: isMobile ? "0 14px" : "0 12px",
        borderRadius: R.pill,
        cursor: disabled ? "default" : "pointer",
        fontFamily: FONT,
        fontSize: isMobile ? 14 : 13,
        fontWeight: 600,
        letterSpacing: "-0.003em",
        whiteSpace: "nowrap",
        background: active ? C.tint : C.fill,
        color: active ? C.onTint : C.bright,
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={14} strokeWidth={2} />}
      <span>{children}</span>
      {count != null && (
        <span style={{ ...NUM, fontWeight: 500, opacity: 0.6 }}>{count}</span>
      )}
    </button>
  );
}

// A labelled strip of chips: wraps on desktop; on phones it scrolls
// sideways edge-to-edge with a soft fade where content continues.
export function ChipRow({ label, children, style }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ minWidth: 0, ...style }}>
      {label && <div style={S.label}>{label}</div>}
      <div
        data-noscrollbar=""
        style={isMobile ? {
          display: "flex",
          gap: 8,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          marginInline: -16,
          paddingInline: 16,
          paddingBlock: 2,
          scrollPaddingInline: 16,
          WebkitMaskImage: "linear-gradient(to right, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)",
          maskImage: "linear-gradient(to right, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)",
        } : {
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// iOS-style switch. The knob travels on a spring.
export function Switch({ checked, onChange, label, disabled }) {
  const { isRTL } = useI18n();
  const travel = 18 * (isRTL ? -1 : 1);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={typeof label === "string" ? label : undefined}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange && onChange(!checked); }}
      style={{
        all: "unset",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        minHeight: 32,
        cursor: disabled ? "default" : "pointer",
        fontFamily: FONT,
      }}
    >
      <span aria-hidden style={{
        position: "relative",
        width: 46,
        height: 28,
        flexShrink: 0,
        borderRadius: R.pill,
        background: checked ? C.ok : C.fillStrong,
        transition: `background-color ${MOTION.fade}`,
      }}>
        <span style={{
          position: "absolute",
          top: 2,
          insetInlineStart: 2,
          width: 24,
          height: 24,
          borderRadius: R.pill,
          background: C.knob,
          boxShadow: C.shadowSm,
          transform: `translateX(${checked ? travel : 0}px)`,
          transition: `transform ${MOTION.bounce}`,
        }} />
      </span>
      {label && <span style={{ ...T.callout, color: C.text }}>{label}</span>}
    </button>
  );
}

// Quantity stepper: − value +.
export function Stepper({ value, onChange, min = 0, max = Infinity, decLabel = "−", incLabel = "+" }) {
  const isMobile = useIsMobile();
  const v = Number(value) || 0;
  const btn = (disabled) => ({
    all: "unset",
    boxSizing: "border-box",
    width: isMobile ? 46 : 36,
    height: isMobile ? 44 : 32,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "default" : "pointer",
    color: C.bright,
  });
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      background: C.fill,
      borderRadius: R.sm,
      fontFamily: FONT,
    }}>
      <button type="button" data-press="scale" data-press-depth="deep" aria-label={decLabel}
        disabled={v <= min} onClick={() => onChange && onChange(Math.max(min, v - 1))} style={btn(v <= min)}>
        <Icon name="minus" size={15} strokeWidth={2.2} />
      </button>
      <span style={{ ...NUM, minWidth: 30, textAlign: "center", fontSize: 15, fontWeight: 600, color: C.bright }}>{v}</span>
      <button type="button" data-press="scale" data-press-depth="deep" aria-label={incLabel}
        disabled={v >= max} onClick={() => onChange && onChange(Math.min(max, v + 1))} style={btn(v >= max)}>
        <Icon name="plus" size={15} strokeWidth={2.2} />
      </button>
    </div>
  );
}

// Checkbox — round check mark. With onChange it is an accessible toggle;
// without it it is a presentational mark (the parent row is the target).
//   tone="ok" tints the checked state green (task completion).
export function Checkbox({ checked, onChange, label, disabled, tone, size = 22 }) {
  const fill = tone === "ok" ? C.ok : C.tint;
  const mark = (
    <span aria-hidden style={{
      width: size,
      height: size,
      flexShrink: 0,
      boxSizing: "border-box",
      borderRadius: R.pill,
      border: `1.5px solid ${checked ? fill : C.borderBright}`,
      background: checked ? fill : "transparent",
      color: tone === "ok" ? C.bg : C.onTint,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: `background-color ${MOTION.quick}, border-color ${MOTION.quick}`,
    }}>
      {checked && (
        <Icon
          name="check"
          size={Math.round(size * 0.62)}
          strokeWidth={3}
          style={{ animation: `z5-pop ${DURATION.bounce}ms var(--z5-spring-bounce) both` }}
        />
      )}
    </span>
  );
  if (!onChange) return mark;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={!!checked}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      style={{
        all: "unset",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: label ? "flex-start" : "center",
        gap: 9,
        minWidth: 28,
        minHeight: 28,
        padding: 3,
        cursor: disabled ? "default" : "pointer",
        fontFamily: FONT,
      }}
    >
      {mark}
      {label && <span style={{ ...T.callout, color: C.text }}>{label}</span>}
    </button>
  );
}

// ── Text atoms ──────────────────────────────────────────────────────

// Codes only: callsigns, serials, invite codes, tokens.
export function Mono({ children, style }) {
  return <span style={{ ...S.mono, ...(style || {}) }}>{children}</span>;
}

// Numbers, dates and "n / m" expressions: tabular figures, isolated from
// the surrounding text direction. dir="auto" means a purely numeric
// expression ("11 / 12", "62%") always reads left-to-right — it never
// renders reversed inside Hebrew — while a date containing Hebrew words
// keeps its natural right-to-left order.
export function Num({ children, style }) {
  return (
    <span dir="auto" style={{ ...NUM, unicodeBidi: "isolate", ...(style || {}) }}>
      {children}
    </span>
  );
}

export function Badge({ children, tone = "default", style }) {
  const tones = {
    default: { bg: C.badgeDefault, fg: C.text },
    bright:  { bg: C.badgeBright,  fg: C.bright },
    ok:      { bg: C.badgeOk,      fg: C.ok },
    warn:    { bg: C.badgeWarn,    fg: C.warn },
    error:   { bg: C.badgeError,   fg: C.error },
    info:    { bg: C.scheduleBg,   fg: C.schedule },
  };
  const t = tones[tone] || tones.default;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "2px 9px",
      fontSize: 12,
      lineHeight: 1.5,
      fontWeight: 600,
      letterSpacing: "0",
      whiteSpace: "nowrap",
      background: t.bg,
      color: t.fg,
      borderRadius: R.pill,
      ...NUM,
      ...style,
    }}>{children}</span>
  );
}

// ── Feedback ────────────────────────────────────────────────────────

// Inline callout. Four kinds of feedback: status (default/info),
// completion (ok), warning (warn) and error (error).
export function Notice({ tone = "default", icon, title, children, action, style }) {
  const tones = {
    default: { bg: C.cardBg,    fg: C.text,     ic: "info" },
    info:    { bg: C.scheduleBg, fg: C.schedule, ic: "info" },
    ok:      { bg: C.okBg,      fg: C.ok,       ic: "checkCircle" },
    warn:    { bg: C.warnBg,    fg: C.warn,     ic: "warning" },
    error:   { bg: C.errBg,     fg: C.error,    ic: "xCircle" },
  };
  const t = tones[tone] || tones.default;
  const iconName = icon === false ? null : (icon || t.ic);
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: R.md,
        background: t.bg,
        color: t.fg,
        ...T.footnote,
        ...style,
      }}
    >
      {iconName && <Icon name={iconName} size={17} strokeWidth={2} style={{ marginTop: 1 }} />}
      <div style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
        {title && <div style={{ fontWeight: 600, marginBottom: children ? 2 : 0 }}>{title}</div>}
        {children}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

export function ErrLine({ children }) {
  if (!children) return null;
  return <Notice tone="error" style={{ marginTop: 12 }}>{children}</Notice>;
}

export function OkLine({ children }) {
  if (!children) return null;
  return <Notice tone="ok" style={{ marginTop: 12 }}>{children}</Notice>;
}

// Empty / zero-data state: says what belongs here and offers the next step.
export function EmptyState({ icon = "info", title, children, action, compact }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      gap: 6,
      padding: compact ? "14px 8px" : "30px 12px",
    }}>
      {icon && (
        <div aria-hidden style={{
          width: 44, height: 44, borderRadius: R.pill, background: C.fill, color: C.dim,
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4,
        }}>
          <Icon name={icon} size={22} />
        </div>
      )}
      {title && <div style={{ ...T.headline, color: C.bright }}>{title}</div>}
      {children && <div style={{ ...T.footnote, color: C.dim, maxWidth: 380 }}>{children}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function Spinner({ size = 16, style, label }) {
  const { t } = useI18n();
  return (
    <span
      role="status"
      data-spin=""
      aria-label={label || t("common.loading")}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        boxSizing: "border-box",
        display: "inline-block",
        borderRadius: "50%",
        border: `${Math.max(2, Math.round(size / 8))}px solid currentColor`,
        borderInlineEndColor: "transparent",
        opacity: 0.8,
        animation: "z5-spin 0.7s linear infinite",
        ...style,
      }}
    />
  );
}

// Progress bar (0–100). The fill moves by transform on a spring.
//   tone: "ink" (default) | "ok" | "warn" | "error" | "info" | "auto"
//   "auto" = ink while in progress, green when complete.
export function Progress({ value = 0, tone = "auto", height = 6, style, label }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const color = tone === "auto"
    ? (pct >= 100 ? C.ok : C.bright)
    : ({ ink: C.bright, ok: C.ok, warn: C.warn, error: C.error, info: C.schedule }[tone] || C.bright);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      style={{
        position: "relative",
        height,
        borderRadius: R.pill,
        background: C.progressTrack,
        overflow: "hidden",
        // Safari: clip the transformed child to the rounded track.
        isolation: "isolate",
        ...style,
      }}
    >
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: R.pill,
        background: color,
        transform: `translateX(calc(${pct - 100}% * var(--z5-dir, 1)))`,
        transition: `transform ${MOTION.move}, background-color ${MOTION.fade}`,
      }} />
    </div>
  );
}

// A number that matters, with a quiet label under it.
export function Stat({ value, label, tone, size = "md", align = "start", style }) {
  const sizes = { sm: T.title3, md: T.title1, lg: T.largeTitle };
  const color = { ok: C.ok, warn: C.warn, error: C.error, dim: C.dim, info: C.schedule }[tone] || C.bright;
  return (
    <div style={{ textAlign: align, minWidth: 0, ...style }}>
      <div style={{ ...(sizes[size] || sizes.md), color, lineHeight: 1.1 }}>
        <Num>{value}</Num>
      </div>
      {label && <div style={{ ...T.caption, color: C.dim, marginTop: 4 }}>{label}</div>}
    </div>
  );
}

// Skeleton shimmer — animated placeholder while content loads.
export function Skeleton({ width = "100%", height = 14, style }) {
  return (
    <div aria-hidden style={{
      width,
      height,
      borderRadius: 7,
      background: `linear-gradient(90deg, ${C.progressTrack} 25%, ${C.hoverBg} 50%, ${C.progressTrack} 75%)`,
      backgroundSize: "600px 100%",
      animation: "z5-shimmer 1.2s linear infinite",
      ...style,
    }} />
  );
}

// A stack of skeleton "rows" approximating a list while it loads.
export function SkeletonRows({ rows = 3 }) {
  return (
    <div aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          padding: "13px 0",
          borderBottom: i < rows - 1 ? `1px solid ${C.separator}` : "none",
        }}>
          <Skeleton width={`${52 - i * 7}%`} height={15} style={{ marginBottom: 8 }} />
          <Skeleton width={`${28 + i * 5}%`} height={11} />
        </div>
      ))}
    </div>
  );
}

// ── People ──────────────────────────────────────────────────────────

export function initialsOf(name) {
  const parts = String(name || "").trim().split(/[\s\-_]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Round avatar: photo, or initials on a neutral fill.
export function Avatar({ src, name, size = 40, onClick, style, children, ...rest }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const showImg = src && !failed;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button", "data-press": "scale", onClick, "aria-label": name } : null)}
      {...rest}
      style={{
        ...(onClick ? { all: "unset", cursor: "pointer" } : null),
        boxSizing: "border-box",
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: R.pill,
        overflow: "hidden",
        background: C.fill,
        color: C.dim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        fontWeight: 600,
        letterSpacing: "0.01em",
        ...style,
      }}
    >
      {showImg
        ? <img src={src} alt="" onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : <span aria-hidden>{initialsOf(name)}</span>}
      {children}
    </Tag>
  );
}

// ── Composite helpers ───────────────────────────────────────────────

// A value to copy (URL, token, invite code) with a copy button that
// confirms in place.
export function CopyField({ value, copyLabel, copiedLabel, failedLabel, mono = true, onCopied, onError, style }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef(0);
  const valueRef = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      setFailed(false);
      setCopied(true);
      onCopied && onCopied();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      // Clipboard unavailable (insecure context, permission denied):
      // say so, and select the text so it can be copied by hand.
      setCopied(false);
      setFailed(true);
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(valueRef.current);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch { /* ignore */ }
      onError && onError(e);
    }
  }
  return (
    <div style={{ minWidth: 0, ...style }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        paddingBlock: 6,
        paddingInline: "12px 6px",
        borderRadius: R.md,
        background: C.cardBg,
        minWidth: 0,
      }}>
        <span ref={valueRef} dir="ltr" style={{
          flex: 1,
          minWidth: 0,
          ...(mono ? S.mono : null),
          fontSize: 13,
          color: C.text,
          overflowWrap: "anywhere",
          userSelect: "all",
          textAlign: "start",
        }}>{value}</span>
        <Btn small type="button" onClick={copy} icon={copied ? "check" : "copy"} style={copied ? { color: C.ok } : undefined}>
          {copied ? copiedLabel : copyLabel}
        </Btn>
      </div>
      {failed && (
        <div role="alert" style={{ ...T.caption, color: C.warn, marginTop: 5 }}>
          {failedLabel || t("common.copy_failed")}
        </div>
      )}
    </div>
  );
}

// Label/value card (used for mobile table rows).
export function DataCard({ title, rows, action }) {
  return (
    <Tile style={{ marginBottom: 10 }}>
      {(title || action) && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
        }}>
          <div style={{ color: C.bright, ...T.body, fontWeight: 600, minWidth: 0 }}>{title}</div>
          {action}
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          padding: "5px 0",
          ...T.callout,
        }}>
          <div style={{ color: C.dim, flexShrink: 0 }}>{r.label}</div>
          <div style={{ color: C.text, textAlign: "end", minWidth: 0, ...ELLIPSIS }}>{r.value}</div>
        </div>
      ))}
    </Tile>
  );
}

export function Footer({ text }) {
  const { t } = useI18n();
  return (
    <div style={{
      color: C.dimmer,
      padding: "14px 40px",
      ...T.caption,
      marginTop: "auto",
      textAlign: "center",
    }}>
      {text || t("common.footer")}
    </div>
  );
}

// Back control for sub-views. The chevron follows the reading direction.
export function BackButton({ onClick, label, ...rest }) {
  const { t } = useI18n();
  return (
    <Btn small type="button" onClick={onClick} icon="chevronBack" iconFlip {...rest}
      style={{ paddingInlineStart: 9, ...(rest.style || {}) }}>
      {label || t("rec.back")}
    </Btn>
  );
}

// Animates a view change. Give it a key that changes with the view:
//   kind="tab"  — sibling views cross-fade with a small rise;
//   kind="push" — going deeper: enters from the trailing edge;
//   kind="pop"  — coming back: enters from the leading edge.
// Enter-only, so a new change simply replaces the one in flight.
export function ViewTransition({ viewKey, kind = "tab", children, style }) {
  const name = kind === "push" ? "z5-view-push" : kind === "pop" ? "z5-view-pop" : "z5-view-tab";
  return (
    <div
      key={viewKey}
      style={{
        // `backwards` only: once finished the element carries no transform,
        // so position:fixed descendants keep working.
        animation: `${name} ${DURATION.move}ms var(--z5-spring) backwards`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Dialogs ─────────────────────────────────────────────────────────

// Confirmation built on Modal (dialog on desktop, bottom sheet on
// phones). The confirm button is destructive-styled by default; pass
// danger={false} for benign confirmations.
export function ConfirmDialog({
  open, title, message, confirmLabel, cancelLabel,
  danger = true, busy = false, onConfirm, onCancel, dir,
}) {
  const isMobile = useIsMobile();
  return (
    <Modal open={open} onClose={busy ? undefined : onCancel} title={title} maxWidth={420} dir={dir}>
      {message && (
        <div style={{
          color: C.dim,
          ...T.callout,
          lineHeight: 1.55,
          marginBottom: 20,
          textAlign: isMobile ? "center" : "start",
        }}>
          {message}
        </div>
      )}
      <div style={isMobile
        ? { display: "flex", flexDirection: "column", gap: 8 }
        : { display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {isMobile ? (
          <>
            <Btn type="button" fullWidth onClick={onConfirm} disabled={busy} busy={busy}
              danger={danger} primary={!danger}>{confirmLabel}</Btn>
            <Btn type="button" fullWidth onClick={onCancel} disabled={busy}>{cancelLabel}</Btn>
          </>
        ) : (
          <>
            <Btn type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</Btn>
            <Btn type="button" onClick={onConfirm} disabled={busy} busy={busy}
              danger={danger} primary={!danger}>{confirmLabel}</Btn>
          </>
        )}
      </div>
    </Modal>
  );
}
