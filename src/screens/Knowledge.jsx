import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth";
import { useI18n, fmtWhen } from "../i18n";
import {
  Panel, PageHeader, Btn, IconButton, Input, Textarea, Select, Field, ErrLine, OkLine,
  Notice, Badge, Num, Row, List, Disclosure, Segmented, ConfirmDialog, EmptyState,
  SkeletonRows, ViewTransition, Icon, ELLIPSIS, IconTile,
} from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, T } from "../theme";
import { DURATION } from "../motion";
import {
  listMaterials, uploadMaterial,
  deleteMaterial, getMaterialUrl, subscribeKnowledge,
  SUBJECTS, SUBJECT_MAP, WEEKS,
} from "../data/knowledge";

function canUpload(role, canSquadEdit, profile) {
  return role === "admin" || role === "officer" || !!profile?.is_instructor || !!canSquadEdit;
}

// Folder icon per subject (names from the shared icon set).
const SUBJECT_ICONS = {
  wind:               "flag",
  shooting_technique: "target",
  physics:            "chart",
  gear:               "rifle",
  camouflage:         "eye",
  navigation:         "pin",
  communication:      "megaphone",
  general:            "book",
};

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp"];
const RISE = `z5-rise ${DURATION.move}ms var(--z5-spring) backwards`;

function extOf(fileName) {
  return (String(fileName || "").split(".").pop() || "").toLowerCase();
}

function fmtSize(bytes) {
  return bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(0)} KB`;
}

export default function Knowledge({ isBootcamp, canSquadEditKnowledge }) {
  const { profile } = useAuth();
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [viewingUrl, setViewingUrl] = useState(null);
  const [viewingTitle, setViewingTitle] = useState("");
  const [viewingFileName, setViewingFileName] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(false);
  // Which folders are open. Kept here (not in the folder lists) so they
  // stay open across realtime refreshes and a round trip to the viewer.
  const [openSubjects, setOpenSubjects] = useState(() => new Set());
  const [openWeeks, setOpenWeeks] = useState(() => new Set());
  // "none" until the first navigation between list and viewer, so the screen does
  // not replay a pop animation on top of the shell's tab transition.
  const [nav, setNav] = useState("none");
  const listScroll = useRef(0);

  const isAdmin = profile?.role === "admin" || profile?.role === "officer";
  const hasSquad = !!profile?.squad_id;

  // Admins pick which track to view; default to operational
  const [adminTrack, setAdminTrack] = useState("operational"); // 'operational' | 'bootcamp'

  // Effective track:
  //   admin: adminTrack
  //   non-admin with squad: their squad's track (from isBootcamp prop, passed from Shell)
  //   non-admin without squad: null (show empty state)
  const track = isAdmin
    ? adminTrack
    : (hasSquad ? (isBootcamp ? "bootcamp" : "operational") : null);

  const load = useCallback(async () => {
    if (track === null) { setMaterials([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await listMaterials({ isBootcamp: track === "bootcamp" });
    if (error) setErr(String(error.message || error));
    setMaterials(data || []);
    setLoading(false);
  }, [track]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = subscribeKnowledge(() => load());
    return unsub;
  }, [load]);

  const showUpload = canUpload(profile?.role, canSquadEditKnowledge, profile) && track !== null;

  function switchTrack(next) {
    if (next === adminTrack) return;
    // The other track's rows must not flash inside the new grouping.
    setMaterials([]);
    setLoading(true);
    setNotice("");
    setAdminTrack(next);
  }

  async function openViewer(m) {
    setErr("");
    const url = await getMaterialUrl(m.file_path);
    if (!url) { setErr(t("kn.open_failed")); return; }
    listScroll.current = typeof window !== "undefined" ? window.scrollY : 0;
    setNotice("");
    setNav("push");
    setViewingUrl(url);
    setViewingTitle(m.title || m.file_name);
    setViewingFileName(m.file_name || "");
  }

  function closeViewer() {
    setNav("pop");
    setViewingUrl(null);
    setViewingTitle("");
    setViewingFileName("");
  }

  // Opening a document starts at the top; coming back returns to where
  // the list was left.
  const viewing = !!viewingUrl;
  useLayoutEffect(() => {
    if (nav === "none" || typeof window === "undefined") return;
    window.scrollTo(0, viewing ? 0 : listScroll.current);
  }, [viewing]); // eslint-disable-line react-hooks/exhaustive-deps

  // First load only — realtime refreshes keep the list on screen.
  const firstLoad = loading && materials.length === 0;

  return (
    <ViewTransition
      viewKey={viewing ? "viewer" : "list"}
      kind={nav === "push" ? "push" : "pop"}
      style={nav === "none" ? { animation: "none" } : undefined}
    >
      {viewing ? (
        <DocumentViewer
          url={viewingUrl}
          title={viewingTitle}
          fileName={viewingFileName}
          isAdmin={isAdmin}
          onBack={closeViewer}
        />
      ) : (
        <>
          <PageHeader
            title={t("kn.title")}
            subtitle={isBootcamp ? t("kn.sub_bootcamp") : t("kn.sub_normal")}
            action={showUpload && (
              showUploadForm ? (
                <Btn small type="button" onClick={() => setShowUploadForm(false)}>
                  {t("common.cancel")}
                </Btn>
              ) : (
                <Btn small primary type="button" icon="plus"
                     onClick={() => { setNotice(""); setShowUploadForm(true); }}>
                  {t("kn.new_material")}
                </Btn>
              )
            )}
          />

          {isAdmin && (
            <div style={{ marginTop: 6 }}>
              <Segmented
                ariaLabel={t("kn.track")}
                fullWidth={isMobile}
                value={adminTrack}
                onChange={switchTrack}
                options={[
                  { value: "operational", label: t("kn.track_op"), icon: "target" },
                  { value: "bootcamp", label: t("kn.track_bc"), icon: "graduation" },
                ]}
              />
            </div>
          )}

          <ErrLine>{err}</ErrLine>
          <OkLine>{notice}</OkLine>

          {showUploadForm && (
            <Panel
              title={t("kn.upload_title")}
              action={(
                <>
                  <span style={{ ...T.footnote, color: C.dim }}>{t("kn.uploading_to")}</span>
                  <Badge tone="bright">
                    {track === "bootcamp" ? t("kn.track_bc") : t("kn.track_op")}
                  </Badge>
                </>
              )}
              style={{ animation: RISE }}
            >
              <UploadPanel
                track={track}
                onUploaded={(msg) => { load(); setShowUploadForm(false); setNotice(msg || ""); }}
              />
            </Panel>
          )}

          {track === null && !loading && (
            <Panel>
              <EmptyState icon="people" title={t("kn.nosquad_title")}>
                {t("kn.nosquad_body")}
              </EmptyState>
            </Panel>
          )}

          {firstLoad && (
            <Panel>
              <SkeletonRows rows={4} />
            </Panel>
          )}

          {!loading && track !== null && materials.length === 0 && !showUploadForm && (
            <Panel>
              <EmptyState icon="book" title={t("kn.empty")} />
            </Panel>
          )}

          {track !== null && materials.length > 0 && (
            track === "bootcamp"
              ? <WeeklyView materials={materials} profile={profile} canSquadEdit={canSquadEditKnowledge}
                            expanded={openWeeks} setExpanded={setOpenWeeks}
                            onView={openViewer} onDeleted={load} />
              : <SubjectView materials={materials} profile={profile} canSquadEdit={canSquadEditKnowledge}
                             expanded={openSubjects} setExpanded={setOpenSubjects}
                             onView={openViewer} onDeleted={load} />
          )}
        </>
      )}
    </ViewTransition>
  );
}

/* ── Document viewer ─────────────────────────────────────────────────
   The document fills whatever is left of the viewport under the header,
   so the only scrollbar is the document's own. The frame's offset is
   measured (title length, actions and the note all move it) instead of
   guessing the chrome height.                                          */
const VIEWPORT_H = typeof CSS !== "undefined" && CSS.supports && CSS.supports("height", "100dvh")
  ? "100dvh"
  : "100vh";

function DocumentViewer({ url, title, fileName, isAdmin, onBack }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const headRef = useRef(null);
  const frameRef = useRef(null);
  const [top, setTop] = useState(null);

  // Detect file type — use Google Docs Viewer for non-PDF files
  const ext = extOf(fileName);
  const isPdf = ext === "pdf";
  const isImage = IMAGE_EXTS.includes(ext);
  // Google Docs Viewer handles pptx, docx, xlsx etc.
  const embedUrl = isPdf || isImage
    ? url
    : `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;

  useLayoutEffect(() => {
    const measure = () => {
      let y = 0;
      for (let el = frameRef.current; el; el = el.offsetParent) y += el.offsetTop;
      setTop((prev) => (prev === y ? prev : y));
    };
    measure();
    window.addEventListener("resize", measure);
    let ro;
    if (headRef.current && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(headRef.current);
    }
    return () => {
      window.removeEventListener("resize", measure);
      if (ro) ro.disconnect();
    };
  }, []);

  // Space kept free under the frame: the shell's bottom padding (which
  // on phones clears the floating tab bar) plus the panel's own border.
  const below = isMobile ? 98 : 58;
  const height = top == null
    ? `calc(${VIEWPORT_H} - ${isMobile ? 290 : 250}px - var(--safe-bottom))`
    : `calc(${VIEWPORT_H} - ${top + below}px - var(--safe-bottom))`;

  return (
    <>
      <div ref={headRef}>
        <PageHeader
          hero={false}
          title={title}
          back={{ onClick: onBack, label: t("kn.back") }}
          action={isAdmin && (
            <>
              <Btn small type="button" icon="download" onClick={() => window.open(url, "_blank")}>
                {t("kn.download")}
              </Btn>
              {!isPdf && !isImage && (
                <Btn small type="button" icon="arrowUpRight" onClick={() => window.open(embedUrl, "_blank")}>
                  {t("kn.google_viewer")}
                </Btn>
              )}
            </>
          )}
        />
        {!isPdf && !isImage && (
          <Notice style={{ marginTop: 4 }}>{t("kn.google_note")}</Notice>
        )}
      </div>
      <Panel flush style={{ marginBottom: 0 }}>
        <div ref={frameRef} style={{
          width: "100%",
          height,
          minHeight: isMobile ? 320 : 360,
          background: C.inputBg,
        }}>
          {isImage ? (
            <img
              src={url}
              alt={title}
              style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <iframe
              src={embedUrl}
              title={title}
              style={{ display: "block", width: "100%", height: "100%", border: "none" }}
              allow="autoplay"
            />
          )}
        </div>
      </Panel>
    </>
  );
}

/* ── Folder list ─────────────────────────────────────────────────────
   One card; each folder is a Disclosure, its materials are flat rows.  */
function FolderPanel({ children }) {
  const isMobile = useIsMobile();
  return (
    <Panel style={{ padding: isMobile ? "6px 16px" : "8px 22px" }}>
      <List>{children}</List>
    </Panel>
  );
}

function Folder({ icon, label, count, expanded, onToggle, children }) {
  return (
    <Disclosure
      title={label}
      icon={<Icon name={icon} size={18} />}
      count={count}
      open={expanded}
      onToggle={onToggle}
    >
      {children}
    </Disclosure>
  );
}

function useToggleSet(setExpanded) {
  return (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
}

/* ═══════════════════════════════════════════════
   SUBJECT VIEW — regular users: grouped by subject
   ═══════════════════════════════════════════════ */
function SubjectView({ materials, profile, canSquadEdit, expanded, setExpanded, onView, onDeleted }) {
  const { t } = useI18n();
  const canDel = canUpload(profile?.role, canSquadEdit, profile);
  const toggle = useToggleSet(setExpanded);

  // Group materials by category, preserving SUBJECTS order
  const groups = useMemo(() => {
    const map = {};
    for (const m of materials) {
      const cat = m.category || "general";
      if (!map[cat]) map[cat] = [];
      map[cat].push(m);
    }
    // Order by SUBJECTS list, then any remaining categories
    const ordered = [];
    for (const s of SUBJECTS) {
      if (map[s.key]) ordered.push({ key: s.key, label: t(`subj.${s.key}`) || s.label, items: map[s.key] });
    }
    for (const key of Object.keys(map)) {
      if (!SUBJECTS.find((s) => s.key === key)) {
        ordered.push({ key, label: t(`subj.${key}`) || key, items: map[key] });
      }
    }
    return ordered;
  }, [materials, t]);

  return (
    <FolderPanel>
      {groups.map((g) => (
        <Folder
          key={g.key}
          icon={SUBJECT_ICONS[g.key] || "folder"}
          label={g.label}
          count={g.items.length}
          expanded={expanded.has(g.key)}
          onToggle={() => toggle(g.key)}
        >
          <MaterialList>
            {g.items.map((m) => (
              <MaterialRow
                key={m.id}
                material={m}
                canDelete={canDel}
                showWeek
                onView={() => onView(m)}
                onDeleted={onDeleted}
              />
            ))}
          </MaterialList>
        </Folder>
      ))}
    </FolderPanel>
  );
}

/* ═══════════════════════════════════════════════
   WEEKLY VIEW — boot camp: grouped by week only.
   Each week is a flat list of materials (no subject folders).
   Subject is still visible as a badge on each material row.
   ═══════════════════════════════════════════════ */
function WeeklyView({ materials, profile, canSquadEdit, expanded, setExpanded, onView, onDeleted }) {
  const { t } = useI18n();
  const canDel = canUpload(profile?.role, canSquadEdit, profile);
  const toggle = useToggleSet(setExpanded);

  const weekGroups = useMemo(() => {
    const weeks = WEEKS.map((w) => ({
      week: w,
      items: materials.filter((m) => m.week === w),
    }));
    const unassigned = materials.filter((m) => !m.week);
    return { weeks, unassigned };
  }, [materials]);

  return (
    <FolderPanel>
      {weekGroups.weeks.map((wg) => (
        <Folder
          key={wg.week}
          icon="calendar"
          label={t("kn.week", { n: wg.week })}
          count={`${wg.items.length} ${wg.items.length === 1 ? t("kn.material") : t("kn.materials")}`}
          expanded={expanded.has(wg.week)}
          onToggle={() => toggle(wg.week)}
        >
          {wg.items.length === 0 ? (
            <div style={{ ...T.footnote, color: C.dim, paddingBlock: "2px 10px", paddingInlineStart: 24 }}>
              {t("kn.week_empty")}
            </div>
          ) : (
            <MaterialList>
              {wg.items.map((m) => (
                <MaterialRow
                  key={m.id}
                  material={m}
                  canDelete={canDel}
                  showWeek={false}
                  showSubject
                  onView={() => onView(m)}
                  onDeleted={onDeleted}
                />
              ))}
            </MaterialList>
          )}
        </Folder>
      ))}

      {weekGroups.unassigned.length > 0 && (
        <Folder
          key="general"
          icon="folder"
          label={t("kn.general")}
          count={`${weekGroups.unassigned.length} ${weekGroups.unassigned.length === 1 ? t("kn.material") : t("kn.materials")}`}
          expanded={expanded.has("general")}
          onToggle={() => toggle("general")}
        >
          <MaterialList>
            {weekGroups.unassigned.map((m) => (
              <MaterialRow
                key={m.id}
                material={m}
                canDelete={canDel}
                showWeek={false}
                showSubject
                onView={() => onView(m)}
                onDeleted={onDeleted}
              />
            ))}
          </MaterialList>
        </Folder>
      )}
    </FolderPanel>
  );
}

/* ═══════════════════════════════════════════════
   UPLOAD PANEL
   ═══════════════════════════════════════════════ */
function UploadPanel({ onUploaded, track }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const fileRef = useRef(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("general");
  const [week, setWeek] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const uploadAsBootcamp = track === "bootcamp";

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) { setErr(t("kn.no_file")); return; }
    if (!title.trim()) { setErr(t("kn.no_title")); return; }
    setBusy(true); setErr(""); setOk("");
    const { error } = await uploadMaterial({
      file,
      title: title.trim(),
      description: desc.trim(),
      category,
      week: week ? parseInt(week, 10) : null,
      isBootcamp: uploadAsBootcamp,
    });
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    const msg = t("kn.uploaded", { title: title.trim() });
    setOk(msg);
    setTitle(""); setDesc(""); setFile(null); setWeek("");
    if (fileRef.current) fileRef.current.value = "";
    onUploaded?.(msg);
  }

  return (
    <form onSubmit={handleUpload}>
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile
          ? "minmax(0, 1fr)"
          : (uploadAsBootcamp ? "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 2fr) minmax(0, 1fr)"),
        columnGap: 16,
      }}>
        <Field label={t("kn.title_label")}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)}
                 placeholder={t("kn.title_ph")} />
        </Field>
        <Field label={t("kn.subject")}>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {SUBJECTS.map((s) => (
              <option key={s.key} value={s.key}>
                {t(`subj.${s.key}`) || s.label}
              </option>
            ))}
          </Select>
        </Field>
        {uploadAsBootcamp && (
          <Field label={t("kn.week_label")}>
            <Select value={week} onChange={(e) => setWeek(e.target.value)}>
              <option value="">{t("kn.week_none")}</option>
              {WEEKS.map((w) => (
                <option key={w} value={w}>{t("kn.week_n", { n: w })}</option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <Field label={t("kn.desc")}>
        <Textarea value={desc} onChange={(e) => setDesc(e.target.value)}
                  placeholder={t("kn.desc_ph")}
                  rows={2} style={{ height: 76 }} />
      </Field>

      <Field label={t("kn.file")}>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.pptx,.ppt,.doc,.docx,.png,.jpg,.jpeg"
          onChange={(e) => {
            const picked = e.target.files?.[0] || null;
            setFile(picked);
            // A "select a file" complaint is answered by selecting one.
            if (picked && !busy) setErr("");
          }}
          tabIndex={-1}
          aria-hidden
          style={{ display: "none" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <Btn type="button" icon="upload" onClick={() => fileRef.current && fileRef.current.click()}
               style={{ flexShrink: 0 }}>
            {file ? t("kn.change_file") : t("kn.choose_file")}
          </Btn>
          {file ? (
            <div style={{ minWidth: 0 }}>
              <div style={{ ...T.callout, fontWeight: 500, color: C.bright, ...ELLIPSIS }}>
                <span dir="auto">{file.name}</span>
              </div>
              <div style={{ ...T.caption, color: C.dim }}>
                <Num>{fmtSize(file.size)}</Num>
              </div>
            </div>
          ) : (
            <span style={{ ...T.footnote, color: C.dim }}>{t("kn.no_file_chosen")}</span>
          )}
        </div>
      </Field>

      <div style={{ marginTop: 4 }}>
        <Btn primary type="submit" disabled={busy} busy={busy} fullWidth={isMobile}>
          {busy ? t("kn.uploading") : t("kn.upload")}
        </Btn>
      </div>

      <ErrLine>{err}</ErrLine>
      <OkLine>{ok}</OkLine>
    </form>
  );
}

/* ═══════════════════════════════════════════════
   MATERIAL ROW
   ═══════════════════════════════════════════════ */

// Rows sit under their folder's label, past the chevron.
function MaterialList({ children }) {
  const isMobile = useIsMobile();
  return (
    <List style={{ paddingInlineStart: isMobile ? 0 : 24 }}>
      {children}
    </List>
  );
}

function MaterialRow({ material, canDelete, showWeek, showSubject, onView, onDeleted }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleDelete() {
    setBusy(true); setErr("");
    const { error } = await deleteMaterial(material);
    setBusy(false);
    setConfirmDel(false);
    if (error) { setErr(String(error.message || error)); return; }
    onDeleted?.();
  }

  const name = material.title || material.file_name;
  const ext = extOf(material.file_name);
  const subjectLabel = t(`subj.${material.category}`) || SUBJECT_MAP[material.category] || material.category;
  const meta = [
    ext ? <span key="x">{ext.toUpperCase()}</span> : null,
    <Num key="s">{fmtSize(material.file_size)}</Num>,
    <Num key="d">{fmtWhen(material.created_at, t, { year: "numeric", month: "short", day: "numeric" })}</Num>,
  ].filter(Boolean);
  const badges = [
    showSubject ? <Badge key="subj">{subjectLabel}</Badge> : null,
    showWeek && material.week ? <Badge key="week">{t("kn.week", { n: material.week })}</Badge> : null,
  ].filter(Boolean);

  return (
    <>
      <Row
        as="div"
        onClick={onView}
        chevron
        leading={<IconTile icon={IMAGE_EXTS.includes(ext) ? "image" : "doc"} />}
        trailing={canDelete ? (
          <IconButton
            icon="trash"
            label={t("kn.delete")}
            size={isMobile ? 36 : 30}
            style={{ background: "transparent", color: C.dim }}
            onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }}
          />
        ) : null}
      >
        <div style={{ ...T.body, fontWeight: 600, color: C.bright, overflowWrap: "anywhere" }}>
          <span dir="auto">{name}</span>
        </div>
        {material.description && (
          <div style={{ ...T.footnote, color: C.text, marginTop: 1, overflowWrap: "anywhere" }}>
            <span dir="auto">{material.description}</span>
          </div>
        )}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "4px 8px",
          marginTop: 4,
          ...T.caption,
          color: C.dim,
        }}>
          {badges}
          <span>
            {meta.map((node, i) => (
              <span key={i}>
                {i > 0 && <span aria-hidden style={{ color: C.dimmer, margin: "0 6px" }}>·</span>}
                {node}
              </span>
            ))}
          </span>
        </div>
      </Row>
      <ErrLine>{err}</ErrLine>
      <ConfirmDialog
        open={confirmDel}
        title={t("kn.delete_title")}
        message={t("kn.delete_body", { title: name })}
        confirmLabel={t("kn.delete")}
        cancelLabel={t("common.cancel")}
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(false)}
      />
    </>
  );
}
