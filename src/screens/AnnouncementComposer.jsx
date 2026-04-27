import { useState } from "react";
import { useAuth, canCreateInvites, canManageSquads } from "../auth";
import { useI18n } from "../i18n";
import { Field, Input, Textarea, Btn, ErrLine, OkLine } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C } from "../theme";
import { postAnnouncement } from "../data/announcements";

/**
 * Compact announcement composer.
 *  - admin / officer  → can post global or squad (any squad)
 *  - squad_leader     → can post squad-scoped to own squad only
 *  - sniper           → component renders nothing
 */
export default function AnnouncementComposer({ onPosted }) {
  const { profile } = useAuth();
  const { t } = useI18n();
  const isMobile = useIsMobile();

  const isLead   = profile?.role === "squad_leader";
  const isAdmin  = canManageSquads(profile?.role);
  const canPost  = canCreateInvites(profile?.role);

  const [scope, setScope] = useState(isAdmin ? "global" : "squad");
  const [title, setTitle] = useState("");
  const [body, setBody]   = useState("");
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");
  const [ok, setOk]       = useState("");

  if (!canPost) return null;
  if (isLead && !profile?.squad_id) return null;

  async function submit(e) {
    e.preventDefault();
    setErr(""); setOk("");
    if (!body.trim()) { setErr(t("ann.body_required")); return; }
    setBusy(true);
    const squadId = scope === "squad"
      ? (isLead ? profile.squad_id : profile.squad_id || null)
      : null;
    if (scope === "squad" && !squadId) {
      setBusy(false);
      setErr(t("ann.no_squad"));
      return;
    }
    const { error } = await postAnnouncement({
      scope,
      squadId,
      title: title.trim(),
      body: body.trim(),
    });
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    setOk(t("ann.posted"));
    setTitle("");
    setBody("");
    if (onPosted) onPosted();
  }

  return (
    <form onSubmit={submit}>
      {isAdmin && (
        <Field label={t("ann.scope")}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn
              type="button"
              small
              active={scope === "global"}
              onClick={() => setScope("global")}
            >
              {t("ann.global")}
            </Btn>
            <Btn
              type="button"
              small
              active={scope === "squad"}
              onClick={() => setScope("squad")}
              disabled={!profile?.squad_id}
            >
              {t("ann.mysquad")}
            </Btn>
          </div>
          <div style={{ color: C.dim, fontSize: 12, marginTop: 6 }}>
            {scope === "global"
              ? t("ann.global_desc")
              : t("ann.squad_desc")}
          </div>
        </Field>
      )}
      {!isAdmin && (
        <div style={{ color: C.dim, fontSize: 12, marginBottom: 12 }}>
          {t("ann.lead_desc")}
        </div>
      )}

      <Field label={t("ann.title_label")}>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("ann.title_ph")}
          maxLength={80}
        />
      </Field>

      <Field label={t("ann.body")}>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("ann.body_ph")}
          rows={4}
        />
      </Field>

      <div style={{ marginTop: 8 }}>
        <Btn primary disabled={busy}>
          {busy ? t("ann.posting") : t("ann.post")}
        </Btn>
      </div>

      <ErrLine>{err}</ErrLine>
      <OkLine>{ok}</OkLine>
    </form>
  );
}
